import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  addNoteSchema,
  changeStatusSchema,
  createApplicationSchema,
  listApplicationsParamsSchema,
  updateApplicationSchema,
  type AddNoteInput,
  type ChangeStatusInput,
  type CreateApplicationInput,
  type ListApplicationsQuery,
  type UpdateApplicationInput,
} from '@jat/shared';
import { z } from 'zod';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ApplicationsService } from './applications.service.js';

const idPipe = new ZodValidationPipe(z.uuid());

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listApplicationsParamsSchema)) query: ListApplicationsQuery,
  ) {
    return this.applications.list(user.id, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', idPipe) id: string) {
    return this.applications.get(user.id, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createApplicationSchema)) body: CreateApplicationInput,
  ) {
    return this.applications.create(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodValidationPipe(updateApplicationSchema)) body: UpdateApplicationInput,
  ) {
    return this.applications.update(user.id, id, body);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  changeStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodValidationPipe(changeStatusSchema)) body: ChangeStatusInput,
  ) {
    return this.applications.changeStatus(user.id, id, body);
  }

  @Post(':id/notes')
  addNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodValidationPipe(addNoteSchema)) body: AddNoteInput,
  ) {
    return this.applications.addNote(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', idPipe) id: string) {
    return this.applications.remove(user.id, id);
  }
}
