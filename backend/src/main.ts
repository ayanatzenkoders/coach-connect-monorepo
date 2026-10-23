import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Reject request bodies that contain fields we did not declare.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  // 0.0.0.0 so a phone on the same Wi-Fi can reach the API, not just this Mac.
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
await bootstrap();
