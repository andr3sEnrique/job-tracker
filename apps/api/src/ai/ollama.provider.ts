import {
  LlmProvider,
  LlmProviderError,
  type LlmUsage,
  type StructuredRequest,
} from './llm-provider.js';

/** A local model through Ollama: free and private, handy for development. */
export class OllamaProvider extends LlmProvider {
  readonly name = 'ollama';
  readonly enabled = true;

  constructor(
    readonly model: string,
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {
    super();
  }

  protected async complete(
    request: StructuredRequest<unknown>,
    jsonSchema: Record<string, unknown>,
  ): Promise<{ raw: unknown; usage: LlmUsage }> {
    let res: Response;
    try {
      res = await fetch(new URL('/api/chat', this.baseUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
        body: JSON.stringify({
          model: this.model,
          stream: false,
          format: jsonSchema,
          options: { temperature: 0, num_predict: request.maxOutputTokens },
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.prompt },
          ],
        }),
      });
    } catch (error) {
      throw new LlmProviderError((error as Error).name);
    }
    if (!res.ok) throw new LlmProviderError(`http_${res.status}`);
    const body = (await res.json()) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };
    const usage = { inputTokens: body.prompt_eval_count ?? 0, outputTokens: body.eval_count ?? 0 };
    let raw: unknown;
    try {
      raw = JSON.parse(body.message?.content ?? '');
    } catch {
      raw = undefined; // fails validation → INVALID_OUTPUT
    }
    return { raw, usage };
  }
}
