import { Module } from '@nestjs/common';
import { CallsController } from './calls.controller.js';
import { CallsService } from './calls.service.js';
import { LiveKitService } from './livekit.service.js';
import { RingSweeper } from './ring-sweeper.service.js';

@Module({ controllers: [CallsController], providers: [CallsService, LiveKitService, RingSweeper], exports: [CallsService] })
export class CallsModule {}
