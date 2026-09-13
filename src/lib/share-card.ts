import { PNG } from "pngjs";

const glyphs: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  "#": ["01010", "11111", "01010", "01010", "11111", "01010", "01010"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00110", "00110"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

type Color = [number, number, number, number?];
const cream: Color = [251, 244, 233],
  charcoal: Color = [52, 52, 52],
  blue: Color = [47, 128, 237],
  paleBlue: Color = [221, 235, 255],
  yellow: Color = [248, 190, 53],
  white: Color = [255, 255, 255],
  muted: Color = [98, 96, 93];

function pixel(png: PNG, x: number, y: number, color: Color) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const i = (y * png.width + x) * 4;
  png.data[i] = color[0];
  png.data[i + 1] = color[1];
  png.data[i + 2] = color[2];
  png.data[i + 3] = color[3] ?? 255;
}

function rect(
  png: PNG,
  x: number,
  y: number,
  w: number,
  h: number,
  color: Color,
) {
  for (let py = y; py < y + h; py++)
    for (let px = x; px < x + w; px++) pixel(png, px, py, color);
}

function frame(
  png: PNG,
  x: number,
  y: number,
  w: number,
  h: number,
  width: number,
  color: Color,
) {
  rect(png, x, y, w, width, color);
  rect(png, x, y + h - width, w, width, color);
  rect(png, x, y, width, h, color);
  rect(png, x + w - width, y, width, h, color);
}

function circle(
  png: PNG,
  cx: number,
  cy: number,
  radius: number,
  color: Color,
) {
  for (let y = -radius; y <= radius; y++)
    for (let x = -radius; x <= radius; x++)
      if (x * x + y * y <= radius * radius) pixel(png, cx + x, cy + y, color);
}

function text(
  png: PNG,
  value: string,
  x: number,
  y: number,
  scale: number,
  color: Color,
) {
  let cursor = x;
  for (const raw of value.toUpperCase()) {
    const glyph = glyphs[raw] || glyphs["?"];
    for (let gy = 0; gy < glyph.length; gy++)
      for (let gx = 0; gx < 5; gx++)
        if (glyph[gy][gx] === "1")
          rect(png, cursor + gx * scale, y + gy * scale, scale, scale, color);
    cursor += scale * 6;
  }
}

function drawing(
  png: PNG,
  source: PNG,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  for (let py = 0; py < h; py++)
    for (let px = 0; px < w; px++) {
      const sx = Math.min(
        source.width - 1,
        Math.floor((px / w) * source.width),
      );
      const sy = Math.min(
        source.height - 1,
        Math.floor((py / h) * source.height),
      );
      const sourceIndex = (sy * source.width + sx) * 4;
      pixel(png, x + px, y + py, [
        source.data[sourceIndex],
        source.data[sourceIndex + 1],
        source.data[sourceIndex + 2],
        source.data[sourceIndex + 3],
      ]);
    }
}

export function renderShareCard(input: {
  image: Buffer | Uint8Array;
  stackNumber: number;
  floorIndex: number;
  author: string;
}) {
  const card = new PNG({ width: 1200, height: 630 });
  rect(card, 0, 0, card.width, card.height, cream);
  rect(card, 32, 48, 654, 500, yellow);
  frame(card, 32, 48, 654, 500, 4, charcoal);
  rect(card, 52, 66, 654, 500, white);
  frame(card, 52, 66, 654, 500, 4, charcoal);
  drawing(card, PNG.sync.read(Buffer.from(input.image)), 69, 83, 620, 414);
  rect(card, 69, 514, 620, 35, paleBlue);
  text(card, "A DRAWSTACKS FLOOR", 84, 522, 3, blue);

  circle(card, 758, 104, 28, blue);
  circle(card, 758, 104, 18, cream);
  text(card, "DRAWSTACKS", 801, 85, 6, charcoal);
  rect(card, 738, 158, 378, 49, paleBlue);
  text(
    card,
    `STACK #${String(input.stackNumber).padStart(3, "0")} / FLOOR ${input.floorIndex}`,
    756,
    170,
    3,
    blue,
  );
  text(card, "CAN YOU GUESS", 738, 246, 5, charcoal);
  text(card, "THIS DRAWING?", 738, 294, 5, charcoal);
  text(card, "SOLVE IT TO DRAW", 740, 376, 3, muted);
  text(card, "THE NEXT FLOOR.", 740, 405, 3, muted);
  const asciiAuthor = /^[A-Za-z0-9 _-]+$/.test(input.author)
    ? input.author.slice(0, 20)
    : "A PLAYER";
  text(card, `DRAWN BY ${asciiAuthor}`, 740, 476, 3, muted);
  text(card, "DRAW. GUESS. BUILD TOGETHER.", 740, 522, 2, blue);
  return PNG.sync.write(card);
}
