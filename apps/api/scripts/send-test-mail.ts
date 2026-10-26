// Sends ONE test email with your current backend/.env mail settings.
//   npm run mail:test -- you@example.com
// It does not start the API or touch the database: it only builds the mailer.
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { validateEnv } from '../src/config/env.js';
import { MailerService } from '../src/mail/mailer.service.js';
import { codeEmail } from '../src/mail/templates.js';

const to = process.argv[2];
if (!to || !to.includes('@')) {
  console.error('Usage: npm run mail:test -- you@example.com');
  process.exit(1);
}

try {
  const env = validateEnv(process.env); // same start-up check as the real API (complains if settings are missing)
  console.log(`Mail driver: ${env.MAIL_DRIVER}   From: ${env.MAIL_FROM}`);
  await new MailerService(new ConfigService({ ...env })).send({
    to,
    subject: 'Coach Connect test email',
    ...codeEmail({
      label: 'test',
      heading: 'It works!',
      intro: 'This is a test email from your Coach Connect backend.',
      code: '123456',
      minutes: 10,
      footer: 'You can ignore this email.',
    }),
  });
  console.log(
    env.MAIL_DRIVER === 'console'
      ? '\nMAIL_DRIVER is "console": the email was only printed above, nothing was sent.'
      : `\nSent via ${env.MAIL_DRIVER}. Check the inbox (and the spam folder) of ${to}.`,
  );
} catch (e) {
  console.error('\nFAILED:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
