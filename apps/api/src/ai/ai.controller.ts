import { Controller, Get } from '@nestjs/common';
import { AiEmailAnalyzer } from './ai-email-analyzer.service.js';

@Controller('ai')
export class AiController {
  constructor(private readonly analyzer: AiEmailAnalyzer) {}

  /** Provider, model and this month's spend against the budget. */
  @Get('status')
  status() {
    return this.analyzer.status();
  }
}
