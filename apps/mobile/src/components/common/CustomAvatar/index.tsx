import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '@/src/constants';

import type { CustomAvatarProps } from './interface';

/** Soft background + dark letters, so every person gets a steady colour of their own. */
const TINTS = [
  { bg: '#E3EDE8', ink: '#174A3D' },
  { bg: '#F7EBDD', ink: '#7F3D0A' },
  { bg: '#E4E8F4', ink: '#2A3B7A' },
  { bg: '#F3E3EA', ink: '#7A2A4B' },
];

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

/** Same id -> same colour, every time (a tiny hash of the id picks the tint). */
const tintFor = (id: string) => TINTS[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % TINTS.length];

export function CustomAvatar({ id, name, online, size = 48 }: CustomAvatarProps) {
  const tint = tintFor(id);
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: tint.bg }]}>
        <Text style={[styles.letters, { color: tint.ink, fontSize: size * 0.34 }]}>{initialsOf(name)}</Text>
      </View>
      {online !== undefined && <View style={[styles.dot, online ? styles.dotOnline : styles.dotOffline]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  letters: { fontWeight: '700' },
  dotOnline: { backgroundColor: COLORS.primary },
  dotOffline: { backgroundColor: '#8C938E' },
  dot: { position: 'absolute', right: 0, bottom: 0, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: COLORS.surface },
});
