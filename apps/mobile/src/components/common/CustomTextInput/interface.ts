import type { TextInputProps } from 'react-native';

export interface CustomTextInputProps
  extends Pick<
    TextInputProps,
    'value' | 'onChangeText' | 'secureTextEntry' | 'keyboardType' | 'autoComplete' | 'autoCapitalize' | 'textContentType' | 'returnKeyType' | 'onSubmitEditing' | 'multiline' | 'maxLength' | 'placeholder'
  > {
  label: string;
  /** Message shown under the field; also turns the border red. */
  error?: string;
}
