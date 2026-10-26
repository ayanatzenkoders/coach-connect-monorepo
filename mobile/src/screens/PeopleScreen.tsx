import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Person } from '../api/peopleApi';
import { SearchIcon } from '../components/icons';
import { PersonRow } from '../components/PersonRow';
import { usePeople } from '../hooks/usePeople';
import { colors, spacing, text } from '../theme';

type Kind = 'coaches' | 'members';

interface Props {
  onMessage: (person: Person) => void;
  onCall: (person: Person) => void;
}

/** Screen 07: the Coaches / Members tabs, search, coach filters and the list. */
export function PeopleScreen({ onMessage, onCall }: Props) {
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<Kind>('coaches');
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState<string | undefined>();
  const [availableOnly, setAvailableOnly] = useState(false);
  const people = usePeople({ kind, q: search, specialty, availableOnly });

  const isCoaches = kind === 'coaches';
  const noun = isCoaches ? (people.total === 1 ? 'coach' : 'coaches') : people.total === 1 ? 'member' : 'members';
  const filtered = search.trim() !== '' || !!specialty || availableOnly;

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text accessibilityRole="header" style={styles.title}>
          People
        </Text>

        <View accessibilityRole="tablist" style={styles.segments}>
          {(['coaches', 'members'] as const).map((k) => (
            <Pressable
              key={k}
              accessibilityRole="tab"
              accessibilityLabel={k === 'coaches' ? 'Coaches' : 'Members'}
              accessibilityState={{ selected: kind === k }}
              onPress={() => setKind(k)}
              style={[styles.segment, kind === k && styles.segmentOn]}>
              <Text style={styles.segmentText}>
                {k === 'coaches' ? 'Coaches' : 'Members'}
                {kind === k && !people.loading ? <Text style={styles.segmentCount}> {people.total}</Text> : null}
              </Text>
            </Pressable>
          ))}
        </View>

        <View>
          <View style={styles.searchIcon} pointerEvents="none">
            <SearchIcon color={colors.inkMuted} size={20} />
          </View>
          <TextInput
            accessibilityLabel="Search people"
            value={search}
            onChangeText={setSearch}
            placeholder={isCoaches ? 'Search coaches' : 'Search members'}
            placeholderTextColor={colors.inkMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={styles.search}
          />
        </View>

        {isCoaches && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Filter coaches" contentContainerStyle={styles.chips} style={styles.chipScroll}>
            <Chip label="Available now" on={availableOnly} onPress={() => setAvailableOnly((v) => !v)} />
            {people.specialties.map((s) => (
              <Chip key={s} label={s} on={specialty === s} onPress={() => setSpecialty(specialty === s ? undefined : s)} />
            ))}
          </ScrollView>
        )}
      </View>

      <FlatList
        data={people.items}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PersonRow person={item} onMessage={onMessage} onCall={onCall} />}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReached={people.loadMore}
        onEndReachedThreshold={0.5}
        refreshing={people.loading && people.items.length > 0}
        onRefresh={people.refresh}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {!isCoaches && (
              <View style={styles.hint}>
                <Text style={styles.hintText}>Calls between members are one-to-one. When you call a coach, you can bring up to 4 members into the call.</Text>
              </View>
            )}
            {!people.loading && people.items.length > 0 && (
              <Text style={text.small}>
                {people.total} {noun}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          people.loading ? (
            <ActivityIndicator accessibilityLabel="Loading people" color={colors.primary} style={styles.loader} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{filtered ? `No ${kind} match that` : `No ${kind} yet`}</Text>
              <Text style={styles.emptyText}>{filtered ? 'Try a different name, or clear the filters.' : 'Check back soon.'}</Text>
            </View>
          )
        }
        ListFooterComponent={people.loadingMore ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : undefined}
        ItemSeparatorComponent={Gap}
      />
    </View>
  );
}

const Gap = () => <View style={{ height: 10 }} />;

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Filter: ${label}`}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 12, gap: 14 },
  title: { fontSize: 32, fontWeight: '600', letterSpacing: -0.64, color: colors.ink },
  segments: { flexDirection: 'row', padding: 4, borderRadius: 12, backgroundColor: '#E4E7E1', gap: 4 },
  segment: { flex: 1, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  segmentCount: { color: colors.inkSecondary, fontWeight: '500' },
  searchIcon: { position: 'absolute', left: 14, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 },
  search: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingLeft: 44,
    paddingRight: spacing.lg,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 16,
  },
  chipScroll: { marginHorizontal: -20 },
  chips: { paddingHorizontal: 20, gap: 8, paddingBottom: 2 },
  chip: { height: 40, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.ink },
  chipTextOn: { color: colors.onPrimary },
  list: { paddingHorizontal: 20, paddingBottom: 20, flexGrow: 1 },
  listHeader: { gap: 10, paddingBottom: 10 },
  hint: { padding: 12, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
  hintText: { fontSize: 14, lineHeight: 20, color: colors.inkSecondary },
  loader: { marginTop: 32 },
  empty: { paddingVertical: 40, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.ink },
  emptyText: { fontSize: 14, color: colors.inkSecondary, textAlign: 'center' },
});
