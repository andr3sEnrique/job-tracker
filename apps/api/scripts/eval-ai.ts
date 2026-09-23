/* eslint-disable no-console -- command-line report */
/**
 * Measures the AI analyzer on the synthetic dataset (templates + anonymised regression
 * cases) with the configured provider, next to the rules for comparison. Costs real tokens,
 * so it is run by hand, never in CI:
 *
 *   AI_PROVIDER=anthropic ANTHROPIC_API_KEY=… pnpm --filter @jat/api eval:ai [--limit 30]
 *   AI_PROVIDER=ollama AI_MODEL=llama3.1:8b pnpm --filter @jat/api eval:ai
 *
 * No real email is ever sent: every case is synthetic or anonymised.
 */
import { config as loadEnv } from 'dotenv';
import { AnthropicProvider } from '../src/ai/anthropic.provider.js';
import {
  aiAnalysisSchema,
  buildEmailPrompt,
  SYSTEM_PROMPT,
  PROMPT_VERSION,
} from '../src/ai/email-prompt.js';
import type { LlmProvider } from '../src/ai/llm-provider.js';
import { OllamaProvider } from '../src/ai/ollama.provider.js';
import { extractJobData } from '../src/classification/extractor.js';
import { prepareEmail } from '../src/classification/prepare-email.js';
import { RulesClassifier } from '../src/classification/rules-classifier.js';
import { validateEnv } from '../src/config/env.js';
import {
  FAKE_COMPANIES,
  FAKE_ROLES,
  REGRESSION_CASES,
  STANDALONE,
  STORIES,
  fill,
} from '../src/gmail/fake-mailbox.data.js';

loadEnv({ path: new URL('../../../.env', import.meta.url).pathname, quiet: true });
const env = validateEnv(process.env);
const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;

let llm: LlmProvider;
if (env.AI_PROVIDER === 'anthropic')
  llm = new AnthropicProvider(env.AI_MODEL, env.ANTHROPIC_API_KEY as string, env.AI_TIMEOUT_MS);
else if (env.AI_PROVIDER === 'ollama')
  llm = new OllamaProvider(env.AI_MODEL, env.OLLAMA_URL, env.AI_TIMEOUT_MS);
else {
  console.error('Set AI_PROVIDER=anthropic or ollama to run the evaluation.');
  process.exit(1);
}

const compact = (v: string | null | undefined) => (v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const company = FAKE_COMPANIES[5]!; // name differs from its domain: the hardest case
const role = FAKE_ROLES[1]!;
const cases = [
  ...[...STORIES.flat(), ...STANDALONE].map((t) => ({
    key: t.key,
    from: fill(t.from, company, role),
    subject: fill(t.subject, company, role),
    body: fill(t.body, company, role),
    expected: {
      category: t.expected.category,
      company: t.expected.company ? company.name : null,
      role: t.expected.role ? role : null,
    },
  })),
  ...REGRESSION_CASES,
].slice(0, limit);

const rules = new RulesClassifier();
const score = {
  ai: { category: 0, company: 0, role: 0 },
  rules: { category: 0, company: 0, role: 0 },
};
let tokensIn = 0;
let tokensOut = 0;
let invalid = 0;
const withCompany = cases.filter((c) => c.expected.company).length;
const withRole = cases.filter((c) => c.expected.role).length;

console.log(`Evaluating ${llm.name}:${llm.model}@${PROMPT_VERSION} on ${cases.length} cases…\n`);
for (const c of cases) {
  const email = prepareEmail({ subject: c.subject, from: c.from, text: c.body, html: null });
  const byRules = { category: rules.classify(email).category, ...extractJobData(email) };
  let ai;
  try {
    const res = await llm.generateStructured({
      system: SYSTEM_PROMPT,
      prompt: buildEmailPrompt(email),
      schema: aiAnalysisSchema,
      schemaName: 'record_email_analysis',
      maxOutputTokens: 400,
    });
    ai = res.data;
    tokensIn += res.usage.inputTokens;
    tokensOut += res.usage.outputTokens;
  } catch (error) {
    invalid++;
    console.log(`  ✗ ${c.key}: ${(error as Error).name}`);
    continue;
  }
  for (const [who, got] of [
    ['ai', ai],
    ['rules', byRules],
  ] as const) {
    if (got.category === c.expected.category) score[who].category++;
    if (c.expected.company && compact(got.company) === compact(c.expected.company))
      score[who].company++;
    if (c.expected.role && compact(got.role) === compact(c.expected.role)) score[who].role++;
  }
  if (ai.category !== c.expected.category)
    console.log(`  ✗ ${c.key}: expected ${c.expected.category}, AI said ${ai.category}`);
}

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : '—');
console.table({
  category: {
    ai: pct(score.ai.category, cases.length),
    rules: pct(score.rules.category, cases.length),
  },
  company: { ai: pct(score.ai.company, withCompany), rules: pct(score.rules.company, withCompany) },
  role: { ai: pct(score.ai.role, withRole), rules: pct(score.rules.role, withRole) },
});
const cost =
  (tokensIn * env.AI_INPUT_USD_PER_MTOK + tokensOut * env.AI_OUTPUT_USD_PER_MTOK) / 1_000_000;
console.log(
  `Invalid/failed: ${invalid} · tokens ${tokensIn} in / ${tokensOut} out · ≈ $${cost.toFixed(4)} ` +
    `($${(cost / Math.max(cases.length - invalid, 1)).toFixed(5)} per email)`,
);
