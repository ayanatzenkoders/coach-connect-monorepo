import { StackActions, useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { COACH_BIO_MAX, COACH_BIO_MIN, COACH_MAX_SPECIALTIES } from '@/src/constants';
import { showApiError } from '@/src/service/setup/handleApiError';
import { useAuthStore } from '@/src/store/auth.store';
import { formatDobInput, isStrongPassword, isValidDob, isValidEmail, isValidPhone } from '@/src/utils/helpers';

type Field = 'name' | 'email' | 'phone' | 'dob' | 'bio' | 'specialties' | 'password';

/** All the logic of the "Apply as a coach" form. Nothing is usable until an admin approves, so there is no auto sign-in to the app. */
export const useRegisterCoach = () => {
  const navigation = useNavigation();
  const registerCoach = useAuthStore((s) => s.registerCoach);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [busy, setBusy] = useState(false);

  const clear = (field: Field) => setErrors((e) => ({ ...e, [field]: undefined }));
  /** Typing in a field removes that field's old error. */
  const text = (set: (v: string) => void, field: Field) => (v: string) => {
    set(v);
    clear(field);
  };

  async function submit() {
    const next: typeof errors = {};
    if (name.trim().length === 0) next.name = 'Enter your name.';
    if (!isValidEmail(email)) next.email = 'Enter a valid email address.';
    if (!isValidPhone(phone)) next.phone = 'Enter a valid phone number.';
    if (!isValidDob(dob)) next.dob = 'Enter a real date, like 1985-03-09.';
    if (bio.trim().length < COACH_BIO_MIN) next.bio = `Tell us a little more (at least ${COACH_BIO_MIN} characters).`;
    if (specialties.length === 0) next.specialties = 'Pick at least one specialty.';
    if (!isStrongPassword(password)) next.password = 'Your password does not meet all the requirements below.';
    setErrors(next);
    if (Object.values(next).some(Boolean) || busy) return;

    setBusy(true);
    try {
      await registerCoach({ name: name.trim(), email: email.trim(), password, dateOfBirth: dob, phone: phone.trim(), bio: bio.trim(), specialties });
      // success: the root navigator asks for the email code, then shows "waiting for approval"
    } catch (e) {
      showApiError(e);
    } finally {
      setBusy(false);
    }
  }

  return {
    name,
    email,
    phone,
    dob,
    bio,
    specialties,
    password,
    errors,
    busy,
    bioMax: COACH_BIO_MAX,
    maxSpecialties: COACH_MAX_SPECIALTIES,
    onChangeName: text(setName, 'name'),
    onChangeEmail: text(setEmail, 'email'),
    onChangePhone: text(setPhone, 'phone'),
    onChangeDob: (v: string) => {
      setDob(formatDobInput(v));
      clear('dob');
    },
    onChangeBio: text(setBio, 'bio'),
    onChangePassword: text(setPassword, 'password'),
    /** Add or remove a specialty. Past the limit a new one is simply not added (the counter says why). */
    toggleSpecialty: (tag: string) => {
      setSpecialties((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : current.length >= COACH_MAX_SPECIALTIES ? current : [...current, tag]));
      clear('specialties');
    },
    submit,
    goBack: () => navigation.goBack(),
    goMemberSignUp: () => navigation.dispatch(StackActions.replace('Register')),
  };
};
