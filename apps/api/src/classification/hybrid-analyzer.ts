import { Injectable } from '@nestjs/common';
import type { EmailCategory } from '@jat/shared';
import { AiEmailAnalyzer } from '../ai/ai-email-analyzer.service.js';
import type { AiAnalysis } from '../ai/email-prompt.js';
import { AppConfig } from '../config/app-config.service.js';
import { EmailAnalyzer, type Analysis } from './analyzer.js';
import { extractJobData } from './extractor.js';
import { EmailClassifier, type PreparedEmail } from './types.js';

/** Categories that turn into an application event: these need a company and a role. */
const EVENT_CATEGORIES: ReadonlySet<EmailCategory> = new Set([
  'APPLICATION_SUBMITTED',
  'APPLICATION_CONFIRMATION',
  'RECRUITER_REPLY',
  'INTERVIEW',
  'TECHNICAL_INTERVIEW',
  'REJECTION',
  'OFFER',
]);

/**
 * Rules first, AI only when they are unsure: unknown or low-confidence category, or an
 * application email whose company or role the extractor could not find. Most mail comes
 * from known templates and never reaches the AI. If the AI is off, over budget or fails,
 * the rules' answer stands.
 */
@Injectable()
export class HybridEmailAnalyzer extends EmailAnalyzer {
  constructor(
    private readonly rules: EmailClassifier,
    private readonly ai: AiEmailAnalyzer,
    private readonly config: AppConfig,
  ) {
    super();
  }

  async analyze(email: PreparedEmail, { emailId }: { emailId: string }): Promise<Analysis> {
    const fromRules: Analysis = {
      classification: this.rules.classify(email),
      extracted: extractJobData(email),
      classifierId: this.rules.id,
    };
    if (!this.ai.enabled || !this.needsSecondOpinion(fromRules)) return fromRules;

    const ai = await this.ai.analyze(emailId, email);
    return ai ? merge(fromRules, ai, this.ai.id) : fromRules;
  }

  private needsSecondOpinion({ classification, extracted }: Analysis): boolean {
    if (classification.category === 'UNKNOWN') return true;
    if (classification.confidence < this.config.get('AI_CONFIDENCE_THRESHOLD')) return true;
    return EVENT_CATEGORIES.has(classification.category) && (!extracted.company || !extracted.role);
  }
}

/** The AI decides the category; each extracted field falls back to the rules' value. */
function merge(rules: Analysis, ai: AiAnalysis, classifierId: string): Analysis {
  const r = rules.extracted;
  return {
    classification: {
      category: ai.category,
      confidence: ai.confidence,
      signals: [...rules.classification.signals, `ai:${ai.category}`],
    },
    extracted: {
      company: ai.company ?? r.company,
      companyConfidence: ai.company ? Math.max(r.companyConfidence, 0.85) : r.companyConfidence,
      role: ai.role ?? r.role,
      location: ai.location ?? r.location,
      workMode: ai.workMode ?? r.workMode,
      jobUrl: ai.jobUrl ?? r.jobUrl,
    },
    classifierId,
  };
}
