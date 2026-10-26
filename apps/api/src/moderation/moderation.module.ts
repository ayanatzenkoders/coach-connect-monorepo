import { Module } from '@nestjs/common';
import { BanService } from './ban.service.js';

@Module({ providers: [BanService], exports: [BanService] })
export class ModerationModule {}
