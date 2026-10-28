import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, MAX_FONT_SCALE, MIN_TOUCH } from '@/src/constants';
import { CustomAvatar } from '@/src/components/common/CustomAvatar';
import { MessageIcon, PhoneIcon } from '@/src/components/common/CustomIcon';

import type { CustomPersonRowProps } from './interface';

/** At most this many specialty tags are drawn; the rest become "+N". */
const MAX_TAGS = 2;

/** One card of the People list: who they are, what a coach is good at, and the message / call buttons. */
// memo: a row is redrawn only when its person (or the handlers) change, not when the search box or another row does.
export const CustomPersonRow = memo(function PersonRow({ person, onMessage, onCall }: CustomPersonRowProps) {
  const isCoach = person.role === 'COACH';
  // Members can always be called; a coach only while "available" is switched on.
  const callable = !isCoach || person.available === true;
  const tags = person.specialties ?? [];

  return (
    <View style={styles.card}>
      <View style={styles.who}>
        <CustomAvatar id={person.id} name={person.name} online={isCoach ? person.available : undefined} />
        <View style={styles.texts}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.name} numberOfLines={1}>
            {person.name}
          </Text>
          {isCoach ? (
            <>
              <View style={styles.tags}>
                {tags.slice(0, MAX_TAGS).map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.tagText} numberOfLines={1}>
                      {tag}
                    </Text>
                  </View>
                ))}
                {tags.length > MAX_TAGS && <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.more}>+{tags.length - MAX_TAGS}</Text>}
              </View>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={[styles.status, { color: person.available ? COLORS.primary : COLORS.inkMuted }]}>
                {person.available ? 'Available now' : 'Not available'}
              </Text>
            </>
          ) : (
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.sub}>
              Member
            </Text>
          )}
        </View>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel={`Message ${person.name}`} onPress={() => onMessage(person)} style={styles.iconButton}>
        <MessageIcon color={COLORS.primary} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={callable ? `Call ${person.name}` : `${person.name} can't take calls right now`}
        accessibilityState={{ disabled: !callable }}
        disabled={!callable}
        onPress={() => onCall(person)}
        style={[styles.iconButton, callable ? styles.callEnabled : styles.callDisabled]}>
        <PhoneIcon color={callable ? COLORS.primary : '#8C938E'} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: 16,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  who: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  texts: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontSize: 16, fontWeight: '600', color: COLORS.ink },
  sub: { fontSize: 14, color: COLORS.inkSecondary },
  tags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: COLORS.primaryTint, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, maxWidth: 150 },
  tagText: { fontSize: 12, fontWeight: '600', color: COLORS.primaryPressed },
  more: { fontSize: 12, fontWeight: '600', color: COLORS.inkMuted },
  status: { fontSize: 13, fontWeight: '600' },
  iconButton: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  callEnabled: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  callDisabled: { borderWidth: 1, borderColor: '#E4E7E1', backgroundColor: COLORS.background },
});
