import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { API_ROUTES, SetAvailabilityInputSchema } from '@coach-connect/shared';
import type { SetAvailabilityInput } from '@coach-connect/shared';
import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser, Roles } from '../common/decorators/index.js';
import { CoachesService } from './coaches.service.js';

@ApiTags('coaches')
@Controller()
export class CoachesController {
  constructor(private readonly coaches: CoachesService) {}

  /** A coach switches "Available now" on or off. Members get 403 (the role is read from the database). */
  @Roles('COACH') @HttpCode(200)
  @Post(API_ROUTES.coaches.availability)
  setAvailability(@CurrentUser() user: AuthUser, @Body({ schema: SetAvailabilityInputSchema }) dto: SetAvailabilityInput) {
    return this.coaches.setAvailability(user.id, dto.available);
  }
}
