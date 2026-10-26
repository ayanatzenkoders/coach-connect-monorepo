import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  API_ROUTES,
  IdSchema,
  MarkReadInputSchema,
  MessagesQuerySchema,
  OpenConversationInputSchema,
  SendMessageInputSchema,
} from '@coach-connect/shared';
import type { MarkReadInput, MessagesQueryParsed, OpenConversationInput, SendMessageInput } from '@coach-connect/shared';
import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser } from '../common/decorators/index.js';
import { ChatService } from './chat.service.js';

// No @Public, no @Roles: any logged-in MOBILE user (member or coach), like People.
@ApiTags('chat')
@Controller()
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get(API_ROUTES.chat.conversations)
  list(@CurrentUser() user: AuthUser) {
    return this.chat.list(user.id);
  }

  /** Start or reopen the chat with someone (returns the same conversation every time). */
  @Post(API_ROUTES.chat.conversations)
  @HttpCode(200)
  open(@CurrentUser() user: AuthUser, @Body({ schema: OpenConversationInputSchema }) dto: OpenConversationInput) {
    return this.chat.open(user.id, dto.userId);
  }

  @Get(API_ROUTES.chat.messages)
  messages(@CurrentUser() user: AuthUser, @Param('id', { schema: IdSchema }) id: string, @Query({ schema: MessagesQuerySchema }) query: MessagesQueryParsed) {
    return this.chat.messages(user.id, id, query);
  }

  @Post(API_ROUTES.chat.messages)
  @HttpCode(200)
  send(@CurrentUser() user: AuthUser, @Param('id', { schema: IdSchema }) id: string, @Body({ schema: SendMessageInputSchema }) dto: SendMessageInput) {
    return this.chat.send(user.id, id, dto);
  }

  @Post(API_ROUTES.chat.read)
  @HttpCode(200)
  read(@CurrentUser() user: AuthUser, @Param('id', { schema: IdSchema }) id: string, @Body({ schema: MarkReadInputSchema }) dto: MarkReadInput) {
    return this.chat.markRead(user.id, id, dto.upToSeq);
  }
}
