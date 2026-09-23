import { Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service.js';
import { AiController } from './ai.controller.js';
import { AiEmailAnalyzer } from './ai-email-analyzer.service.js';
import { AnthropicProvider } from './anthropic.provider.js';
import { FakeLlmProvider } from './fake-llm.provider.js';
import { DisabledLlmProvider, LlmProvider } from './llm-provider.js';
import { OllamaProvider } from './ollama.provider.js';

@Module({
  controllers: [AiController],
  providers: [
    {
      // Switching provider is an env change (AI_PROVIDER, AI_MODEL) plus, for a new one,
      // an adapter: nothing else knows which model is behind the port.
      provide: LlmProvider,
      inject: [AppConfig],
      useFactory: (config: AppConfig): LlmProvider => {
        const model = config.get('AI_MODEL');
        const timeout = config.get('AI_TIMEOUT_MS');
        switch (config.get('AI_PROVIDER')) {
          case 'anthropic':
            return new AnthropicProvider(model, config.get('ANTHROPIC_API_KEY') as string, timeout);
          case 'ollama':
            return new OllamaProvider(model, config.get('OLLAMA_URL'), timeout);
          case 'fake':
            return Object.assign(new FakeLlmProvider(), { enabled: true });
          default:
            return new DisabledLlmProvider();
        }
      },
    },
    AiEmailAnalyzer,
  ],
  exports: [AiEmailAnalyzer],
})
export class AiModule {}
