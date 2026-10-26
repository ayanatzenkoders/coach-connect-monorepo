import { Controller, Get, Query } from '@nestjs/common';
import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser } from '../common/decorators/index.js';
import { PeopleQueryDto } from './people.dto.js';
import { PeopleService } from './people.service.js';

// No @Public, no @Roles, no @Audience: the defaults apply = any logged-in MOBILE user (member or coach).
@Controller('people')
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: PeopleQueryDto) {
    return this.people.list(user.id, query);
  }
}
