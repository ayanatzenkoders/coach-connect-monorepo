import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BackIcon, CustomButton, CustomPasswordChecklist, CustomTextInput, CustomWrapper } from '@/src/components';
import { COLORS, MIN_TOUCH, SPACING, MAX_FONT_SCALE, TEXT } from '@/src/constants';
import type { RootStackScreenProps } from '@/src/utils/types';
import { useRegister } from './hook/useRegister';

type Props = RootStackScreenProps<'Register'>;

/** Create account screen (design "03 Create account"). */
const Register: React.FC<Props> = ({ route }) => {
  const s = useRegister(route.params);

  return (
    <CustomWrapper scroll keyboardAvoidingView topInset={false} contentStyle={styles.content}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to sign in" onPress={s.goBack} style={styles.back}>
        <BackIcon />
      </Pressable>

      <View style={styles.header}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.title} style={TEXT.title}>
          Create your account
        </Text>
        <Text style={TEXT.body}>Your coach will see your first name.</Text>
      </View>

      <View style={styles.form}>
        <CustomTextInput
          label="Full name"
          value={s.name}
          onChangeText={s.onChangeName}
          error={s.errors.name}
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
        />
        <CustomTextInput
          label="Email"
          value={s.email}
          onChangeText={s.onChangeEmail}
          error={s.errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <View>
          <CustomTextInput
            label="Password"
            value={s.password}
            onChangeText={s.onChangePassword}
            error={s.errors.password}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={s.submit}
          />
          <CustomPasswordChecklist password={s.password} />
        </View>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.legal}>
          By continuing you agree to the <Text style={styles.legalLink}>Terms</Text> and <Text style={styles.legalLink}>Privacy Policy</Text>.
        </Text>
        <CustomButton title="Create account" onPress={s.submit} loading={s.busy} />
      </View>
    </CustomWrapper>
  );
};

export default Register;

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACING.xl, paddingTop: 56, paddingBottom: 40, gap: SPACING.xl },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  header: { gap: SPACING.sm },
  form: { gap: SPACING.lg },
  bottom: { marginTop: 'auto', gap: SPACING.lg },
  legal: { fontSize: 13, lineHeight: 20, color: COLORS.inkSecondary, textAlign: 'center' },
  legalLink: { fontWeight: '600', color: COLORS.ink },
});
