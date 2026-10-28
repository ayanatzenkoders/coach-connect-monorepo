import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  AddGroupMembersInputSchema,
  API_ROUTES,
  CreateGroupInputSchema,
  IdSchema,
  MarkReadInputSchema,
  MessagesQuerySchema,
  OpenChatInputSchema,
  SendMessageInputSchema,
} from '@coach-connect/shared';
import type { AddGroupMembersInput, CreateGroupInput, MarkReadInput, MessagesQueryParsed, OpenChatInput, SendMessageInput } from '@coach-connect/shared';
import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser } from '../common/decorators/index.js';
import { ChatService } from './chat.service.js';

// No @Public, no @Roles: any logged-in MOBILE user (member or coach), like People.
@ApiTags('chat')
@Controller()
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get(API_ROUTES.chat.chats)
  list(@CurrentUser() user: AuthUser) {
    return this.chat.list(user.id);
  }

  /** Start or reopen the chat with someone (returns the same chat every time). */
  @Post(API_ROUTES.chat.chats)
  @HttpCode(200)
  open(@CurrentUser() user: AuthUser, @Body({ schema: OpenChatInputSchema }) dto: OpenChatInput) {
    return this.chat.open(user.id, dto.userId);
  }

  /** Create a group chat (3 to 6 people, at most one coach). The caller is added automatically. */
  @Post(API_ROUTES.chat.groups)
  @HttpCode(200)
  createGroup(@CurrentUser() user: AuthUser, @Body({ schema: CreateGroupInputSchema }) dto: CreateGroupInput) {
    return this.chat.createGroup(user.id, dto);
  }

  /** One chat with its people (group info). */
  @Get(API_ROUTES.chat.detail)
  detail(@CurrentUser() user: AuthUser, @Param('id', { schema: IdSchema }) id: string) {
    return this.chat.detail(user.id, id);
  }

  /** Add people to a group (the creator only). */
  @Post(API_ROUTES.chat.members)
  @HttpCode(200)
  addMembers(@CurrentUser() user: AuthUser, @Param('id', { schema: IdSchema }) id: string, @Body({ schema: AddGroupMembersInputSchema }) dto: AddGroupMembersInput) {
    return this.chat.addMembers(user.id, id, dto);
  }

  /** Delete a group and all its messages for everybody (the creator only). */
  @Delete(API_ROUTES.chat.detail)
  @HttpCode(200)
  deleteGroup(@CurrentUser() user: AuthUser, @Param('id', { schema: IdSchema }) id: string) {
    return this.chat.deleteGroup(user.id, id);
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
    return this.chat.markRead(user.id, id, dto.upToSequenceNumber);
  }
}
