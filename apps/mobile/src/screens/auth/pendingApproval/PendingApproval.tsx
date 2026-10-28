import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CustomButton, CustomWrapper } from '@/src/components';
import { COLORS, MAX_FONT_SCALE, SPACING, TEXT } from '@/src/constants';
import type { RootStackScreenProps } from '@/src/utils/types';
import { usePendingApproval } from './hook/usePendingApproval';

type Props = RootStackScreenProps<'PendingApproval'>;

/** Shown to a coach whose email is verified but whom no admin has approved yet. */
const PendingApproval: React.FC<Props> = () => {
  const s = usePendingApproval();

  return (
    <CustomWrapper contentStyle={styles.content}>
      <View style={styles.body}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.title} style={[TEXT.title, styles.center]}>
          Application received
        </Text>
        <Text style={[TEXT.body, styles.center]}>
          Thank you{s.name ? `, ${s.name}` : ''}. An admin is reviewing your application. We will email {s.email} as soon as you are approved, and then you can sign in and members can find you.
        </Text>
      </View>
      <View style={styles.actions}>
        <CustomButton title="Check again" onPress={s.check} loading={s.checking} />
        <CustomButton title="Sign out" variant="outline" onPress={s.signOut} />
      </View>
    </CustomWrapper>
  );
};

export default PendingApproval;

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: SPACING.xl, paddingBottom: 40, backgroundColor: COLORS.background },
  body: { flex: 1, justifyContent: 'center', gap: SPACING.md },
  center: { textAlign: 'center' },
  actions: { gap: SPACING.md },
});
