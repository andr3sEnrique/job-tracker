import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { EmailAnalyzer } from './analyzer.js';
import { HybridEmailAnalyzer } from './hybrid-analyzer.js';
import { RulesClassifier } from './rules-classifier.js';
import { EmailClassifier } from './types.js';

@Module({
  imports: [AiModule],
  providers: [
    { provide: EmailClassifier, useClass: RulesClassifier },
    { provide: EmailAnalyzer, useClass: HybridEmailAnalyzer },
  ],
  exports: [EmailAnalyzer],
})
export class ClassificationModule {}
