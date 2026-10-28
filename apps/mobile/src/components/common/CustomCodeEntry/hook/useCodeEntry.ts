import { useCallback, useEffect, useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { CODE_LENGTH } from '@/src/constants';
import { ApiError } from '@/src/service/setup/apiClient';
import { showApiError } from '@/src/service/setup/handleApiError';
import { useCountdown } from '@/src/utils/hooks/useCountdown';
import type { CustomCodeEntryProps } from '../interface';

type Options = Pick<CustomCodeEntryProps, 'onSendCode' | 'sendOnOpen' | 'initialResendSeconds' | 'onSubmit'>;

/** The logic behind the code screen: the typed digits, the resend countdown and checking the code. */
export function useCodeEntry({ onSendCode, sendOnOpen = false, initialResendSeconds = 60, onSubmit }: Options) {
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false); // boxes turn red after a wrong code
  const [busy, setBusy] = useState(false);
  const { secondsLeft, start: startCountdown } = useCountdown();
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);

  /** Ask for a code. "You asked a moment ago" is normal and silent: we only show the countdown. */
  const requestCode = useCallback(async () => {
    try {
      startCountdown((await onSendCode()).resendAfterSeconds);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CODE_COOLDOWN') startCountdown(Number(e.data.retryAfterSeconds) || 60);
      else showApiError(e);
    }
  }, [onSendCode, startCountdown]);

  // When the screen opens: either ask for a code, or just start the countdown for the one already sent.
  useEffect(() => {
    if (sendOnOpen) requestCode();
    else startCountdown(initialResendSeconds);
  }, [sendOnOpen, initialResendSeconds, requestCode, startCountdown]);

  // After a wrong code, put the cursor back so the user can type again straight away.
  // (Done here, not in the catch block: the input is still disabled while the check runs.)
  useEffect(() => {
    if (!busy && invalid) input.current?.focus();
  }, [busy, invalid]);

  async function submit() {
    if (code.length !== CODE_LENGTH) return;
    setBusy(true);
    try {
      await onSubmit(code);
    } catch (e) {
      showApiError(e);
      setInvalid(true);
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    await requestCode();
    setCode('');
    setInvalid(false);
  }

  return {
    code,
    invalid,
    busy,
    secondsLeft,
    input,
    complete: code.length === CODE_LENGTH,
    onChangeCode: (digits: string) => {
      setCode(digits);
      setInvalid(false);
    },
    submit,
    resend,
  };
}
