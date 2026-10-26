import { Module } from '@nestjs/common';
import { ModerationModule } from '../moderation/moderation.module.js';
import { AdminController } from './admin.controller.js';

@Module({ imports: [ModerationModule], controllers: [AdminController] })
export class AdminModule {}
