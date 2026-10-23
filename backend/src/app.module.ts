import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    // Reads backend/.env into process.env, available everywhere.
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
  ],
})
export class AppModule {}
