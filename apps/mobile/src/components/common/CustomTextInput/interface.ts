import type React from 'react';
import type { TextInputProps } from 'react-native';

export interface CustomTextInputProps
  extends Pick<
    TextInputProps,
    'value' | 'onChangeText' | 'secureTextEntry' | 'keyboardType' | 'autoComplete' | 'autoCapitalize' | 'textContentType' | 'returnKeyType' | 'onSubmitEditing'
  > {
  label: string;
  /** Message shown under the field; also turns the border red. */
  error?: string;
  /** Extra element on the label row, e.g. a "Forgot password?" link. */
  labelRight?: React.ReactNode;
}
