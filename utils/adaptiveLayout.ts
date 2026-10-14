// Size the experience by available space, rather than a device name or model.
export const EXPANDED_MIN_WIDTH = 720;

export function getAdaptiveLayout(width: number, fontScale = 1) {
  const experienceWidth = Math.max(0, width);
  const expanded = experienceWidth >= EXPANDED_MIN_WIDTH * Math.max(1, fontScale);
  const supportWidth = expanded ? Math.round(experienceWidth * 0.43) : 0;
  return { expanded, experienceWidth, supportWidth, mainWidth: experienceWidth - supportWidth };
}
