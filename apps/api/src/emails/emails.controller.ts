import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  listEmailsParamsSchema,
  resolveEmailSchema,
  type ListEmailsQuery,
  type ResolveEmailInput,
} from '@jat/shared';
import { z } from 'zod';
import { EmailEventsService } from '../applications/email-events.service.js';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { EmailsService } from './emails.service.js';

@Controller('emails')
export class EmailsController {
  constructor(
    private readonly emails: EmailsService,
    private readonly events: EmailEventsService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listEmailsParamsSchema)) query: ListEmailsQuery,
  ) {
    return this.emails.list(user.id, query);
  }

  /** Review inbox decisions: confirm, ignore, assign to an application or create one. */
  @Post(':id/resolve')
  @HttpCode(HttpStatus.NO_CONTENT)
  resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ZodValidationPipe(z.uuid())) id: string,
    @Body(new ZodValidationPipe(resolveEmailSchema)) body: ResolveEmailInput,
  ) {
    return this.events.resolve(user.id, id, body);
  }

  /** Discards everything derived from emails and queues them all for classification again. */
  @Post('reprocess')
  @HttpCode(HttpStatus.OK)
  reprocess(@CurrentUser() user: AuthenticatedUser) {
    return this.events.resetForReprocessing(user.id);
  }
}
