export interface SegmentOption<T extends string> {
  value: T;
  /** The text on the segment. */
  label: string;
  /** What a screen reader says, if it should differ from the text (for example "Pick from coaches"). */
  accessibilityLabel?: string;
}

export interface CustomSegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}
