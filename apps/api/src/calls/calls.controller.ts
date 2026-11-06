import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { API_ROUTES, IdSchema, StartCallInputSchema } from '@coach-connect/shared';
import type { StartCallInput } from '@coach-connect/shared';
import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser } from '../common/decorators/index.js';
import { CallsService } from './calls.service.js';

// No @Public / @Roles: any signed-in, approved mobile user. Who may do what in a call is decided by CallsService.
@ApiTags('calls')
@Controller()
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Post(API_ROUTES.calls.start)
  start(@CurrentUser() user: AuthUser, @Body({ schema: StartCallInputSchema }) dto: StartCallInput) {
    return this.calls.start(user.id, dto);
  }

  @Post(API_ROUTES.calls.join) @HttpCode(200)
  join(@CurrentUser() user: AuthUser, @Param('id', { schema: IdSchema }) id: string) {
    return this.calls.join(user.id, id);
  }

  @Post(API_ROUTES.calls.decline) @HttpCode(200)
  decline(@CurrentUser() user: AuthUser, @Param('id', { schema: IdSchema }) id: string) {
    return this.calls.decline(user.id, id);
  }

  @Post(API_ROUTES.calls.cancel) @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', { schema: IdSchema }) id: string) {
    return this.calls.cancel(user.id, id);
  }

  @Post(API_ROUTES.calls.leave) @HttpCode(200)
  leave(@CurrentUser() user: AuthUser, @Param('id', { schema: IdSchema }) id: string) {
    return this.calls.leave(user.id, id);
  }

  @Get(API_ROUTES.calls.inChat)
  inChat(@CurrentUser() user: AuthUser, @Param('id', { schema: IdSchema }) id: string) {
    return this.calls.inChat(user.id, id);
  }
}
