import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { COLORS } from '@/src/constants';

import type { CustomLogoProps } from './interface';

/**
 * Coach Connect mark: one "C" inside another "C". The two openings face the same way,
 * like two people facing each other, with a dot between them for the connection.
 */

const CENTER = 50;
const GAP_DEGREES = 40; // how far each C opens to the right (above and below the horizontal)

/** An arc around the center that is open on the right-hand side, drawn as an SVG path. */
function openArc(radius: number): string {
  const rad = (GAP_DEGREES * Math.PI) / 180;
  const x = (CENTER + radius * Math.cos(rad)).toFixed(2);
  const yTop = (CENTER - radius * Math.sin(rad)).toFixed(2);
  const yBottom = (CENTER + radius * Math.sin(rad)).toFixed(2);
  // from the top end, the long way round the left side, to the bottom end
  return `M ${x} ${yTop} A ${radius} ${radius} 0 1 0 ${x} ${yBottom}`;
}

export function CustomLogo({ size = 48, outer = COLORS.primary, inner = COLORS.primary, dot = COLORS.primary }: CustomLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Coach Connect logo">
      <Path d={openArc(38)} stroke={outer} strokeWidth={9} strokeLinecap="round" fill="none" />
      <Path d={openArc(21)} stroke={inner} strokeWidth={9} strokeLinecap="round" fill="none" opacity={0.7} />
      <Circle cx={CENTER + 2} cy={CENTER} r={5.5} fill={dot} />
    </Svg>
  );
}
