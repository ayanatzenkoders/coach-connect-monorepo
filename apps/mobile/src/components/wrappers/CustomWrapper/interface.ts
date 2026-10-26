import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface CustomWrapperProps {
  children: ReactNode;
  /** Wrap the content in a ScrollView (forms). Default: a plain View. */
  scroll?: boolean;
  /** Lift the content above the keyboard (screens with text inputs). */
  keyboardAvoidingView?: boolean;
  /** Add the top safe-area inset plus a little room (screens without a native header). Default true. */
  topInset?: boolean;
  /** Extra style for the content container. */
  contentStyle?: StyleProp<ViewStyle>;
}
