import { Platform } from 'react-native';

/**
 * Where the backend lives while developing.
 * - iOS simulator: your Mac is "localhost".
 * - Android emulator: your Mac is the special address 10.0.2.2.
 * - A real phone: put your Mac's Wi-Fi address here instead, e.g. 'http://192.168.1.20:3000'.
 * TODO (Phase 10): production URL per environment (dev / staging / production).
 */
const DEV_URL = Platform.select({
  android: 'http://10.0.2.2:3000',
  default: 'http://localhost:3000',
});

export const API_BASE_URL: string = DEV_URL;

/** A request that takes longer than this is cancelled and reported as a network error. */
export const REQUEST_TIMEOUT_MS = 15_000;
