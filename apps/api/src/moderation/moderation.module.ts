import { Module } from '@nestjs/common';
import { BanRealtimeListener } from './ban-realtime.listener.js';
import { BanService } from './ban.service.js';

@Module({ providers: [BanService, BanRealtimeListener], exports: [BanService] })
export class ModerationModule {}
