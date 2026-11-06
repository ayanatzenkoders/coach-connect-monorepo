import { NavigationContainer } from '@react-navigation/native';
import React from 'react';
import { StatusBar } from 'react-native';
import Splash from '@/src/screens/system/splash/Splash';
import { navigationRef } from './navigationRef';
import RootStack from './RootStack';
import { useRoot } from './hook/useRoot';

/** The splash first; once the saved login was checked, the navigator. (The providers around it are in App.tsx.) */
const Root: React.FC = () => {
  const { ready, splashDone, finishSplash } = useRoot();

  return (
    <>
      <StatusBar barStyle={splashDone ? 'dark-content' : 'light-content'} />
      {splashDone ? (
        <NavigationContainer ref={navigationRef}>
          <RootStack />
        </NavigationContainer>
      ) : (
        <Splash ready={ready} onFinish={finishSplash} />
      )}
    </>
  );
};

export default Root;
