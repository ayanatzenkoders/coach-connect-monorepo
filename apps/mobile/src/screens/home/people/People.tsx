import React, { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomPersonRow, SearchIcon } from '@/src/components';
import { COLORS, MAX_FONT_SCALE, SPACING, TEXT } from '@/src/constants';
import type { Person } from '@/src/service/api/people.api';
import { usePeople } from './hook/usePeople';

/** Screen 07: the Coaches / Members tabs, search, coach filters and the list. */
const People: React.FC = () => {
  const insets = useSafeAreaInsets();
  const p = usePeople();

  // New results for a different search/filter: start at the top. Otherwise the old scroll position can land
  // half-way down a shorter list, or on empty space, which looks like the list jumping.
  const listRef = useRef<FlatList>(null);
  const shownKey = useRef(p.resultsKey);
  useEffect(() => {
    if (p.stale || shownKey.current === p.resultsKey) return; // still the old rows, or nothing changed
    shownKey.current = p.resultsKey;
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [p.stale, p.resultsKey]);

  const { message, call } = p;
  const renderPerson = useCallback(({ item }: { item: Person }) => <CustomPersonRow person={item} onMessage={message} onCall={call} />, [message, call]);

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.title} style={styles.title}>
          People
        </Text>

        <View accessibilityRole="tablist" style={styles.segments}>
          {(['coaches', 'members'] as const).map((k) => (
            <Pressable
              key={k}
              accessibilityRole="tab"
              accessibilityLabel={k === 'coaches' ? 'Coaches' : 'Members'}
              accessibilityState={{ selected: p.kind === k }}
              onPress={() => p.setKind(k)}
              style={[styles.segment, p.kind === k && styles.segmentOn]}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.segmentText}>
                {k === 'coaches' ? 'Coaches' : 'Members'}
                {p.kind === k && !p.loading ? <Text style={styles.segmentCount}> {p.total}</Text> : null}
              </Text>
            </Pressable>
          ))}
        </View>

        <View>
          <View style={styles.searchIcon} pointerEvents="none">
            <SearchIcon color={COLORS.inkMuted} size={20} />
          </View>
          <TextInput
            accessibilityLabel="Search people"
            value={p.search}
            onChangeText={p.setSearch}
            placeholder={p.isCoaches ? 'Search coaches' : 'Search members'}
            placeholderTextColor={COLORS.inkMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            maxFontSizeMultiplier={MAX_FONT_SCALE.control}
            style={styles.search}
          />
        </View>

        {p.isCoaches && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Filter coaches" contentContainerStyle={styles.chips} style={styles.chipScroll}>
            <Chip label="Available now" on={p.availableOnly} onPress={p.toggleAvailableOnly} />
            {p.specialties.map((s) => (
              <Chip key={s} label={s} on={p.specialty === s} onPress={() => p.toggleSpecialty(s)} />
            ))}
          </ScrollView>
        )}
      </View>

      <FlatList
        ref={listRef}
        data={p.items}
        keyExtractor={keyOfPerson}
        renderItem={renderPerson}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReached={p.loadMore}
        onEndReachedThreshold={0.5}
        refreshing={p.refreshing}
        onRefresh={p.refresh}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {!p.isCoaches && (
              <View style={styles.hint}>
                <Text style={styles.hintText}>Calls between members are one-to-one. When you call a coach, you can bring up to 4 members into the call.</Text>
              </View>
            )}
            {!p.loading && p.items.length > 0 && (
              <Text style={TEXT.small}>
                {p.total} {p.noun}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          p.loading ? (
            <ActivityIndicator accessibilityLabel="Loading people" color={COLORS.primary} style={styles.loader} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{p.filtered ? `No ${p.kind} match that` : `No ${p.kind} yet`}</Text>
              <Text style={styles.emptyText}>{p.filtered ? 'Try a different name, or clear the filters.' : 'Check back soon.'}</Text>
            </View>
          )
        }
        ListFooterComponent={p.loadingMore ? <ActivityIndicator color={COLORS.primary} style={styles.loader} /> : undefined}
        ItemSeparatorComponent={Gap}
      />
    </View>
  );
};

export default People;

const Gap = () => <View style={styles.gap} />;
const keyOfPerson = (person: Person) => person.id;

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Filter: ${label}`}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.chip, on && styles.chipOn]}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={[styles.chipText, on && styles.chipTextOn]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gap: { height: 10 },
  flex: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingBottom: 12, gap: 14 },
  title: { fontSize: 32, fontWeight: '600', letterSpacing: -0.64, color: COLORS.ink },
  segments: { flexDirection: 'row', padding: 4, borderRadius: 12, backgroundColor: '#E4E7E1', gap: 4 },
  segment: { flex: 1, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: COLORS.surface, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentText: { fontSize: 15, fontWeight: '600', color: COLORS.ink },
  // tabular-nums: every digit is the same width, so "Coaches 3" -> "Coaches 1" does not nudge the label sideways.
  segmentCount: { color: COLORS.inkSecondary, fontWeight: '500', fontVariant: ['tabular-nums'] },
  searchIcon: { position: 'absolute', left: 14, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 },
  search: {
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingLeft: 44,
    paddingRight: SPACING.lg,
    backgroundColor: COLORS.surface,
    color: COLORS.ink,
    fontSize: 16,
  },
  chipScroll: { marginHorizontal: -20 },
  chips: { paddingHorizontal: 20, gap: 8, paddingBottom: 2 },
  chip: { height: 40, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, justifyContent: 'center' },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  chipTextOn: { color: COLORS.onPrimary },
  list: { paddingHorizontal: 20, paddingBottom: 20, flexGrow: 1 },
  listHeader: { gap: 10, paddingBottom: 10 },
  hint: { padding: 12, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.divider },
  hintText: { fontSize: 14, lineHeight: 20, color: COLORS.inkSecondary },
  loader: { marginTop: 32 },
  empty: { paddingVertical: 40, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: COLORS.ink },
  emptyText: { fontSize: 14, color: COLORS.inkSecondary, textAlign: 'center' },
});
