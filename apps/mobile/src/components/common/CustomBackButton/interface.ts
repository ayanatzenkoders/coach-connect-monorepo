export interface CustomBackButtonProps {
  onPress: () => void;
  /** What a screen reader says, e.g. "Back to sign in". */
  label?: string;
  /** The arrow's colour. Default: the normal text colour. Use the "on green" colour over a dark screen. */
  color?: string;
  /** Pull the arrow to the page's left edge, for a lone back button above a form (the 44-point touch area has padding). */
  alignToEdge?: boolean;
}
