import React from 'react';
import { IncomingCallOverlay } from './IncomingCallOverlay';
import { useCallSignals } from '@/src/service/call/useCallSignals';

/**
 * Everything about calls that must exist the whole time somebody is signed in, whatever screen they are on:
 * the listener for the server's pushes, and the ringing overlay. Mounted once, next to the navigator.
 */
export function CallLayer() {
  useCallSignals();
  return <IncomingCallOverlay />;
}
