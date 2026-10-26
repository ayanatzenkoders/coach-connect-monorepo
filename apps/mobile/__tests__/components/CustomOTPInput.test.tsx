import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { CustomOTPInput } from '@/src/components/common/CustomOTPInput';
import { CODE_LENGTH } from '@/src/constants';

describe('CodeInput', () => {
  it('passes up only digits, at most six, whatever is typed or pasted', async () => {
    const onChangeText = jest.fn();
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<CustomOTPInput value="" onChangeText={onChangeText} />);
    });
    const input = tree.root.find((n) => n.props.accessibilityLabel === 'Verification code' && typeof n.props.onChangeText === 'function');
    input.props.onChangeText('48-21 9a0 77');
    expect(onChangeText).toHaveBeenCalledWith('482190');
    expect('482190'.length).toBe(CODE_LENGTH);
  });

  it('draws one box per digit', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<CustomOTPInput value="12" onChangeText={() => {}} />);
    });
    const digits = tree.root.findAll((n) => (n.type as unknown) === 'Text').map((n) => n.props.children);
    expect(digits.slice(0, 2)).toEqual(['1', '2']);
    expect(digits).toHaveLength(CODE_LENGTH);
  });
});
