import { Controller, Get, Query } from '@nestjs/common';
import { listEmailsParamsSchema, type ListEmailsQuery } from '@jat/shared';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { EmailsService } from './emails.service.js';

@Controller('emails')
export class EmailsController {
  constructor(private readonly emails: EmailsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listEmailsParamsSchema)) query: ListEmailsQuery,
  ) {
    return this.emails.list(user.id, query);
  }
}
