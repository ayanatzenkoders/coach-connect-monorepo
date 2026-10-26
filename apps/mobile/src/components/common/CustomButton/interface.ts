export type Variant = 'primary' | 'dark' | 'outline';

export interface CustomButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
}
