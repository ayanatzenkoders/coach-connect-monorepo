import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Password hashing with Argon2id (the current recommended algorithm).
 * - Deliberately SLOW and memory-hungry, so stolen hashes are expensive to crack.
 * - Salt is random per password and stored inside the hash string itself.
 * - Settings follow the OWASP minimum for argon2id (19 MiB memory, 2 passes).
 */
@Injectable()
export class PasswordService {
  private readonly options = {
    type: argon2.argon2id,
    memoryCost: 19456, // KiB
    timeCost: 2,
    parallelism: 1,
  } as const;

  /** A real hash of a random password. Used to burn the same time when the email is unknown. */
  private dummyHash: Promise<string> | undefined;

  hash(password: string): Promise<string> {
    return argon2.hash(password, this.options);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false; // malformed hash must never crash a login
    }
  }

  /**
   * Login for an unknown email must take as long as a real check; otherwise response time
   * reveals which emails have accounts ("user enumeration").
   */
  async burnTime(password: string): Promise<void> {
    this.dummyHash ??= this.hash(`dummy-${Math.random()}-${Date.now()}`);
    await this.verify(await this.dummyHash, password);
  }

  /** True when stored hashes use weaker settings than today's (re-hash on next login). */
  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, this.options);
  }
}
