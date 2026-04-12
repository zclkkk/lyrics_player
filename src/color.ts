type RgbColor = [number, number, number];

const FALLBACK_COLORS: [RgbColor, RgbColor, RgbColor, RgbColor] = [
  [160, 80, 120],
  [255, 116, 116],
  [255, 196, 124],
  [140, 190, 255]
];

const collectPixels = (imageData: ImageData) => {
  const { data } = imageData;
  const pixels: RgbColor[] = [];

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3]!;

    if (alpha < 128) {
      continue;
    }

    const r = data[index]!;
    const g = data[index + 1]!;
    const b = data[index + 2]!;
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

    if (luminance > 12 && luminance < 245) {
      pixels.push([r, g, b]);
    }
  }

  return pixels;
};

const medianCut = (pixels: RgbColor[], depth: number): RgbColor[] => {
  if (depth === 0 || pixels.length < 2) {
    if (pixels.length === 0) {
      return [[128, 128, 128]];
    }

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;

    for (const [r, g, b] of pixels) {
      rSum += r;
      gSum += g;
      bSum += b;
    }

    const pixelCount = pixels.length;
    return [[
      Math.round(rSum / pixelCount),
      Math.round(gSum / pixelCount),
      Math.round(bSum / pixelCount)
    ]];
  }

  let rMin = 255;
  let rMax = 0;
  let gMin = 255;
  let gMax = 0;
  let bMin = 255;
  let bMax = 0;

  for (const [r, g, b] of pixels) {
    if (r < rMin) rMin = r;
    if (r > rMax) rMax = r;
    if (g < gMin) gMin = g;
    if (g > gMax) gMax = g;
    if (b < bMin) bMin = b;
    if (b > bMax) bMax = b;
  }

  const rRange = rMax - rMin;
  const gRange = gMax - gMin;
  const bRange = bMax - bMin;
  const splitChannel = rRange >= gRange && rRange >= bRange ? 0 : gRange >= bRange ? 1 : 2;

  pixels.sort((left, right) => left[splitChannel] - right[splitChannel]);

  const midpoint = pixels.length >> 1;
  return [
    ...medianCut(pixels.slice(0, midpoint), depth - 1),
    ...medianCut(pixels.slice(midpoint), depth - 1)
  ];
};

const boostSaturation = ([r, g, b]: RgbColor, factor: number): RgbColor => {
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;

  return [
    Math.min(255, Math.max(0, Math.round(gray + (r - gray) * factor))),
    Math.min(255, Math.max(0, Math.round(gray + (g - gray) * factor))),
    Math.min(255, Math.max(0, Math.round(gray + (b - gray) * factor)))
  ];
};

const getLuminance = ([r, g, b]: RgbColor) => 0.299 * r + 0.587 * g + 0.114 * b;

export const getDominantColors = (image: CanvasImageSource) => {
  const size = 64;
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(image, 0, 0, size, size);

  const pixels = collectPixels(context.getImageData(0, 0, size, size));

  if (pixels.length < 8) {
    return { colors: FALLBACK_COLORS };
  }

  const colors = medianCut(pixels, 2)
    .map((color) => boostSaturation(color, 1.3))
    .sort((left, right) => getLuminance(left) - getLuminance(right));

  if (colors.length < 4) {
    return { colors: FALLBACK_COLORS };
  }

  return { colors: colors.slice(0, 4) as typeof FALLBACK_COLORS };
};

export const applyAccent = (colors: readonly RgbColor[]) => {
  const palette = colors.length >= 4
    ? [colors[0]!, colors[1]!, colors[2]!, colors[3]!] as const
    : FALLBACK_COLORS;
  const [accent3, accent1, accent2, accent4] = palette;
  const style = document.documentElement.style;

  style.setProperty("--accent-rgb", accent1.join(", "));
  style.setProperty("--accent-2-rgb", accent2.join(", "));
  style.setProperty("--accent-3-rgb", accent3.join(", "));
  style.setProperty("--accent-4-rgb", accent4.join(", "));
};
