import { Controller, Get } from '@nestjs/common';

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
