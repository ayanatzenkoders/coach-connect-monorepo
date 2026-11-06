import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, MAX_FONT_SCALE } from '@/src/constants';
import { CustomBackButton } from '../CustomBackButton';

import type { CustomHeaderProps } from './interface';

/**
 * The top bar of a screen that is opened on top of the tabs: back arrow, a title (or your own middle part), and
 * optional buttons on the right. It keeps clear of the notch / Dynamic Island by itself.
 */
export function CustomHeader({
  onBack,
  backLabel = 'Back',
  title,
  children,
  right,
}: CustomHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
      <CustomBackButton onPress={onBack} label={backLabel} />
      {children ?? (
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={MAX_FONT_SCALE.control}
          style={styles.title}
        >
          {title}
        </Text>
      )}
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    paddingBottom: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  title: { fontSize: 18, fontWeight: '600', color: COLORS.ink },
});
