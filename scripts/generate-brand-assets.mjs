import { mkdir, readFile } from "node:fs/promises";
import sharp from "sharp";

await mkdir("public/icons", { recursive: true });
await mkdir("public/og", { recursive: true });

const icon = await readFile("src/app/icon.svg");
await Promise.all([
  sharp(icon).resize(32, 32).png().toFile("public/icons/favicon-32.png"),
  sharp(icon).resize(96, 96).png().toFile("public/icons/favicon-96.png"),
]);

const home = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#F8F0E3"/>
  <line x1="62" y1="58" x2="1138" y2="58" stroke="#A7372F" stroke-width="3"/>
  <text x="62" y="105" fill="#A7372F" font-family="Arial, sans-serif" font-size="19" font-weight="700" letter-spacing="5">DRAWSTACKS</text>
  <text x="1138" y="105" text-anchor="end" fill="#6B6259" font-family="Arial, sans-serif" font-size="17" letter-spacing="2">A COLLABORATIVE DRAWING GAME</text>
  <text x="62" y="252" fill="#332E2A" font-family="Georgia, 'Times New Roman', serif" font-size="82" font-weight="700">Every drawing</text>
  <text x="62" y="342" fill="#332E2A" font-family="Georgia, 'Times New Roman', serif" font-size="82" font-style="italic">builds a story.</text>
  <line x1="62" y1="389" x2="730" y2="389" stroke="#A7372F" stroke-width="1.5"/>
  <text x="62" y="447" fill="#6B6259" font-family="Arial, sans-serif" font-size="25" letter-spacing="1">PICK A STACK, GUESS THE WORD,</text>
  <text x="62" y="485" fill="#6B6259" font-family="Arial, sans-serif" font-size="25" letter-spacing="1">AND DRAW THE NEXT FLOOR.</text>
  <rect x="864" y="169" width="237" height="237" fill="#D8B14C"/>
  <rect x="891" y="196" width="237" height="237" fill="#FFFDF8" stroke="#332E2A" stroke-width="4"/>
  <path d="M936 358c39-113 82 44 146-106" fill="none" stroke="#A7372F" stroke-width="12" stroke-linecap="round"/>
  <circle cx="936" cy="358" r="7" fill="#A7372F"/>
  <circle cx="1082" cy="252" r="7" fill="#A7372F"/>
  <text x="1138" y="532" text-anchor="end" fill="#A7372F" font-family="Arial, sans-serif" font-size="19" font-weight="700" letter-spacing="3">DRAW · GUESS · BUILD TOGETHER</text>
  <line x1="62" y1="572" x2="1138" y2="572" stroke="#A7372F" stroke-width="3"/>
</svg>`;

const homeCard = await sharp(Buffer.from(home))
  .flatten({ background: "#F8F0E3" })
  .toColourspace("srgb")
  .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
  .toBuffer();
await Promise.all([
  sharp(homeCard).toFile("public/og/home.jpg"),
  sharp(homeCard).toFile("public/og/card.jpg"),
]);
