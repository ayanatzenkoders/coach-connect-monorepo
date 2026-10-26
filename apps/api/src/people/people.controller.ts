import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser } from '../common/decorators/index.js';
import { API_ROUTES, PeopleQuerySchema } from '@coach-connect/shared';
import type { PeopleQueryParsed } from '@coach-connect/shared';
import { PeopleService } from './people.service.js';

// No @Public, no @Roles, no @Audience: the defaults apply = any logged-in MOBILE user (member or coach).
@ApiTags('people')
@Controller()
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get(API_ROUTES.people)
  list(@CurrentUser() user: AuthUser, @Query({ schema: PeopleQuerySchema }) query: PeopleQueryParsed) {
    return this.people.list(user.id, query);
  }
}
