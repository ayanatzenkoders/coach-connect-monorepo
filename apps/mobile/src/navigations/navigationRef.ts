import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '@/src/utils/types';

/** For navigating outside React (e.g. from a push notification handler or an interceptor). */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
