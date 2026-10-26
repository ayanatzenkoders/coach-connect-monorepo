import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageIcon, PeopleIcon, PhoneIcon, UserIcon } from '../components/icons';
import { showToast } from '../toast/toastStore';
import { colors } from '../theme';
import { HomeScreen } from './HomeScreen';
import { PeopleScreen } from './PeopleScreen';
import { PlaceholderScreen } from './PlaceholderScreen';

type Tab = 'people' | 'messages' | 'calls' | 'profile';

const TABS: { key: Tab; label: string; Icon: typeof PeopleIcon }[] = [
  { key: 'people', label: 'People', Icon: PeopleIcon },
  { key: 'messages', label: 'Messages', Icon: MessageIcon },
  { key: 'calls', label: 'Calls', Icon: PhoneIcon },
  { key: 'profile', label: 'Profile', Icon: UserIcon },
];

/**
 * The signed-in app: a screen plus the bottom tab bar (design "Main" nav).
 * Hand-made on purpose (just a piece of state) until there are enough screens to need real navigation.
 * People stays mounted while another tab is open, so your search and filters are still there when you come back.
 */
export function MainTabs() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('people');

  return (
    <View style={styles.flex}>
      <View style={[styles.flex, tab !== 'people' && styles.hidden]}>
        <PeopleScreen
          onMessage={(p) => showToast(`Chat with ${p.name} is coming in the next step.`, 'info')}
          onCall={(p) => showToast(`Calling ${p.name} is coming soon.`, 'info')}
        />
      </View>
      {tab === 'messages' && <PlaceholderScreen title="Messages" description="Your conversations will appear here." />}
      {tab === 'calls' && <PlaceholderScreen title="Calls" description="Your call history will appear here." />}
      {tab === 'profile' && <HomeScreen />}

      <View accessibilityRole="tablist" style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {TABS.map(({ key, label, Icon }) => {
          const on = tab === key;
          return (
            <Pressable key={key} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={() => setTab(key)} style={styles.tab}>
              <Icon color={on ? colors.primary : colors.inkMuted} />
              <Text style={[styles.label, { color: on ? colors.primary : colors.inkMuted }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hidden: { display: 'none' },
  bar: { flexDirection: 'row', paddingTop: 8, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 12, fontWeight: '600' },
});
