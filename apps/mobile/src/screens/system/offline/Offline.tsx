import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CustomButton } from '@/src/components';
import { COLORS, SPACING, MAX_FONT_SCALE, TEXT } from '@/src/constants';
import type { RootStackScreenProps } from '@/src/utils/types';
import { useOffline } from './hook/useOffline';

type Props = RootStackScreenProps<'Offline'>;

/** We have a saved login but cannot reach the server. The user stays signed in; they just retry. */
const Offline: React.FC<Props> = () => {
  const s = useOffline();

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.title} style={[TEXT.title, styles.title]}>
        You are offline
      </Text>
      <Text style={[TEXT.body, styles.body]}>We cannot reach Coach Connect right now. Check your connection and try again.</Text>
      <CustomButton title="Try again" loading={s.busy} onPress={s.retry} />
    </View>
  );
};

export default Offline;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', padding: SPACING.xl, gap: SPACING.lg },
  title: { fontSize: 28 },
  body: { marginBottom: SPACING.sm },
});
