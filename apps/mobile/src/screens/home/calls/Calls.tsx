import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { CustomWrapper } from '@/src/components';
import { COLORS, TEXT } from '@/src/constants';

/** Screen 15 (call history). Not built yet: calls come in the next phase. */
const Calls: React.FC = () => (
  <CustomWrapper contentStyle={styles.content}>
    <Text accessibilityRole="header" style={TEXT.title}>
      Calls
    </Text>
    <Text style={styles.description}>Your call history will appear here.</Text>
  </CustomWrapper>
);

export default Calls;

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 12 },
  description: { fontSize: 16, lineHeight: 24, color: COLORS.inkSecondary },
});
