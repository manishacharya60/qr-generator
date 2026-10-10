export const DEFAULT_COLOR = '#172b4d';
export const isHexColor = (value) => /^#[0-9a-f]{6}$/i.test(value);

export function contrastOnWhite(color) {
  if (!isHexColor(color)) return 1;
  const channels = color.slice(1).match(/../g).map(value => {
    const channel = parseInt(value, 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  return 1.05 / (luminance + .05);
}
