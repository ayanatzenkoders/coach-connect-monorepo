import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '@/src/store/toast.store';
import { COLORS, RADIUS, SPACING } from '@/src/constants';

const VISIBLE_MS = 4500;

/**
 * Draws the current toast over every screen. Mounted ONCE in App.tsx. Tap it to dismiss,
 * otherwise it disappears by itself.
 */
export function CustomToastHost() {
  const toast = useToastStore((s) => s.toast);
  const hide = useToastStore((s) => s.hide);
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return;
    slide.setValue(0);
    Animated.timing(slide, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(hide, VISIBLE_MS);
    return () => clearTimeout(timer); // a newer toast (new id) restarts the countdown
  }, [toast, hide, slide]);

  if (!toast) return null;
  const background = toast.tone === 'success' ? COLORS.primary : toast.tone === 'info' ? COLORS.ink : COLORS.error;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { top: insets.top + SPACING.sm, opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] },
      ]}>
      <Pressable
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        accessibilityLabel={toast.message}
        onPress={hide}
        style={[styles.toast, { backgroundColor: background }]}>
        <Text style={styles.text}>{toast.message}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: SPACING.lg, right: SPACING.lg, zIndex: 1000, alignItems: 'center' },
  toast: {
    width: '100%',
    borderRadius: RADIUS.control,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: { color: COLORS.onPrimary, fontSize: 15, lineHeight: 21, fontWeight: '500' },
});
