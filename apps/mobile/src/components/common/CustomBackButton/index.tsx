import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { MIN_TOUCH } from '@/src/constants';
import { BackIcon } from '../CustomIcon';

import type { CustomBackButtonProps } from './interface';

/** The round-edged back arrow with a 44-point touch area. Used alone above forms, and inside CustomHeader. */
export function CustomBackButton({
  onPress,
  label = 'Back',
  color,
  alignToEdge = false,
}: CustomBackButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.button, alignToEdge && styles.alignToEdge]}
    >
      <BackIcon color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alignToEdge: { marginLeft: -10 },
});
