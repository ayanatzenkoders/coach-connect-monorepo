type Variant = 'primary' | 'outline' | 'danger';

export interface CustomButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
}
