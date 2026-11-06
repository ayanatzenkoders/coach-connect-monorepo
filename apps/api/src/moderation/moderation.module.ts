import { Module } from '@nestjs/common';
import { CallsModule } from '../calls/calls.module.js';
import { BanService } from './ban.service.js';

@Module({ imports: [CallsModule], providers: [BanService], exports: [BanService] })
export class ModerationModule {}
