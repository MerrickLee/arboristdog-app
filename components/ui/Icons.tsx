import React from 'react';
import Svg, { Path, Circle, Rect, Ellipse, G } from 'react-native-svg';
import { COLORS } from '../../constants/theme';

export const TreeIcon = ({ size = 48, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <Path d="M24 4L12 20h6l-6 12h8l-4 12h8l-4-12h8l-6-12h6L24 4z" fill={color} opacity={0.9} />
    <Rect x={22} y={36} width={4} height={8} rx={1} fill={color} opacity={0.7} />
  </Svg>
);

export const TreeRingPaw = ({ size = 100 }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
    <Circle cx={60} cy={60} r={58} fill="#5C3D2E" stroke="#3A2518" strokeWidth={2} />
    <Circle cx={60} cy={60} r={50} fill="none" stroke="#7A5240" strokeWidth={1} />
    <Circle cx={60} cy={60} r={42} fill="none" stroke="#8B6350" strokeWidth={0.6} />
    <Circle cx={60} cy={60} r={34} fill="none" stroke="#7A5240" strokeWidth={1} />
    <Circle cx={60} cy={60} r={26} fill="none" stroke="#8B6350" strokeWidth={0.6} />
    <Circle cx={60} cy={60} r={22} fill="#6B4832" />
    <G fill="#F5F2EB">
      <Path d="M60 72 Q50 72 49 66 Q48 62 53 60 Q57 58 61 58 Q65 58 65 60 Q70 62 69 66 Q68 72 60 72Z" />
      <Ellipse cx={50} cy={51} rx={5.5} ry={7} transform="rotate(-6, 50, 51)" />
      <Ellipse cx={57.5} cy={47} rx={5} ry={7} />
      <Ellipse cx={65} cy={47.5} rx={5} ry={7} transform="rotate(4, 65, 47.5)" />
      <Ellipse cx={71.5} cy={52.5} rx={5.5} ry={7} transform="rotate(10, 71.5, 52.5)" />
    </G>
    <Path d="M86 22 Q92 16 98 22 Q92 28 86 22" fill="#7BC950" stroke="#4A8C3F" strokeWidth={0.8} />
    <Path d="M92 22 L88 25" stroke="#4A8C3F" strokeWidth={0.5} />
  </Svg>
);

export const CameraIcon = () => (
  <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
    <Path
      d="M4 10a2 2 0 012-2h4l2-3h8l2 3h4a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V10z"
      stroke="#fff"
      strokeWidth={2}
    />
    <Circle cx={16} cy={16} r={5} stroke="#fff" strokeWidth={2} />
  </Svg>
);

export const LocationIcon = ({ color = '#fff', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill={color} />
    <Circle cx={12} cy={9} r={2.5} fill="#fff" />
  </Svg>
);

export const CheckIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
    <Circle cx={10} cy={10} r={10} fill={COLORS.leafAccent} />
    <Path d="M6 10l3 3 5-6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const AlertIcon = ({ size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <Path d="M10 2L1 18h18L10 2z" fill={COLORS.alertAmber} />
    <Path d="M10 8v4M10 14v1" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

export const BackArrow = ({ onPress }: { onPress?: () => void }) => (
  <Svg width={20} height={20} viewBox="0 0 20 20" fill="none" onPress={onPress}>
    <Path d="M13 4l-6 6 6 6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
