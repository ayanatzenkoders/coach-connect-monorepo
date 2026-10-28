import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CustomToastHost } from '@/src/components';
import { navigationRef } from '@/src/navigations/navigationRef';
import RootStack from '@/src/navigations/RootStack';
import { Splash } from '@/src/screens/system/splash/Splash';
import { useAuthStore } from '@/src/store/auth.store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Avoid refetch storms on mobile: data stays fresh for 30 s and a failed request retries once.
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
});

/** The splash stays until the saved login was checked AND its progress bar has finished filling. */
function Root() {
  const status = useAuthStore((s) => s.status);
  const restore = useAuthStore((s) => s.restore);
  const [splashDone, setSplashDone] = useState(false);
  const finishSplash = useCallback(() => setSplashDone(true), []);

  // Once, when the app opens: check the saved login.
  useEffect(() => {
    restore();
  }, [restore]);

  return (
    <>
      <StatusBar barStyle={splashDone ? 'dark-content' : 'light-content'} />
      {splashDone ? (
        <NavigationContainer ref={navigationRef}>
          <RootStack />
        </NavigationContainer>
      ) : (
        <Splash ready={status !== 'booting'} onFinish={finishSplash} />
      )}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <Root />
        <CustomToastHost />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

export default App;
