import { getGame } from "@/lib/server";
import { renderShareCard } from "@/lib/share-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ floorId: string }> },
) {
  const { floorId } = await context.params;
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

  return new Response(
    new Uint8Array(
      await renderShareCard({
        image: floor.image,
        stackNumber: floor.number,
        floorIndex: floor.floor,
        author: floor.author,
      }),
    ),
    {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
