import { Text } from 'react-native';
import { CustomHeader } from '@/src/components';
import { allText, byLabel, press, render } from '@/test-utils';

jest.mock('react-native-keychain', () => ({}));

describe('CustomHeader', () => {
  it('shows a back arrow and the title as a heading', async () => {
    const onBack = jest.fn();
    const tree = await render(<CustomHeader title="Group info" onBack={onBack} />);
    expect(allText(tree)).toEqual(['Group info']);
    expect(tree.root.findAll((n) => n.props.accessibilityRole === 'header' && (n.type as unknown) === 'Text')).toHaveLength(1);
    await press(tree, 'Back');
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('the back arrow can have its own spoken label', async () => {
    const tree = await render(<CustomHeader title="x" onBack={jest.fn()} backLabel="Back to messages" />);
    expect(byLabel(tree, 'Back to messages')).toBeTruthy();
  });

  it('your own middle part replaces the title, and buttons can sit on the right', async () => {
    const tree = await render(
      <CustomHeader onBack={jest.fn()} title="ignored" right={<Text>right button</Text>}>
        <Text>Amara Okafor</Text>
      </CustomHeader>,
    );
    expect(allText(tree)).toEqual(['Amara Okafor', 'right button']); // no "ignored": the middle part took its place
  });

  it('keeps clear of the notch: 6 points below the top safe-area inset', async () => {
    const tree = await render(<CustomHeader title="x" onBack={jest.fn()} />);
    const bar = tree.root.findAll((n) => Array.isArray(n.props.style) && n.props.style.some((s: { paddingTop?: number }) => s && s.paddingTop !== undefined))[0]!;
    // The mocked safe area has no notch, so the padding is just the 6 points.
    expect(bar.props.style.find((s: { paddingTop?: number }) => s && s.paddingTop !== undefined).paddingTop).toBe(6);
  });
});
