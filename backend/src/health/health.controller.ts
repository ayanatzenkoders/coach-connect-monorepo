import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/index.js';

@Public()
@Controller('health')
export class HealthController {
  // Used by the phone app, uptime monitors and the hosting platform to check the API is alive.
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'coach-connect-api',
      time: new Date().toISOString(),
    };
  }
}
