import type { TextInput } from 'react-native';

export interface CustomOTPInputProps {
  value: string;
  /** Called with ONLY the digits typed or pasted (max 6). */
  onChangeText: (digits: string) => void;
  /** Turns the boxes red. */
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Lets a screen move the cursor back into the code after a mistake. */
  inputRef?: React.Ref<React.ComponentRef<typeof TextInput>>;
}
