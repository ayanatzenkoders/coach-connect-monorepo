import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CheckIcon, CustomAvatar, SearchIcon } from '@/src/components';
import { COLORS, MAX_FONT_SCALE, RADIUS, SPACING, TEXT } from '@/src/constants';
import type { Person } from '@/src/service/api/people.api';
import type { usePeoplePicker } from './hook/usePeoplePicker';

type Picker = ReturnType<typeof usePeoplePicker>;

export const keyOfPerson = (person: Person) => person.id;
export const Divider = () => <View style={styles.divider} />;

/** What shows under the form while picking people: the count, the chosen chips, Coaches/Members and the search box. */
export function PickerControls({ picker, summary, needsMore }: { picker: Picker; summary: string; needsMore: boolean }) {
  return (
    <>
      <View style={styles.section}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={TEXT.label}>
          Add people
        </Text>
        <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={[TEXT.small, needsMore && styles.hintNeed]}>
          {summary}
        </Text>
        {picker.chosen.length > 0 && (
          <View style={styles.chips}>
            {picker.chosen.map((p) => (
              <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`} onPress={() => picker.toggle(p)} style={styles.chip}>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.chipText} numberOfLines={1}>
                  {p.name}  ✕
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {picker.canPickCoaches && (
        <View accessibilityRole="tablist" style={styles.segments}>
          {(['members', 'coaches'] as const).map((k) => (
            <Pressable
              key={k}
              accessibilityRole="tab"
              accessibilityLabel={k === 'coaches' ? 'Pick from coaches' : 'Pick from members'}
              accessibilityState={{ selected: picker.kind === k }}
              onPress={() => picker.setKind(k)}
              style={[styles.segment, picker.kind === k && styles.segmentOn]}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.segmentText}>
                {k === 'coaches' ? 'Coaches' : 'Members'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View>
        <View style={styles.searchIcon} pointerEvents="none">
          <SearchIcon color={COLORS.inkMuted} size={20} />
        </View>
        <TextInput
          accessibilityLabel="Search people to add"
          value={picker.search}
          onChangeText={picker.setSearch}
          placeholder={picker.kind === 'coaches' ? 'Search coaches' : 'Search members'}
          placeholderTextColor={COLORS.inkMuted}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          maxFontSizeMultiplier={MAX_FONT_SCALE.control}
          style={styles.search}
        />
      </View>
    </>
  );
}

export const PickEmpty = ({ loading }: { loading: boolean }) =>
  loading ? <ActivityIndicator accessibilityLabel="Loading people" color={COLORS.primary} style={styles.loader} /> : <Text style={styles.empty}>No one found.</Text>;

export const PickFooter = ({ loadingMore }: { loadingMore: boolean }) => (loadingMore ? <ActivityIndicator color={COLORS.primary} style={styles.loader} /> : null);

/** One person to pick: a check circle on the right. A row that would break a rule is dimmed and says why. */
export function PickRow({ person, chosen, disabledReason, onPress }: { person: Person; chosen: boolean; disabledReason: string | null; onPress: (person: Person) => void }) {
  const blocked = disabledReason !== null;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={`${chosen ? 'Remove' : 'Add'} ${person.name}`}
      accessibilityState={{ checked: chosen, disabled: blocked }}
      disabled={blocked}
      onPress={() => onPress(person)}
      style={[styles.row, blocked && styles.rowOff]}>
      <CustomAvatar id={person.id} name={person.name} size={44} />
      <View style={styles.rowText}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.rowName} numberOfLines={1}>
          {person.name}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.rowSub} numberOfLines={1}>
          {disabledReason ?? (person.role === 'COACH' ? 'Coach' : 'Member')}
        </Text>
      </View>
      <View style={[styles.check, chosen && styles.checkOn]}>{chosen ? <CheckIcon color={COLORS.onPrimary} size={16} /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: 6 },
  hintNeed: { color: COLORS.warningInk },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.primaryTint },
  chipText: { fontSize: 14, fontWeight: '600', color: COLORS.primaryPressed },
  segments: { flexDirection: 'row', padding: 4, borderRadius: RADIUS.control, backgroundColor: '#E4E7E1', gap: 4 },
  segment: { flex: 1, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: COLORS.surface },
  segmentText: { fontSize: 15, fontWeight: '600', color: COLORS.ink },
  searchIcon: { position: 'absolute', left: 14, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 },
  search: { height: 48, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.control, paddingLeft: 44, paddingRight: SPACING.lg, backgroundColor: COLORS.surface, color: COLORS.ink, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: COLORS.surface },
  rowOff: { opacity: 0.45 },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 16, fontWeight: '600', color: COLORS.ink },
  rowSub: { fontSize: 13, color: COLORS.inkSecondary },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  divider: { height: 1, backgroundColor: COLORS.divider, marginLeft: 76 },
  loader: { marginTop: 24 },
  empty: { textAlign: 'center', color: COLORS.inkSecondary, paddingVertical: 32 },
});
