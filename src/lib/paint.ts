/** Connected pixel fill. Works on transparent pixels as well as opaque paper. */
export function floodFill(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  hex: string,
  opacity: number,
  tolerance: number,
) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const start = (y * width + x) * 4,
    target = Array.from(data.slice(start, start + 4));
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const seen = new Uint8Array(width * height),
    queue = new Int32Array(width * height);
  let head = 0,
    tail = 1;
  queue[0] = y * width + x;
  seen[queue[0]] = 1;
  while (head < tail) {
    const pos = queue[head++],
      i = pos * 4;
    // Compare premultiplied color: RGB in fully transparent pixels is irrelevant.
    const matches =
      Math.abs(data[i + 3] - target[3]) <= tolerance &&
      [0, 1, 2].every(
        (c) =>
          Math.abs(
            (data[i + c] * data[i + 3]) / 255 - (target[c] * target[3]) / 255,
          ) <= tolerance,
      );
    if (!matches) continue;
    const alpha = opacity + (data[i + 3] / 255) * (1 - opacity);
    for (let c = 0; c < 3; c++)
      data[i + c] = alpha
        ? (rgb[c] * opacity +
            ((data[i + c] * data[i + 3]) / 255) * (1 - opacity)) /
          alpha
        : 0;
    data[i + 3] = alpha * 255;
    const px = pos % width,
      py = Math.floor(pos / width);
    for (const n of [
      px > 0 ? pos - 1 : -1,
      px < width - 1 ? pos + 1 : -1,
      py > 0 ? pos - width : -1,
      py < height - 1 ? pos + width : -1,
    ])
      if (n >= 0 && !seen[n]) {
        seen[n] = 1;
        queue[tail++] = n;
      }
  }
}
