import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

/** Soft background + dark letters, so every person gets a steady colour of their own. */
const TINTS = [
  { bg: '#E3EDE8', ink: '#174A3D' },
  { bg: '#F7EBDD', ink: '#7F3D0A' },
  { bg: '#E4E8F4', ink: '#2A3B7A' },
  { bg: '#F3E3EA', ink: '#7A2A4B' },
];

export const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

/** Same id -> same colour, every time (a tiny hash of the id picks the tint). */
const tintFor = (id: string) => TINTS[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % TINTS.length];

interface Props {
  id: string;
  name: string;
  /** Small dot at the corner: green = available now, grey = not. Omit for no dot. */
  online?: boolean;
}

export function Avatar({ id, name, online }: Props) {
  const tint = tintFor(id);
  return (
    <View style={styles.wrap}>
      <View style={[styles.circle, { backgroundColor: tint.bg }]}>
        <Text style={[styles.letters, { color: tint.ink }]}>{initialsOf(name)}</Text>
      </View>
      {online !== undefined && <View style={[styles.dot, { backgroundColor: online ? colors.primary : '#8C938E' }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 48, height: 48 },
  circle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  letters: { fontSize: 16, fontWeight: '700' },
  dot: { position: 'absolute', right: 0, bottom: 0, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: colors.surface },
});
