import { StyleSheet } from 'react-native';
import { CustomBackButton } from '@/src/components';
import { COLORS } from '@/src/constants';
import { byLabel, press, render } from '@/test-utils';

jest.mock('react-native-keychain', () => ({}));

describe('CustomBackButton', () => {
  it('says "Back" by default and goes back when pressed', async () => {
    const onPress = jest.fn();
    const tree = await render(<CustomBackButton onPress={onPress} />);
    await press(tree, 'Back');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('can say something more helpful to a screen reader', async () => {
    const tree = await render(<CustomBackButton onPress={jest.fn()} label="Back to sign in" />);
    expect(byLabel(tree, 'Back to sign in')).toBeTruthy();
  });

  it('keeps a 44-point touch area, and only a lone button is pulled to the page edge', async () => {
    const plain = await render(<CustomBackButton onPress={jest.fn()} />);
    const edge = await render(<CustomBackButton onPress={jest.fn()} alignToEdge />);
    const style = (t: typeof plain) => StyleSheet.flatten(byLabel(t, 'Back').props.style);
    expect(style(plain)).toMatchObject({ width: 44, height: 44 });
    expect(style(plain).marginLeft).toBeUndefined();
    expect(style(edge).marginLeft).toBe(-10);
  });

  it('draws the arrow in the normal text colour, or in the colour you pass', async () => {
    const strokeOf = (tree: Awaited<ReturnType<typeof render>>) => tree.root.findAll((n) => (n.type as unknown) === 'Path')[0]!.props.stroke;
    expect(strokeOf(await render(<CustomBackButton onPress={jest.fn()} />))).toBe(COLORS.ink);
    expect(strokeOf(await render(<CustomBackButton onPress={jest.fn()} color={COLORS.onPrimary} />))).toBe(COLORS.onPrimary);
  });
});
