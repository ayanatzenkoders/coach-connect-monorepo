import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Person } from '../api/peopleApi';
import { colors, MIN_TOUCH } from '../theme';
import { Avatar } from './Avatar';
import { MessageIcon, PhoneIcon } from './icons';

/** At most this many specialty tags are drawn; the rest become "+N". */
const MAX_TAGS = 2;

interface Props {
  person: Person;
  onMessage: (person: Person) => void;
  onCall: (person: Person) => void;
}

/** One card of the People list: who they are, what a coach is good at, and the message / call buttons. */
export function PersonRow({ person, onMessage, onCall }: Props) {
  const isCoach = person.role === 'COACH';
  // Members can always be called; a coach only while "available" is switched on.
  const callable = !isCoach || person.available === true;
  const tags = person.specialties ?? [];

  return (
    <View style={styles.card}>
      <View style={styles.who}>
        <Avatar id={person.id} name={person.name} online={isCoach ? person.available : undefined} />
        <View style={styles.texts}>
          <Text style={styles.name} numberOfLines={1}>
            {person.name}
          </Text>
          {isCoach ? (
            <>
              <View style={styles.tags}>
                {tags.slice(0, MAX_TAGS).map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText} numberOfLines={1}>
                      {tag}
                    </Text>
                  </View>
                ))}
                {tags.length > MAX_TAGS && <Text style={styles.more}>+{tags.length - MAX_TAGS}</Text>}
              </View>
              <Text style={[styles.status, { color: person.available ? colors.primary : colors.inkMuted }]}>
                {person.available ? 'Available now' : 'Not available'}
              </Text>
            </>
          ) : (
            <Text style={styles.sub}>Member</Text>
          )}
        </View>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel={`Message ${person.name}`} onPress={() => onMessage(person)} style={styles.iconButton}>
        <MessageIcon color={colors.primary} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={callable ? `Call ${person.name}` : `${person.name} can't take calls right now`}
        accessibilityState={{ disabled: !callable }}
        disabled={!callable}
        onPress={() => onCall(person)}
        style={[styles.iconButton, callable ? styles.callEnabled : styles.callDisabled]}>
        <PhoneIcon color={callable ? colors.primary : '#8C938E'} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
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
  name: { fontSize: 16, fontWeight: '600', color: colors.ink },
  sub: { fontSize: 14, color: colors.inkSecondary },
  tags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: colors.primaryTint, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, maxWidth: 150 },
  tagText: { fontSize: 12, fontWeight: '600', color: colors.primaryPressed },
  more: { fontSize: 12, fontWeight: '600', color: colors.inkMuted },
  status: { fontSize: 13, fontWeight: '600' },
  iconButton: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  callEnabled: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  callDisabled: { borderWidth: 1, borderColor: '#E4E7E1', backgroundColor: colors.background },
});
