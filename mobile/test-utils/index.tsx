import React from 'react';
import ReactTestRenderer, { ReactTestInstance } from 'react-test-renderer';
import { useToastStore } from '../src/toast/toastStore';

export type Tree = ReactTestRenderer.ReactTestRenderer;

/** Render and wait for the first effects to settle. */
export async function render(element: React.ReactElement): Promise<Tree> {
  let tree!: Tree;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(element);
  });
  return tree;
}

const isTappableOrTypeable = (n: ReactTestInstance) => typeof n.props.onPress === 'function' || typeof n.props.onChangeText === 'function';

/** The tappable / typeable element with this accessibility label. */
export const byLabel = (tree: Tree, label: string): ReactTestInstance =>
  tree.root.find((n) => n.props.accessibilityLabel === label && isTappableOrTypeable(n));

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
