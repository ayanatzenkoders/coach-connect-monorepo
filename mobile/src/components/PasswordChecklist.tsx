import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PASSWORD_RULES } from '../auth/passwordRules';
import { colors, spacing } from '../theme';
import { CheckIcon, DotIcon } from './icons';

/** Four lines under a new-password field; each gets a green tick as soon as the password satisfies it. */
export function PasswordChecklist({ password }: { password: string }) {
  return (
    <View style={styles.list} accessibilityLabel="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <View key={rule.id} style={styles.row}>
            {ok ? <CheckIcon /> : <DotIcon />}
            <Text style={[styles.text, ok && { color: colors.primaryPressed }]}>{rule.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 6, paddingTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { fontSize: 14, color: colors.inkSecondary },
});
