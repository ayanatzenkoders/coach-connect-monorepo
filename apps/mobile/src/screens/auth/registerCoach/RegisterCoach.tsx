import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BackIcon, CustomButton, CustomPasswordChecklist, CustomTextInput, CustomWrapper } from '@/src/components';
import { COACH_SPECIALTIES, COLORS, MAX_FONT_SCALE, MIN_TOUCH, SPACING, TEXT } from '@/src/constants';
import type { RootStackScreenProps } from '@/src/utils/types';
import { useRegisterCoach } from './hook/useRegisterCoach';

type Props = RootStackScreenProps<'RegisterCoach'>;

/** "Apply as a coach": the member form plus the details an admin needs. The phone number is only ever shown to admins. */
const RegisterCoach: React.FC<Props> = () => {
  const s = useRegisterCoach();

  return (
    <CustomWrapper scroll keyboardAvoidingView topInset={false} contentStyle={styles.content}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={s.goBack} style={styles.back}>
        <BackIcon />
      </Pressable>

      <View style={styles.header}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.title} style={TEXT.title}>
          Apply as a coach
        </Text>
        <Text style={TEXT.body}>An admin reviews every application. You can sign in once it is approved, and we will email you.</Text>
      </View>

      <View style={styles.form}>
        <CustomTextInput label="Full name" value={s.name} onChangeText={s.onChangeName} error={s.errors.name} autoComplete="name" textContentType="name" returnKeyType="next" />
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
        <View style={styles.field}>
          <CustomTextInput label="Phone number" value={s.phone} onChangeText={s.onChangePhone} error={s.errors.phone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" maxLength={20} />
          <Text style={styles.hint}>Only our admins see your number. It is never shown to members.</Text>
        </View>
        <CustomTextInput label="Date of birth" value={s.dob} onChangeText={s.onChangeDob} error={s.errors.dob} keyboardType="number-pad" placeholder="YYYY-MM-DD" maxLength={10} />

        <View style={styles.field}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={TEXT.label}>
            Specialties
          </Text>
          <Text accessibilityLiveRegion="polite" style={[TEXT.small, s.errors.specialties ? styles.errorText : undefined]}>
            {s.errors.specialties ?? `Pick up to ${s.maxSpecialties} (${s.specialties.length} chosen). Members use these to find you.`}
          </Text>
          <View style={styles.chips}>
            {COACH_SPECIALTIES.map((tag) => {
              const on = s.specialties.includes(tag);
              return (
                <Pressable key={tag} accessibilityRole="checkbox" accessibilityLabel={tag} accessibilityState={{ checked: on }} onPress={() => s.toggleSpecialty(tag)} style={[styles.chip, on && styles.chipOn]}>
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={[styles.chipText, on && styles.chipTextOn]}>
                    {tag}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <CustomTextInput label="About you" value={s.bio} onChangeText={s.onChangeBio} error={s.errors.bio} multiline maxLength={s.bioMax} placeholder="Your experience and how you help people." />

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
          />
          <CustomPasswordChecklist password={s.password} />
        </View>
      </View>

      <View style={styles.bottom}>
        <CustomButton title="Submit application" onPress={s.submit} loading={s.busy} />
        <Pressable accessibilityRole="link" accessibilityLabel="Create a member account instead" onPress={s.goMemberSignUp} hitSlop={8} style={styles.link}>
          <Text style={TEXT.link}>Not a coach? Create a member account</Text>
        </Pressable>
      </View>
    </CustomWrapper>
  );
};

export default RegisterCoach;

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACING.xl, paddingTop: 56, paddingBottom: 40, gap: SPACING.xl },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  header: { gap: SPACING.sm },
  form: { gap: SPACING.lg },
  field: { gap: 6 },
  hint: { fontSize: 13, color: COLORS.inkSecondary },
  errorText: { color: COLORS.error },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  chipOn: { backgroundColor: COLORS.primaryTint, borderColor: COLORS.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  chipTextOn: { color: COLORS.primaryPressed },
  bottom: { marginTop: 'auto', gap: SPACING.lg },
  link: { alignSelf: 'center', paddingVertical: SPACING.sm },
});
