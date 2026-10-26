import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SignInScreen } from './src/screens/SignInScreen';

// TEMPORARY: shows the Sign in screen on its own. Step M6 replaces this with real navigation,
// and M7 connects the buttons to the backend.
function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <SignInScreen
        onSignIn={async () => {}}
        onCreateAccount={() => {}}
        onForgotPassword={() => {}}
      />
    </SafeAreaProvider>
  );
}

export default App;
