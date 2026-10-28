import { useState } from 'react';

export type MainTab = 'people' | 'messages' | 'calls' | 'profile';

/** Which bottom tab is open. (The tab bar is hand-made: it is just this one piece of state.) */
export const useMain = () => {
  const [tab, setTab] = useState<MainTab>('people');
  return { tab, setTab };
};
