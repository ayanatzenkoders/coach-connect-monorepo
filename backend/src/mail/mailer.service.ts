import { Injectable, Logger } from '@nestjs/common';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends email. For now it only PRINTS the email in the backend console (and keeps the last few
 * in memory so tests can read them): good enough to develop the sign-up flow with no email
 * account. Before launch, replace `send` with a call to an HTTP email provider (Render blocks
 * SMTP ports); nothing else in the code has to change.
 */
@Injectable()
export class MailerService {
  private readonly log = new Logger('Mailer');
  /** Last emails "sent" (development and tests only). */
  readonly outbox: Mail[] = [];

  async send(mail: Mail): Promise<void> {
    this.outbox.push(mail);
    if (this.outbox.length > 50) this.outbox.shift();
    this.log.log(`EMAIL to ${mail.to} | ${mail.subject}\n${mail.text}`);
  }
}
