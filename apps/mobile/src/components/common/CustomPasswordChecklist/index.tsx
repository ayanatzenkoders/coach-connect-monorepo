import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PASSWORD_RULES } from '@/src/utils/helpers/passwordRules';
import { COLORS, SPACING } from '@/src/constants';
import { CheckIcon, DotIcon } from '@/src/components/common/CustomIcon';

/** Four lines under a new-password field; each gets a green tick as soon as the password satisfies it. */
export function CustomPasswordChecklist({ password }: { password: string }) {
  return (
    <View style={styles.list} accessibilityLabel="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <View key={rule.id} style={styles.row}>
            {ok ? <CheckIcon /> : <DotIcon />}
            <Text style={[styles.text, ok && { color: COLORS.primaryPressed }]}>{rule.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 6, paddingTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  text: { fontSize: 14, color: COLORS.inkSecondary },
});
