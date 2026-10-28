import React from 'react';
import RegisterCoach from '@/src/screens/auth/registerCoach/RegisterCoach';
import { ApiError } from '@/src/service/setup/apiClient';
import { useAuthStore } from '@/src/store/auth.store';
import { allText, byLabel, clearToast, lastToast, navigationMock, press, render, resetNavigationMock, screenProps, typeInto } from '@/test-utils';

jest.mock('react-native-keychain', () => ({}));

const registerCoach = jest.fn();
type Tree = Awaited<ReturnType<typeof render>>;

const open = () => render(<RegisterCoach {...screenProps('RegisterCoach')} />);
async function fillValid(tree: Tree) {
  await typeInto(tree, 'Full name', '  Carl Coach ');
  await typeInto(tree, 'Email', ' carl@coachconnect.dev ');
  await typeInto(tree, 'Phone number', '+49 170 1234567');
  await typeInto(tree, 'Date of birth', '19850309');
  await typeInto(tree, 'About you', 'I help people prepare for hard career conversations.');
  await typeInto(tree, 'Password', 'Longenough1');
  await press(tree, 'Burnout');
  await press(tree, 'Salary talks');
}

beforeEach(() => {
  clearToast();
  resetNavigationMock();
  registerCoach.mockReset().mockResolvedValue(undefined);
  useAuthStore.setState({ registerCoach });
});

describe('Apply as a coach screen', () => {
  it('explains the process and tells the coach the phone number is for admins only', async () => {
    const t = allText(await open());
    expect(t).toEqual(expect.arrayContaining(['Apply as a coach', 'Specialties', 'Only our admins see your number. It is never shown to members.']));
    expect(t.some((x) => x.includes('An admin reviews every application'))).toBe(true);
  });

  it('refuses an empty form and names every missing part', async () => {
    const tree = await open();
    await press(tree, 'Submit application');
    expect(registerCoach).not.toHaveBeenCalled();
    expect(allText(tree)).toEqual(
      expect.arrayContaining([
        'Enter your name.',
        'Enter a valid email address.',
        'Enter a valid phone number.',
        'Enter a real date, like 1985-03-09.',
        'Pick at least one specialty.',
        'Your password does not meet all the requirements below.',
      ]),
    );
    expect(allText(tree).some((x) => x.startsWith('Tell us a little more'))).toBe(true);
  });

  it('a too-short "about you" is refused', async () => {
    const tree = await open();
    await fillValid(tree);
    await typeInto(tree, 'About you', 'Too short');
    await press(tree, 'Submit application');
    expect(registerCoach).not.toHaveBeenCalled();
  });

  it('sends the trimmed application with the chosen specialties', async () => {
    const tree = await open();
    await fillValid(tree);
    await press(tree, 'Submit application');
    expect(registerCoach).toHaveBeenCalledWith({
      name: 'Carl Coach',
      email: 'carl@coachconnect.dev',
      password: 'Longenough1',
      dateOfBirth: '1985-03-09',
      phone: '+49 170 1234567',
      bio: 'I help people prepare for hard career conversations.',
      specialties: ['Burnout', 'Salary talks'],
    });
  });

  it('a tapped specialty can be tapped again to remove it, and no more than 5 can be chosen', async () => {
    const tree = await open();
    const checked = (label: string) => tree.root.find((n) => n.props.accessibilityLabel === label && n.props.accessibilityRole === 'checkbox').props.accessibilityState.checked;
    await press(tree, 'Burnout');
    expect(checked('Burnout')).toBe(true);
    await press(tree, 'Burnout');
    expect(checked('Burnout')).toBe(false);
    for (const tag of ['Burnout', 'Leadership', 'Remote work', 'Salary talks', 'New managers', 'Interview prep']) await press(tree, tag);
    expect(checked('New managers')).toBe(true);
    expect(checked('Interview prep')).toBe(false); // the sixth is not added
    expect(allText(tree).some((x) => x.includes('(5 chosen)'))).toBe(true);
  });

  it('shows the server\'s reason (for example the email is taken) and keeps what was typed', async () => {
    registerCoach.mockRejectedValue(new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists.'));
    const tree = await open();
    await fillValid(tree);
    await press(tree, 'Submit application');
    expect(lastToast()?.message).toBe('An account with this email already exists.');
    expect(byLabel(tree, 'Full name').props.value).toBe('  Carl Coach ');
  });

  it('"Not a coach?" goes to the member form and Back goes back', async () => {
    const tree = await open();
    await press(tree, 'Create a member account instead');
    expect(navigationMock.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'REPLACE', payload: expect.objectContaining({ name: 'Register' }) }));
    await press(tree, 'Back');
    expect(navigationMock.goBack).toHaveBeenCalled();
  });
});
