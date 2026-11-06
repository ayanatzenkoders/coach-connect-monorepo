import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CustomToastHost } from '@/src/components';
import Root from '@/src/navigations/Root';
import { queryClient } from '@/src/service/setup/queryClient';

/** Only the providers (React Query, safe area, toasts). What the app does at start-up is in navigations/Root.tsx. */
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
