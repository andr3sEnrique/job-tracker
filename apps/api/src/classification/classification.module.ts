import { Module } from '@nestjs/common';
import { RulesClassifier } from './rules-classifier.js';
import { EmailClassifier } from './types.js';

@Module({
  // Phase 7 swaps this for a composite (rules first, AI only when unsure) behind the same port.
  providers: [{ provide: EmailClassifier, useClass: RulesClassifier }],
  exports: [EmailClassifier],
})
export class ClassificationModule {}
