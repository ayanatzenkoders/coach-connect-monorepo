import React from 'react';
import ReactTestRenderer, { ReactTestInstance } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useToastStore } from '@/src/store/toast.store';

export { focusState, navigationMock, resetNavigationMock, screenProps } from './navigation';

export type Tree = ReactTestRenderer.ReactTestRenderer;

const mounted: Tree[] = [];

/** Remember a rendered tree so it is unmounted after the test (timers and listeners stop with it). */
export const track = (tree: Tree): Tree => {
  mounted.push(tree);
  return tree;
};

/** Unmount every tree this test rendered. jest.setup.after.js calls it after each test. */
export const unmountAll = () => {
  ReactTestRenderer.act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
};

/** A fresh React Query client per test: no retries, nothing cached between tests. */
export const testQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });

/** Render (inside a React Query provider, like the real app) and wait for the first effects to settle. */
export async function render(element: React.ReactElement): Promise<Tree> {
  let tree!: Tree;
  const client = testQueryClient();
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
  });
  return track(tree);
}

const isTappableOrTypeable = (n: ReactTestInstance) => typeof n.props.onPress === 'function' || typeof n.props.onChangeText === 'function';

/**
 * The tappable / typeable element with this accessibility label. In a real navigator the earlier screens
 * of the stack stay mounted underneath, so when several match, the LAST one (the top screen) is meant.
 */
export const byLabel = (tree: Tree, label: string): ReactTestInstance => {
  const matches = tree.root.findAll((n) => n.props.accessibilityLabel === label && isTappableOrTypeable(n));
  if (matches.length === 0) throw new Error(`No tappable element labelled "${label}"`);
  return matches[matches.length - 1]!;
};

/** Is there such an element on screen? */
export const has = (tree: Tree, label: string): boolean =>
  tree.root.findAll((n) => n.props.accessibilityLabel === label && isTappableOrTypeable(n)).length > 0;

/** All visible text, one string per <Text>. */
export const allText = (tree: Tree): string[] =>
  tree.root.findAll((n) => (n.type as unknown) === 'Text').map((n) => [n.props.children].flat().join(''));

export const typeInto = (tree: Tree, label: string, value: string) =>
  ReactTestRenderer.act(async () => byLabel(tree, label).props.onChangeText(value));

export const press = (tree: Tree, label: string) => ReactTestRenderer.act(async () => byLabel(tree, label).props.onPress());

/** Find a Pressable by the text inside it (for links without an accessibility label). */
export const pressText = (tree: Tree, label: string) =>
  ReactTestRenderer.act(async () =>
    tree.root
      .find((n) => typeof n.props.onPress === 'function' && n.findAll((c) => (c.type as unknown) === 'Text' && [c.props.children].flat().join('') === label).length > 0)
      .props.onPress(),
  );

/** Let `seconds` pass one second at a time (each tick re-renders and arms the next timer). */
export const tick = async (seconds: number) => {
  for (let i = 0; i < seconds; i++) {
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(1000);
    });
  }
};

export const lastToast = () => useToastStore.getState().toast;
export const clearToast = () => useToastStore.getState().hide();
