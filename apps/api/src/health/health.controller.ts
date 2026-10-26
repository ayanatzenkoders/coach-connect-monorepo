import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { API_ROUTES } from '@coach-connect/shared';
import { Public } from '../common/decorators/index.js';

@ApiTags('health')
@Public()
@Controller()
export class HealthController {
  // Used by the phone app, uptime monitors and the hosting platform to check the API is alive.
  @Get(API_ROUTES.health)
  check() {
    return {
      status: 'ok',
      service: 'coach-connect-api',
      time: new Date().toISOString(),
    };
  }
}
