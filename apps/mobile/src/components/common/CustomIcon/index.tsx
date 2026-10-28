import React from 'react';
import Svg, { Path } from 'react-native-svg';

/** Small stroke icons from the design. They take their color from the `color` prop. */
export function BackIcon({ color = '#141A17', size = 24 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5l-7 7 7 7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CheckIcon({ color = '#174A3D', size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function DotIcon({ color = '#646B66', size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 12h.01" stroke={color} strokeWidth={5} strokeLinecap="round" />
    </Svg>
  );
}

type IconProps = { color?: string; size?: number };

/** One 24x24 stroke icon; the shapes are plain SVG path strings. */
function StrokeIcon({ d, color = '#141A17', size = 24, width = 2 }: IconProps & { d: string[]; width?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {d.map((path) => (
        <Path key={path} d={path} stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

export const SearchIcon = (p: IconProps) => <StrokeIcon {...p} d={['M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14z', 'M21 21l-4.3-4.3']} />;
export const MessageIcon = (p: IconProps) => <StrokeIcon {...p} d={['M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.5A8 8 0 1 1 21 12z']} />;
export const PhoneIcon = (p: IconProps) => (
  <StrokeIcon
    {...p}
    d={['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z']}
  />
);
export const PeopleIcon = (p: IconProps) => (
  <StrokeIcon {...p} d={['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 3a4 4 0 1 0 0 8a4 4 0 0 0 0-8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75']} />
);
export const UserIcon = (p: IconProps) => <StrokeIcon {...p} d={['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 3a4 4 0 1 0 0 8a4 4 0 0 0 0-8z']} />;
/** An open eye ("show") and a crossed-out eye ("hide"), for the password field. */
export const EyeIcon = (p: IconProps) => <StrokeIcon {...p} d={['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6z']} />;
export const EyeOffIcon = (p: IconProps) => (
  <StrokeIcon
    {...p}
    d={['M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94', 'M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19', 'M14.12 14.12a3 3 0 1 1-4.24-4.24', 'M1 1l22 22']}
  />
);
export const PlusIcon = (p: IconProps) => <StrokeIcon {...p} d={['M12 5v14', 'M5 12h14']} />;
export const SendIcon = (p: IconProps) => <StrokeIcon {...p} d={['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z']} />;
