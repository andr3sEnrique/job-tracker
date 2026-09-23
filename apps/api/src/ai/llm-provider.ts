import { z } from 'zod';

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface StructuredRequest<T> {
  system: string;
  prompt: string;
  /** The output is always validated with it, even if the provider enforces the schema. */
  schema: z.ZodType<T>;
  /** Short identifier for the output (used as the tool name by some providers). */
  schemaName: string;
  maxOutputTokens: number;
}

/** The provider answered, but not with something matching the schema. */
export class LlmInvalidOutputError extends Error {
  override readonly name = 'LlmInvalidOutputError';
  constructor(readonly usage: LlmUsage) {
    super('The model output did not match the schema');
  }
}

/** Network, quota, auth or timeout problem talking to the provider. */
export class LlmProviderError extends Error {
  override readonly name = 'LlmProviderError';
  constructor(readonly code: string) {
    super(`LLM provider error: ${code}`);
  }
}

/**
 * Generic port for "text in, validated object out". Knows nothing about emails: adapters
 * (Anthropic, Ollama, fake) only implement `complete`; validation lives here, once.
 */
export abstract class LlmProvider {
  abstract readonly name: string;
  abstract readonly model: string;
  /** False when AI is switched off (AI_PROVIDER=none). */
  abstract readonly enabled: boolean;

  protected abstract complete(
    request: StructuredRequest<unknown>,
    jsonSchema: Record<string, unknown>,
  ): Promise<{ raw: unknown; usage: LlmUsage }>;

  async generateStructured<T>(
    request: StructuredRequest<T>,
  ): Promise<{ data: T; usage: LlmUsage }> {
    const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(request.schema) as Record<
      string,
      unknown
    >;
    const { raw, usage } = await this.complete(request, jsonSchema);
    const parsed = request.schema.safeParse(raw);
    if (!parsed.success) throw new LlmInvalidOutputError(usage);
    return { data: parsed.data, usage };
  }
}

/** AI switched off: never called (the analyzer checks `enabled`). */
export class DisabledLlmProvider extends LlmProvider {
  readonly name = 'none';
  readonly model = 'none';
  readonly enabled = false;

  protected complete(): Promise<never> {
    return Promise.reject(new LlmProviderError('disabled'));
  }
}
