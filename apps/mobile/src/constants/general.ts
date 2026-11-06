import { Platform } from 'react-native';

// Plain values shared with the API (no zod in the bundle).
export { CODE_LENGTH, COACH_BIO_MAX, COACH_BIO_MIN, COACH_MAX_SPECIALTIES, COACH_SPECIALTIES, GROUP_DESCRIPTION_MAX, GROUP_MAX_MEMBERS, GROUP_MIN_MEMBERS, GROUP_TITLE_MAX, MESSAGE_MAX_LENGTH, PASSWORD_MAX, PASSWORD_MIN } from '@coach-connect/shared/constants';

/**
 * Where the backend lives while developing.
 *  - iOS simulator: your Mac is "localhost".   - Android emulator: your Mac is the special address 10.0.2.2.
 *  - A REAL phone: "localhost" would be the phone itself, so it needs your Mac's address on the Wi-Fi (the phone and the
 *    Mac must be on the same network). Set DEV_HOST to it. Find it with:  ipconfig getifaddr en0
 * Leave DEV_HOST as null to use localhost / 10.0.2.2 (simulator and emulator only).
 * TODO (Phase 10): production URL per environment (dev / staging / production).
 */
const DEV_HOST: string | null = '192.168.0.36';

const DEV_URL = DEV_HOST
  ? `http://${DEV_HOST}:3000`
  : Platform.select({
      android: 'http://10.0.2.2:3000',
      default: 'http://localhost:3000',
    });

export const API_BASE_URL: string = DEV_URL;

/** A request that takes longer than this is cancelled and reported as a network error. */
export const REQUEST_TIMEOUT_MS = 15_000;
