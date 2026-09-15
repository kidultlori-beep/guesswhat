import sharp from "sharp";
import { getGame } from "./server";

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return entities[character];
  });
}

function displayAuthor(author: string) {
  const cleaned = author.trim().replace(/\s+/g, " ").slice(0, 28);
  return cleaned || "A PLAYER";
}

export async function renderShareCard(input: {
  image: Buffer | Uint8Array;
  stackNumber: number;
  floorIndex: number;
  author: string;
}) {
  const drawing = await sharp(Buffer.from(input.image))
    .resize(570, 380, { fit: "cover", position: "center" })
    .png()
    .toBuffer();
  const imageData = drawing.toString("base64");
  const stack = String(input.stackNumber).padStart(3, "0");
  const author = escapeXml(displayAuthor(input.author));

  const svg = `
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="630" fill="#F8F0E3"/>
      <line x1="54" y1="49" x2="1146" y2="49" stroke="#A7372F" stroke-width="3"/>
      <text x="54" y="94" fill="#A7372F" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="4">DRAWSTACKS</text>
      <text x="1146" y="94" text-anchor="end" fill="#4B443D" font-family="Arial, sans-serif" font-size="17" letter-spacing="2">STACK ${stack}  /  FLOOR ${input.floorIndex}</text>
      <rect x="54" y="126" width="598" height="408" rx="2" fill="#FFFDF8" stroke="#4B443D" stroke-width="2"/>
      <image x="68" y="140" width="570" height="380" href="data:image/png;base64,${imageData}" preserveAspectRatio="xMidYMid slice"/>
      <rect x="44" y="136" width="598" height="408" fill="none" stroke="#D8B14C" stroke-width="5"/>
      <line x1="710" y1="126" x2="1146" y2="126" stroke="#A7372F" stroke-width="1.5"/>
      <text x="710" y="190" fill="#332E2A" font-family="Georgia, 'Times New Roman', serif" font-size="56" font-weight="700">Can you guess</text>
      <text x="710" y="252" fill="#332E2A" font-family="Georgia, 'Times New Roman', serif" font-size="56" font-style="italic">this drawing?</text>
      <line x1="710" y1="284" x2="1146" y2="284" stroke="#A7372F" stroke-width="1.5"/>
      <text x="710" y="336" fill="#6B6259" font-family="Arial, sans-serif" font-size="21" letter-spacing="0.5">SOLVE IT TO DRAW THE NEXT FLOOR.</text>
      <text x="710" y="430" fill="#4B443D" font-family="Georgia, 'Times New Roman', serif" font-size="25" font-style="italic">Drawn by ${author}</text>
      <circle cx="719" cy="491" r="7" fill="#A7372F"/>
      <text x="739" y="499" fill="#A7372F" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="2">DRAW · GUESS · BUILD TOGETHER</text>
      <line x1="54" y1="581" x2="1146" y2="581" stroke="#A7372F" stroke-width="3"/>
    </svg>`;

  return sharp(Buffer.from(svg))
    .flatten({ background: "#F8F0E3" })
    .toColourspace("srgb")
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

export async function shareCardResponse(floorId: string) {
  const game = getGame();
  const floor = game.db
    .prepare(
      `SELECT f.image,f.floor_index floor,s.number,u.nickname author
       FROM floors f JOIN stacks s ON s.id=f.stack_id JOIN users u ON u.id=f.author_id
       WHERE f.id=?`,
    )
    .get(floorId) as
    | { image: Buffer; floor: number; number: number; author: string }
    | undefined;
  if (!floor) return new Response("Drawing not found.", { status: 404 });

  const body = await renderShareCard({
    image: floor.image,
    stackNumber: floor.number,
    floorIndex: floor.floor,
    author: floor.author,
  });
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=86400",
      "Content-Disposition": 'inline; filename="drawstacks.jpg"',
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
