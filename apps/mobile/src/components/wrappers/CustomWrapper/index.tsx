import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/src/constants';
import type { CustomWrapperProps } from './interface';

/**
 * Root element of a screen: background colour, safe-area top padding, optional keyboard avoiding and
 * optional scrolling. Screens put their content inside it instead of repeating this boilerplate.
 */
const CustomWrapper: React.FC<CustomWrapperProps> = ({ children, scroll = false, keyboardAvoidingView = false, topInset = true, contentStyle }) => {
  const insets = useSafeAreaInsets();
  const padding = topInset ? { paddingTop: insets.top + 12 } : undefined;

  const body = scroll ? (
    <ScrollView contentContainerStyle={[styles.scrollContent, padding, contentStyle]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padding, contentStyle]}>{children}</View>
  );

  if (!keyboardAvoidingView) return <View style={styles.root}>{body}</View>;
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {body}
    </KeyboardAvoidingView>
  );
};

export default CustomWrapper;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
});
