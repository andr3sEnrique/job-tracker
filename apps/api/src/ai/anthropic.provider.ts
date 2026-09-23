import Anthropic from '@anthropic-ai/sdk';
import {
  LlmProvider,
  LlmProviderError,
  type LlmUsage,
  type StructuredRequest,
} from './llm-provider.js';

/**
 * Claude through the Messages API. Structured output via a forced tool call whose input
 * schema is the Zod schema; the result is still validated by the port.
 * Anthropic's commercial API does not train on inputs by default.
 */
export class AnthropicProvider extends LlmProvider {
  readonly name = 'anthropic';
  readonly enabled = true;
  private readonly client: Anthropic;

  constructor(
    readonly model: string,
    apiKey: string,
    timeoutMs: number,
  ) {
    super();
    this.client = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 2 });
  }

  protected async complete(
    request: StructuredRequest<unknown>,
    jsonSchema: Record<string, unknown>,
  ): Promise<{ raw: unknown; usage: LlmUsage }> {
    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: request.maxOutputTokens,
        system: request.system,
        messages: [{ role: 'user', content: request.prompt }],
        tools: [
          {
            name: request.schemaName,
            description: 'Record the result of the analysis.',
            input_schema: { ...jsonSchema, type: 'object' },
          },
        ],
        tool_choice: { type: 'tool', name: request.schemaName },
      });
      const tool = res.content.find((block) => block.type === 'tool_use');
      return {
        raw: tool?.input,
        usage: { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens },
      };
    } catch (error) {
      // Only a code: SDK messages may echo parts of the request.
      if (error instanceof Anthropic.APIError) {
        throw new LlmProviderError(error.status ? `http_${error.status}` : error.name);
      }
      throw new LlmProviderError((error as Error).name);
    }
  }
}
