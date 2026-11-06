import { CustomSegmentedControl } from '@/src/components';
import { allText, press, render } from '@/test-utils';

jest.mock('react-native-keychain', () => ({}));

type Kind = 'coaches' | 'members';
const OPTIONS = [
  { value: 'coaches', label: 'Coaches' },
  { value: 'members', label: 'Members', accessibilityLabel: 'Pick from members' },
] as const;

const open = (value: Kind, onChange = jest.fn()) => render(<CustomSegmentedControl<Kind> options={OPTIONS} value={value} onChange={onChange} />);
const selected = (tree: Awaited<ReturnType<typeof open>>) =>
  tree.root.findAll((n) => n.props.accessibilityRole === 'tab' && typeof n.props.onPress === 'function' && n.props.accessibilityState?.selected).map((n) => n.props.accessibilityLabel);

describe('CustomSegmentedControl', () => {
  it('shows every option as a tab inside one tab list', async () => {
    const tree = await open('coaches');
    expect(allText(tree)).toEqual(['Coaches', 'Members']);
    expect(tree.root.findAll((n) => n.props.accessibilityRole === 'tablist' && (n.type as unknown) === 'View')).toHaveLength(1);
  });

  it('marks only the chosen one as selected', async () => {
    expect(selected(await open('coaches'))).toEqual(['Coaches']);
    expect(selected(await open('members'))).toEqual(['Pick from members']);
  });

  it('a screen reader hears the label you give, or the text when you give none', async () => {
    const tree = await open('coaches');
    const labels = tree.root.findAll((n) => n.props.accessibilityRole === 'tab' && typeof n.props.onPress === 'function').map((n) => n.props.accessibilityLabel);
    expect(labels).toEqual(['Coaches', 'Pick from members']);
  });

  it('tapping a segment reports its VALUE (not its text)', async () => {
    const onChange = jest.fn();
    const tree = await open('coaches', onChange);
    await press(tree, 'Pick from members');
    expect(onChange).toHaveBeenCalledWith('members');
  });

  it('tapping the one that is already chosen reports it too (the screen decides what to do)', async () => {
    const onChange = jest.fn();
    const tree = await open('coaches', onChange);
    await press(tree, 'Coaches');
    expect(onChange).toHaveBeenCalledWith('coaches');
  });
});
