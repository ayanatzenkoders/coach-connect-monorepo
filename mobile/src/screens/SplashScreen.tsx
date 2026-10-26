import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Logo } from '../components/Logo';
import { colors } from '../theme';

interface Props {
  /** True once the app knows where to go. The bar then fills up and `onFinish` is called. */
  ready: boolean;
  onFinish?: () => void;
  message?: string;
}

/** After `ready`, how long until we leave: bar fills (250 ms) + a short pause so it feels finished. */
const FINISH_DELAY_MS = 450;

/**
 * Design "01 Splash": green screen, logo tile, app name, and a progress bar at the bottom.
 * The bar is determinate: it climbs toward 85% while we wait (we never know how long the
 * check takes), then jumps to 100% when the app is ready.
 */
export function SplashScreen({ ready, onFinish, message = 'Getting things ready…' }: Props) {
  const intro = useRef(new Animated.Value(0)).current; // logo + name appear
  const progress = useRef(new Animated.Value(0)).current; // 0..1

  // Entrance + slow climb of the bar.
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        intro.setValue(1);
        progress.setValue(0.85);
        return;
      }
      Animated.spring(intro, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }).start();
      Animated.timing(progress, { toValue: 0.85, duration: 1800, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [intro, progress]);

  // When ready: complete the bar, then hand over to the next screen.
  useEffect(() => {
    if (!ready) return;
    Animated.timing(progress, { toValue: 1, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    const timer = setTimeout(() => onFinish?.(), FINISH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [ready, onFinish, progress]);

  const scale = intro.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });

  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel="Loading Coach Connect">
      <View style={styles.center}>
        <Animated.View style={[styles.tile, { opacity: intro, transform: [{ scale }] }]}>
          <Logo size={60} outer={colors.primary} inner={colors.primary} dot={colors.primary} />
        </Animated.View>
        <Animated.Text style={[styles.name, { opacity: intro }]}>Coach Connect</Animated.Text>
      </View>

      <View style={styles.bottom}>
        <View style={styles.track}>
          {/* scaleX grows the bar from the left edge and can use the phone's fast native animation */}
          <Animated.View style={[styles.bar, { transform: [{ scaleX: progress }] }]} />
        </View>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'space-between', paddingBottom: 72 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  tile: { width: 88, height: 88, borderRadius: 26, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.onPrimary, fontSize: 30, fontWeight: '700', letterSpacing: -0.3 },
  bottom: { alignItems: 'center', gap: 14 },
  track: { width: 120, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' },
  bar: { width: 120, height: 3, backgroundColor: colors.onPrimary, transformOrigin: 'left' },
  message: { color: '#D3E3DC', fontSize: 14 },
});
