import { Injectable, Logger } from '@nestjs/common';
import type { AiStatus } from '@jat/shared';
import type { PreparedEmail } from '../classification/types.js';
import { AppConfig } from '../config/app-config.service.js';
import type { AiRunStatus, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  aiAnalysisSchema,
  buildEmailPrompt,
  PROMPT_VERSION,
  redact,
  SYSTEM_PROMPT,
  type AiAnalysis,
} from './email-prompt.js';
import {
  LlmInvalidOutputError,
  LlmProvider,
  LlmProviderError,
  type LlmUsage,
} from './llm-provider.js';

const MAX_OUTPUT_TOKENS = 400;

/**
 * Domain side of the AI: builds the prompt, enforces the monthly budget, records every call
 * in `ai_runs` (audit + cache) and never throws — on any problem it returns null and the
 * caller keeps the rules' answer.
 */
@Injectable()
export class AiEmailAnalyzer {
  private readonly logger = new Logger(AiEmailAnalyzer.name);

  constructor(
    private readonly llm: LlmProvider,
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  get enabled(): boolean {
    return this.llm.enabled;
  }

  /** Stored as `emails.classifier`, e.g. `ai:claude-haiku-4-5@prompt-v1`. */
  get id(): string {
    return `ai:${this.llm.model}@${PROMPT_VERSION}`;
  }

  async analyze(emailId: string, email: PreparedEmail): Promise<AiAnalysis | null> {
    const cached = await this.prisma.aiRun.findFirst({
      where: { emailId, status: 'OK', model: this.llm.model, promptVersion: PROMPT_VERSION },
      orderBy: { createdAt: 'desc' },
      select: { output: true },
    });
    const reused = cached && aiAnalysisSchema.safeParse(cached.output);
    if (reused?.success) return this.sanitize(reused.data, email);

    if ((await this.spentThisMonth()) >= this.config.get('AI_MONTHLY_BUDGET_USD')) {
      await this.record(emailId, 'SKIPPED_BUDGET');
      return null;
    }

    const started = Date.now();
    try {
      const { data, usage } = await this.llm.generateStructured({
        system: SYSTEM_PROMPT,
        prompt: buildEmailPrompt(email),
        schema: aiAnalysisSchema,
        schemaName: 'record_email_analysis',
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      });
      await this.record(emailId, 'OK', { usage, latencyMs: Date.now() - started, output: data });
      return this.sanitize(data, email);
    } catch (error) {
      const latencyMs = Date.now() - started;
      if (error instanceof LlmInvalidOutputError) {
        await this.record(emailId, 'INVALID_OUTPUT', { usage: error.usage, latencyMs });
      } else {
        const code = error instanceof LlmProviderError ? error.code : (error as Error).name;
        // Only a code: provider errors may echo the prompt.
        this.logger.warn(`AI analysis failed: ${code}`);
        await this.record(emailId, 'ERROR', { latencyMs, errorCode: code.slice(0, 50) });
      }
      return null;
    }
  }

  async status(): Promise<AiStatus> {
    const since = startOfMonth();
    const [spent, calls] = await Promise.all([
      this.spentThisMonth(),
      this.prisma.aiRun.count({
        where: { createdAt: { gte: since }, status: { not: 'SKIPPED_BUDGET' } },
      }),
    ]);
    const budget = this.config.get('AI_MONTHLY_BUDGET_USD');
    return {
      enabled: this.llm.enabled,
      provider: this.llm.name,
      model: this.llm.model,
      promptVersion: PROMPT_VERSION,
      monthlyBudgetUsd: budget,
      spentThisMonthUsd: spent,
      callsThisMonth: calls,
      budgetExceeded: this.llm.enabled && spent >= budget,
    };
  }

  /** Anything not literally in the email is dropped: links must be ones it contains. */
  private sanitize(analysis: AiAnalysis, email: PreparedEmail): AiAnalysis {
    const links = new Set(email.links.map((l) => redact(l)));
    return {
      ...analysis,
      jobUrl: analysis.jobUrl && links.has(analysis.jobUrl) ? analysis.jobUrl : null,
    };
  }

  private async spentThisMonth(): Promise<number> {
    const { _sum } = await this.prisma.aiRun.aggregate({
      where: { createdAt: { gte: startOfMonth() } },
      _sum: { costUsd: true },
    });
    return Number(_sum.costUsd ?? 0);
  }

  private async record(
    emailId: string,
    status: AiRunStatus,
    details: { usage?: LlmUsage; latencyMs?: number; output?: AiAnalysis; errorCode?: string } = {},
  ) {
    const { usage, latencyMs = 0, output, errorCode } = details;
    const cost = usage
      ? (usage.inputTokens * this.config.get('AI_INPUT_USD_PER_MTOK') +
          usage.outputTokens * this.config.get('AI_OUTPUT_USD_PER_MTOK')) /
        1_000_000
      : 0;
    await this.prisma.aiRun.create({
      data: {
        emailId,
        provider: this.llm.name,
        model: this.llm.model,
        promptVersion: PROMPT_VERSION,
        status,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        latencyMs,
        costUsd: cost.toFixed(6),
        output: output as Prisma.InputJsonValue | undefined,
        errorCode: errorCode ?? null,
      },
    });
  }
}

function startOfMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
