export interface CustomAvatarProps {
  id: string;
  name: string;
  /** Small dot at the corner: green = available now, grey = not. Omit for no dot. */
  online?: boolean;
  /** Diameter in points (48 in People, 52 in Messages, 40 in the chat header). */
  size?: number;
}
