import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, text } from '../theme';

/** Stand-in for a tab that is not built yet (Messages, Calls). */
export function PlaceholderScreen({ title, description }: { title: string; description: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.flex, { paddingTop: insets.top + 12 }]}>
      <Text accessibilityRole="header" style={text.title}>
        {title}
      </Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20, gap: 12 },
  description: { fontSize: 16, lineHeight: 24, color: colors.inkSecondary },
});
