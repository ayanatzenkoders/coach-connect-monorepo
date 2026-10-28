import type React from 'react';

export interface CustomCodeEntryProps {
  title: string;
  description: React.ReactNode;
  /** Ask the server to email a (new) code. Resolves with the seconds to wait before another can be requested. */
  onSendCode: () => Promise<{ resendAfterSeconds: number }>;
  /** True: ask for a code as soon as the screen opens. False: a code was already sent on the previous screen. */
  sendOnOpen?: boolean;
  /** When `sendOnOpen` is false: how long until "Resend" works. */
  initialResendSeconds?: number;
  /** Check the typed code. Throws (ApiError) when it is wrong; the error is shown as a toast. */
  onSubmit: (code: string) => Promise<void>;
  onBack: () => void;
}
