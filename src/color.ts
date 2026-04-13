type RGB = [number, number, number];

const collectPixels = (imageData: ImageData): RGB[] => {
  const { data } = imageData;
  const pixels: RGB[] = [];

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 128) continue;

    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    if (lum > 12 && lum < 245) {
      pixels.push([r, g, b]);
    }
  }

  return pixels;
};

const medianCut = (pixels: RGB[], depth: number): RGB[] => {
  if (depth === 0 || pixels.length < 2) {
    if (pixels.length === 0) return [[128, 128, 128]];

    let rS = 0;
    let gS = 0;
    let bS = 0;
    for (const [r, g, b] of pixels) {
      rS += r;
      gS += g;
      bS += b;
    }
    const n = pixels.length;
    return [[Math.round(rS / n), Math.round(gS / n), Math.round(bS / n)]];
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
  const ch =
    rRange >= gRange && rRange >= bRange ? 0 : gRange >= bRange ? 1 : 2;

  pixels.sort((a, b) => a[ch] - b[ch]);
  const mid = pixels.length >> 1;

  return [
    ...medianCut(pixels.slice(0, mid), depth - 1),
    ...medianCut(pixels.slice(mid), depth - 1),
  ];
};

const boostSaturation = ([r, g, b]: RGB, factor: number): RGB => {
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  return [
    Math.min(255, Math.max(0, Math.round(gray + (r - gray) * factor))),
    Math.min(255, Math.max(0, Math.round(gray + (g - gray) * factor))),
    Math.min(255, Math.max(0, Math.round(gray + (b - gray) * factor))),
  ];
};

const luminance = ([r, g, b]: RGB): number => 0.299 * r + 0.587 * g + 0.114 * b;

const FALLBACK_COLORS: RGB[] = [
  [160, 80, 120],
  [255, 116, 116],
  [255, 196, 124],
  [140, 190, 255],
];

export const getDominantColors = (
  image: HTMLImageElement,
): { colors: RGB[] } => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const size = 64;

  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(image, 0, 0, size, size);

  const pixels = collectPixels(ctx.getImageData(0, 0, size, size));

  if (pixels.length < 8) return { colors: FALLBACK_COLORS };

  const raw = medianCut(pixels, 2);
  const colors = raw.map((c) => boostSaturation(c, 1.3));
  colors.sort((a, b) => luminance(a) - luminance(b));

  return { colors };
};

export const applyAccent = (colors: RGB[]): void => {
  const s = document.documentElement.style;
  s.setProperty("--accent-rgb", colors[1]!.join(", "));
  s.setProperty("--accent-2-rgb", colors[2]!.join(", "));
  s.setProperty("--accent-3-rgb", colors[0]!.join(", "));
  s.setProperty("--accent-4-rgb", colors[3]!.join(", "));
};
