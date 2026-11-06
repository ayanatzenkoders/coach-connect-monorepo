import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CallsService } from './calls.service.js';

const EVERY_MS = 5_000;

/**
 * A timer that, every 5 seconds, asks CallsService to end calls nobody answered within 30 seconds.
 * Without it a call whose callee never picks up would ring forever. (Tests do not start the timer: they call
 * `calls.sweep()` themselves, so nothing runs in the background.)
 */
@Injectable()
export class RingSweeper implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(RingSweeper.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly calls: CallsService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.tick(), EVERY_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** One round. `running` stops two rounds from overlapping when the database is slow. */
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.calls.sweep();
    } catch (e) {
      this.log.error(`ring sweep failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.running = false;
    }
  }
}
