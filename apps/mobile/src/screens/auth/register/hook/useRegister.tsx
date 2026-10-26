import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { showApiError } from '@/src/service/setup/handleApiError';
import { useAuthStore } from '@/src/store/auth.store';
import { isStrongPassword, isValidEmail } from '@/src/utils/helpers';

interface Params {
  /** Email to start with (e.g. typed on the Forgot password screen before it found no account). */
  email?: string;
}

type Field = 'name' | 'email' | 'password';

/** All the logic of the Create account screen. */
export const useRegister = (params?: Params) => {
  const navigation = useNavigation();
  const register = useAuthStore((s) => s.register);

  const [name, setName] = useState('');
  const [email, setEmail] = useState(params?.email ?? '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [busy, setBusy] = useState(false);

  // Typing in a field removes that field's old error.
  const clear = (field: Field) => setErrors((e) => ({ ...e, [field]: undefined }));

  async function submit() {
    const next: typeof errors = {};
    if (name.trim().length === 0) next.name = 'Enter your name.';
    if (!isValidEmail(email)) next.email = 'Enter a valid email address.';
    if (!isStrongPassword(password)) next.password = 'Your password does not meet all the requirements below.';
    setErrors(next);
    if (next.name || next.email || next.password) return;

    setBusy(true);
    try {
      await register(name.trim(), email.trim(), password); // success: the root navigator moves on
    } catch (e) {
      showApiError(e); // "email already exists", no internet, ... all appear as a toast
    } finally {
      setBusy(false);
    }
  }

  return {
    name,
    email,
    password,
    errors,
    busy,
    onChangeName: (v: string) => {
      setName(v);
      clear('name');
    },
    onChangeEmail: (v: string) => {
      setEmail(v);
      clear('email');
    },
    onChangePassword: (v: string) => {
      setPassword(v);
      clear('password');
    },
    submit,
    goBack: () => navigation.goBack(),
  };
};
