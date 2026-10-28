import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ApiError } from '@/src/service/setup/apiClient';
import { CustomToastHost } from '@/src/components/common/CustomToastHost';
import { showApiError } from '@/src/service/setup/handleApiError';
import { showToast, useToastStore } from '@/src/store/toast.store';
import { allText, clearToast, lastToast, render } from '@/test-utils';


describe('toast store', () => {
  beforeEach(clearToast);

  it('shows the latest message, replacing the old one', () => {
    showToast('first');
    const firstId = lastToast()!.id;
    showToast('second', 'success');
    expect(lastToast()).toMatchObject({ message: 'second', tone: 'success' });
    expect(lastToast()!.id).toBeGreaterThan(firstId);
  });

  it('turns a backend error into its readable message', () => {
    showApiError(new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.'));
    expect(lastToast()).toMatchObject({ message: 'Email or password is incorrect.', tone: 'error' });
  });

  it('adds "tries left" when the backend says how many are left', () => {
    showApiError(new ApiError(400, 'INVALID_CODE', 'That code is not correct.', { attemptsLeft: 1 }));
    expect(lastToast()?.message).toBe('That code is not correct. 1 try left.');
  });

  it('copes with errors that are not ApiErrors', () => {
    showApiError(new Error('boom'));
    expect(lastToast()?.message).toBe('boom');
    showApiError('weird');
    expect(lastToast()?.message).toBe('Something went wrong.');
  });
});

describe('ToastHost', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    clearToast();
  });
  afterEach(() => jest.useRealTimers());

  it('shows nothing when there is no toast', async () => {
    const tree = await render(<CustomToastHost />);
    expect(allText(tree)).toEqual([]);
  });

  it('shows the message, and it disappears by itself after a few seconds', async () => {
    const tree = await render(<CustomToastHost />);
    await ReactTestRenderer.act(async () => showToast('Something failed'));
    expect(allText(tree)).toContain('Something failed');
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(allText(tree)).toEqual([]);
  });

  it('a newer toast restarts the timer', async () => {
    const tree = await render(<CustomToastHost />);
    await ReactTestRenderer.act(async () => showToast('one'));
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await ReactTestRenderer.act(async () => showToast('two'));
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(3000); // 6 s since "one", but only 3 s since "two"
    });
    expect(allText(tree)).toContain('two');
  });

  it('tapping it dismisses it', async () => {
    const tree = await render(<CustomToastHost />);
    await ReactTestRenderer.act(async () => showToast('tap me'));
    await ReactTestRenderer.act(async () => tree.root.find((n) => n.props.accessibilityRole === 'alert' && typeof n.props.onPress === 'function').props.onPress());
    expect(useToastStore.getState().toast).toBeNull();
  });
});
