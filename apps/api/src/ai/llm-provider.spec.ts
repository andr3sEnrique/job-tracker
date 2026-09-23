import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { FakeLlmProvider } from './fake-llm.provider.js';
import { LlmInvalidOutputError } from './llm-provider.js';

const request = {
  system: 's',
  prompt: 'p',
  schema: z.object({ answer: z.number() }),
  schemaName: 'answer',
  maxOutputTokens: 10,
};

describe('LlmProvider.generateStructured', () => {
  it('returns validated output and usage', async () => {
    const llm = Object.assign(new FakeLlmProvider(), { respond: () => ({ answer: 42 }) });
    await expect(llm.generateStructured(request)).resolves.toEqual({
      data: { answer: 42 },
      usage: { inputTokens: 1000, outputTokens: 100 },
    });
  });

  it('rejects output that does not match the schema, keeping the usage for the budget', async () => {
    const llm = Object.assign(new FakeLlmProvider(), { respond: () => ({ answer: 'no' }) });
    const error = await llm.generateStructured(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmInvalidOutputError);
    expect((error as LlmInvalidOutputError).usage.inputTokens).toBe(1000);
  });
});
