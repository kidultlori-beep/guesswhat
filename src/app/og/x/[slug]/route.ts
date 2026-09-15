import { shareCardResponse } from "@/lib/share-card";
import { floorIdFromOgSlug } from "@/lib/share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function card(slug: string) {
  const floorId = floorIdFromOgSlug(slug);
  if (!floorId) return new Response("Drawing not found.", { status: 404 });
  return shareCardResponse(floorId);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  return card(slug);
}

export async function HEAD(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const response = await card(slug);
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}
