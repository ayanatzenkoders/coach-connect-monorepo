import React from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, CustomButton } from '@/src/components';
import { COLORS, MAX_FONT_SCALE, MIN_TOUCH, SPACING } from '@/src/constants';
import type { RootStackScreenProps } from '@/src/utils/types';
import { useKeyboardVisible } from '@/src/utils/hooks/useKeyboardVisible';
import { Divider, keyOfPerson, PickEmpty, PickFooter, PickerControls, PickRow } from '../newGroup/PickerParts';
import { useAddMembers } from './hook/useAddMembers';

type Props = RootStackScreenProps<'AddMembers'>;

/** Add people to a group you created, while it has room (6 people at most, one coach). */
const AddMembers: React.FC<Props> = ({ route }) => {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const g = useAddMembers(route.params);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={g.goBack} style={styles.back}>
          <BackIcon />
        </Pressable>
        <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.headerTitle}>
          Add people
        </Text>
      </View>

      <FlatList
        data={g.people}
        keyExtractor={keyOfPerson}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        onEndReached={g.loadMore}
        onEndReachedThreshold={0.5}
        ItemSeparatorComponent={Divider}
        ListHeaderComponent={
          <View style={styles.form}>
            <PickerControls picker={g} needsMore={false} summary={`${g.total} of ${g.max} people in the group. One coach at most.`} />
          </View>
        }
        renderItem={({ item }) => <PickRow person={item} chosen={g.isChosen(item)} disabledReason={g.whyDisabled(item)} onPress={g.toggle} />}
        ListEmptyComponent={<PickEmpty loading={g.loading} />}
        ListFooterComponent={<PickFooter loadingMore={g.loadingMore} />}
      />

      <View style={[styles.bottom, { paddingBottom: keyboardVisible ? SPACING.md : Math.max(insets.bottom, SPACING.md) }]}>
        <CustomButton title="Add to group" onPress={g.add} disabled={!g.canAdd} loading={g.busy} />
      </View>
    </KeyboardAvoidingView>
  );
};

export default AddMembers;

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, paddingBottom: 10, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: COLORS.ink },
  list: { paddingBottom: SPACING.lg, flexGrow: 1 },
  form: { padding: 20, gap: SPACING.lg },
  bottom: { paddingHorizontal: 20, paddingTop: SPACING.md, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.divider },
});
