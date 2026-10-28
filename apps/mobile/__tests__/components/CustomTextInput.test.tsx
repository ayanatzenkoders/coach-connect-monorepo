import ReactTestRenderer from 'react-test-renderer';
import { CustomTextInput } from '@/src/components';
import { has, press, render, typeInto } from '@/test-utils';

type Tree = Awaited<ReturnType<typeof render>>;
const input = (tree: Tree, label: string) => tree.root.find((n) => n.props.accessibilityLabel === label && typeof n.props.onChangeText === 'function');

describe('CustomTextInput: password field', () => {
  const Password = ({ value = '' }: { value?: string }) => <CustomTextInput label="Password" value={value} onChangeText={() => {}} secureTextEntry />;

  it('starts hidden, with an eye button to show it', async () => {
    const tree = await render(<Password value="Secret123" />);
    expect(input(tree, 'Password').props.secureTextEntry).toBe(true);
    expect(has(tree, 'Show password')).toBe(true);
    expect(has(tree, 'Hide password')).toBe(false);
  });

  it('shows what was typed when the eye is tapped, and hides it again on a second tap', async () => {
    const tree = await render(<Password value="Secret123" />);
    await press(tree, 'Show password');
    expect(input(tree, 'Password').props.secureTextEntry).toBe(false);
    expect(has(tree, 'Hide password')).toBe(true);
    await press(tree, 'Hide password');
    expect(input(tree, 'Password').props.secureTextEntry).toBe(true);
    expect(has(tree, 'Show password')).toBe(true);
  });

  it('keeps the text and keeps working while it is visible', async () => {
    const onChange = jest.fn();
    const tree = await render(<CustomTextInput label="Password" value="abc" onChangeText={onChange} secureTextEntry />);
    await press(tree, 'Show password');
    expect(input(tree, 'Password').props.value).toBe('abc');
    await typeInto(tree, 'Password', 'abcd');
    expect(onChange).toHaveBeenCalledWith('abcd');
  });

  it('each password field has its own eye', async () => {
    const tree = await render(
      <>
        <CustomTextInput label="Password" value="a" onChangeText={() => {}} secureTextEntry />
        <CustomTextInput label="Repeat password" value="a" onChangeText={() => {}} secureTextEntry />
      </>,
    );
    const eyes = tree.root.findAll((n) => n.props.accessibilityLabel === 'Show password' && typeof n.props.onPress === 'function');
    expect(eyes).toHaveLength(2);
    await ReactTestRenderer.act(async () => eyes[0]!.props.onPress());
    expect(input(tree, 'Password').props.secureTextEntry).toBe(false);
    expect(input(tree, 'Repeat password').props.secureTextEntry).toBe(true);
  });

  it('other fields (email, name) have no eye button', async () => {
    const tree = await render(<CustomTextInput label="Email" value="a@b.co" onChangeText={() => {}} keyboardType="email-address" />);
    expect(has(tree, 'Show password')).toBe(false);
    expect(input(tree, 'Email').props.secureTextEntry).toBeFalsy();
  });
});
