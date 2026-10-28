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

/**
 * Up to two initials from the first two words that start with a letter or digit.
 * Works per CHARACTER (code point), not per UTF-16 unit: an emoji is two units, and cutting it in half
 * draws a broken "?" glyph. Words made only of symbols or emoji are skipped, e.g. "Zoë 🌟 Åström" -> "ZÅ".
 */
export const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((word) => Array.from(word)[0] ?? '') // first whole character of the word
    .filter((char) => /[\p{L}\p{N}]/u.test(char))
    .slice(0, 2)
    .map((char) => char.toUpperCase())
    .join('') || '?';

/** Same id -> same colour, every time (a tiny hash of the id picks the tint). */
const tintFor = (id: string) => TINTS[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % TINTS.length];

export function CustomAvatar({ id, name, online, size = 48 }: CustomAvatarProps) {
  const tint = tintFor(id);
  return (
    // flexShrink 0: in a crowded row the circle must stay round instead of being squeezed (which clips the letters).
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: tint.bg }]}>
        <Text allowFontScaling={false} style={[styles.letters, { color: tint.ink, fontSize: size * 0.34 }]}>{initialsOf(name)}</Text>
      </View>
      {online !== undefined && <View style={[styles.dot, online ? styles.dotOnline : styles.dotOffline]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexShrink: 0 },
  circle: { alignItems: 'center', justifyContent: 'center' },
  letters: { fontWeight: '700' },
  dotOnline: { backgroundColor: COLORS.primary },
  dotOffline: { backgroundColor: '#8C938E' },
  dot: { position: 'absolute', right: 0, bottom: 0, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: COLORS.surface },
});
