import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageIcon, PeopleIcon, PhoneIcon, UserIcon } from '@/src/components';
import { COLORS, MAX_FONT_SCALE } from '@/src/constants';
import type { RootStackScreenProps } from '@/src/utils/types';
import { useUnreadTotal } from '../messages/hook/useUnreadTotal';
import Calls from '../calls/Calls';
import Messages from '../messages/Messages';
import People from '../people/People';
import Profile from '../profile/Profile';
import { MainTab, useMain } from './hook/useMain';

type Props = RootStackScreenProps<'Main'>;

const TABS: { key: MainTab; label: string; Icon: typeof PeopleIcon }[] = [
  { key: 'people', label: 'People', Icon: PeopleIcon },
  { key: 'messages', label: 'Messages', Icon: MessageIcon },
  { key: 'calls', label: 'Calls', Icon: PhoneIcon },
  { key: 'profile', label: 'Profile', Icon: UserIcon },
];

/**
 * The signed-in home: one tab's screen above the bottom tab bar (design "Main" nav).
 * People stays mounted while another tab is open, so your search and filters are still there when you
 * come back. A chat opens as its own screen on top of this one (see navigations/RootStack.tsx).
 */
const Main: React.FC<Props> = () => {
  const insets = useSafeAreaInsets();
  const { tab, setTab } = useMain();
  // Unread messages over all chats. This screen stays mounted on every tab and while a chat is open, so it is
  // the one place that keeps that number live.
  const unread = useUnreadTotal();

  return (
    <View style={styles.flex}>
      <View style={[styles.flex, tab !== 'people' && styles.hidden]}>
        <People />
      </View>
      {tab === 'messages' && <Messages />}
      {tab === 'calls' && <Calls />}
      {tab === 'profile' && <Profile />}

      <View accessibilityRole="tablist" style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {TABS.map(({ key, label, Icon }) => {
          const on = tab === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityLabel={key === 'messages' && unread > 0 ? `${label}, ${unread} unread` : label}
              accessibilityState={{ selected: on }}
              onPress={() => setTab(key)}
              style={styles.tab}>
              <View>
                <Icon color={on ? COLORS.primary : COLORS.inkMuted} />
                {key === 'messages' && unread > 0 ? <UnreadBadge count={unread} /> : null}
              </View>
              <Text numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE.chrome} style={[styles.label, { color: on ? COLORS.primary : COLORS.inkMuted }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export default Main;

/** Count pill on the corner of the Messages icon: "7", or "99+" for a lot. */
function UnreadBadge({ count }: { count: number }) {
  return (
    <View style={styles.badge} testID="messages-unread-badge">
      <Text allowFontScaling={false} style={styles.badgeText}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  badge: { position: 'absolute', top: -6, left: 14, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.surface },
  badgeText: { fontSize: 11, fontWeight: '700', color: COLORS.onPrimary },
  hidden: { display: 'none' },
  bar: { flexDirection: 'row', paddingTop: 8, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.divider },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 12, fontWeight: '600' },
});
