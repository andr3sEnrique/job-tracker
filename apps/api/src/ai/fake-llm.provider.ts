import { LlmProvider, type LlmUsage, type StructuredRequest } from './llm-provider.js';

/**
 * Scripted model for tests. Disabled until a test turns it on, so suites that do not care
 * about AI keep the rules-only behaviour.
 */
export class FakeLlmProvider extends LlmProvider {
  readonly name = 'fake';
  readonly model = 'fake-model';
  enabled = false;
  /** What the "model" answers; throw inside to simulate provider errors. */
  respond: (request: StructuredRequest<unknown>) => unknown = () => undefined;
  readonly calls: StructuredRequest<unknown>[] = [];
  usage: LlmUsage = { inputTokens: 1000, outputTokens: 100 };

  protected async complete(request: StructuredRequest<unknown>) {
    this.calls.push(request);
    return { raw: this.respond(request), usage: this.usage };
  }

  reset() {
    this.enabled = false;
    this.respond = () => undefined;
    this.calls.length = 0;
    this.usage = { inputTokens: 1000, outputTokens: 100 };
  }
}
