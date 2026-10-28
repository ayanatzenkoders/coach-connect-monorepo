import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BackIcon, CustomButton, CustomPasswordChecklist, CustomTextInput, CustomWrapper } from '@/src/components';
import { COLORS, MIN_TOUCH, SPACING, MAX_FONT_SCALE, TEXT } from '@/src/constants';
import type { RootStackScreenProps } from '@/src/utils/types';
import { useNewPassword } from './hook/useNewPassword';

type Props = RootStackScreenProps<'NewPassword'>;

/** Forgot password, screen 3 of 3: choose the new password. */
const NewPassword: React.FC<Props> = ({ route }) => {
  const s = useNewPassword(route.params);

  return (
    <CustomWrapper scroll keyboardAvoidingView topInset={false} contentStyle={styles.content}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={s.goBack} style={styles.back}>
        <BackIcon />
      </Pressable>

      <View style={styles.header}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.title} style={TEXT.title}>
          Choose a new password
        </Text>
        <Text style={TEXT.body}>Your code is correct. Now pick a new password for your account.</Text>
      </View>

      <View>
        <CustomTextInput
          label="New password"
          value={s.password}
          onChangeText={s.onChangePassword}
          error={s.error}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={s.submit}
        />
        <CustomPasswordChecklist password={s.password} />
      </View>

      <View style={styles.bottom}>
        <Text style={styles.note}>Resetting signs you out on every device.</Text>
        <CustomButton title="Reset password" onPress={s.submit} loading={s.busy} />
      </View>
    </CustomWrapper>
  );
};

export default NewPassword;

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACING.xl, paddingTop: 56, paddingBottom: 40, gap: SPACING.xl },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  header: { gap: SPACING.sm },
  bottom: { marginTop: 'auto', gap: SPACING.md },
  note: { fontSize: 13, color: COLORS.inkSecondary, textAlign: 'center' },
});
