export const getDominantColors = (image) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const sampleSize = 60;

  canvas.width = sampleSize;
  canvas.height = sampleSize;
  context.drawImage(image, 0, 0, sampleSize, sampleSize);

  const pixelData = context.getImageData(0, 0, sampleSize, sampleSize).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  let brightR = 0;
  let brightG = 0;
  let brightB = 0;
  let brightCount = 0;

  for (let index = 0; index < pixelData.length; index += 16) {
    const alpha = pixelData[index + 3] / 255;

    if (alpha < 0.5) {
      continue;
    }

    const red = pixelData[index];
    const green = pixelData[index + 1];
    const blue = pixelData[index + 2];
    const brightness = 0.299 * red + 0.587 * green + 0.114 * blue;

    r += red;
    g += green;
    b += blue;
    count += 1;

    if (brightness > 110) {
      brightR += red;
      brightG += green;
      brightB += blue;
      brightCount += 1;
    }
  }

  const base = count
    ? [Math.round(r / count), Math.round(g / count), Math.round(b / count)]
    : [255, 116, 116];

  const bright = brightCount
    ? [Math.round(brightR / brightCount), Math.round(brightG / brightCount), Math.round(brightB / brightCount)]
    : base.map((value) => Math.min(255, Math.round(value * 1.18 + 10)));

  return { base, bright };
};

export const applyAccent = (base, bright) => {
  document.documentElement.style.setProperty("--accent-rgb", base.join(", "));
  document.documentElement.style.setProperty("--accent-2-rgb", bright.join(", "));
};
