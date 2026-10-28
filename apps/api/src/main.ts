import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';
import { setupSwagger } from './swagger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Runs onModuleDestroy / onApplicationShutdown hooks on Ctrl+C or SIGTERM, so connections close cleanly.
  app.enableShutdownHooks();
  if (config.get('NODE_ENV', { infer: true }) !== 'production') setupSwagger(app);

  const port = config.get('PORT', { infer: true });
  // 0.0.0.0 so a phone on the same Wi-Fi can reach the API, not just this Mac.
  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on http://localhost:${port} (docs: /docs)`, 'Bootstrap');
}
await bootstrap();
