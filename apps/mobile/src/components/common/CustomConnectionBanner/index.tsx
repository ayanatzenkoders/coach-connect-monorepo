import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { COLORS, MAX_FONT_SCALE, SPACING } from '@/src/constants';
import { useConnectionBanner } from '@/src/utils/hooks/useConnectionBanner';

/**
 * Thin notice under the chat header while the live connection is down. It explains WHY messages may be late
 * (and a failed send shows "Not sent. Tap to retry" separately, on the message itself). Renders nothing when
 * the connection is fine.
 */
export function CustomConnectionBanner() {
  const visible = useConnectionBanner();
  if (!visible) return null;
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.banner}>
      <ActivityIndicator size="small" color={COLORS.warningInk} />
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.text}>
        Connection lost. Reconnecting…
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: 8, paddingHorizontal: SPACING.lg, backgroundColor: COLORS.warningTint },
  text: { flexShrink: 1, fontSize: 13, color: COLORS.warningInk },
});
