import type { ReactNode } from 'react';

export interface CustomHeaderProps {
  onBack: () => void;
  /** What a screen reader says for the back arrow, e.g. "Back to messages". */
  backLabel?: string;
  /** A plain title. Leave it out when you pass `children`. */
  title?: string;
  /** Your own middle part (the chat shows the person's avatar and name here). It replaces `title`. */
  children?: ReactNode;
  /** Buttons on the right, such as the call buttons. */
  right?: ReactNode;
}
