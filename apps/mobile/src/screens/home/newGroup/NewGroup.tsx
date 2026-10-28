import React from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, CustomButton, CustomTextInput } from '@/src/components';
import { COLORS, GROUP_DESCRIPTION_MAX, GROUP_MAX_MEMBERS, GROUP_MIN_MEMBERS, GROUP_TITLE_MAX, MAX_FONT_SCALE, MIN_TOUCH, SPACING } from '@/src/constants';
import { useKeyboardVisible } from '@/src/utils/hooks/useKeyboardVisible';
import { useNewGroup } from './hook/useNewGroup';
import { Divider, keyOfPerson, PickEmpty, PickFooter, PickerControls, PickRow } from './PickerParts';

/**
 * Create a group chat: a name, an optional description, and 2 to 5 other people (6 in total with you), with at most
 * ONE coach. No pictures or files for now. Rows that would break a rule are greyed out and say why.
 */
const NewGroup: React.FC = () => {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const g = useNewGroup();
  const total = g.chosen.length + 1; // me too

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={g.goBack} style={styles.back}>
          <BackIcon />
        </Pressable>
        <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.headerTitle}>
          New group
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
            <CustomTextInput label="Group name" value={g.title} onChangeText={g.setTitle} error={g.titleError} maxLength={GROUP_TITLE_MAX} placeholder="For example: Career growth" returnKeyType="next" />
            <CustomTextInput label="Description (optional)" value={g.description} onChangeText={g.setDescription} maxLength={GROUP_DESCRIPTION_MAX} multiline placeholder="What is this group for?" />

            <PickerControls
              picker={g}
              needsMore={total < GROUP_MIN_MEMBERS}
              summary={`${total} of ${GROUP_MAX_MEMBERS} people, including you. Needs at least ${GROUP_MIN_MEMBERS}. One coach at most.`}
            />
          </View>
        }
        renderItem={({ item }) => <PickRow person={item} chosen={g.isChosen(item)} disabledReason={g.whyDisabled(item)} onPress={g.toggle} />}
        ListEmptyComponent={<PickEmpty loading={g.loading} />}
        ListFooterComponent={<PickFooter loadingMore={g.loadingMore} />}
      />

      {/* Home-indicator padding only while the keyboard is closed (see useKeyboardVisible). */}
      <View style={[styles.bottom, { paddingBottom: keyboardVisible ? SPACING.md : Math.max(insets.bottom, SPACING.md) }]}>
        <CustomButton title="Create group" onPress={g.create} disabled={!g.canCreate} loading={g.busy} />
      </View>
    </KeyboardAvoidingView>
  );
};

export default NewGroup;

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, paddingBottom: 10, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: COLORS.ink },
  list: { paddingBottom: SPACING.lg, flexGrow: 1 },
  form: { padding: 20, gap: SPACING.lg },
  bottom: { paddingHorizontal: 20, paddingTop: SPACING.md, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.divider },
});
