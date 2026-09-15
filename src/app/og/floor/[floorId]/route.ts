import { shareCardResponse } from "@/lib/share-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ floorId: string }> },
) {
  const { floorId } = await context.params;
  return shareCardResponse(floorId);
}

export async function HEAD(
  _request: Request,
  context: { params: Promise<{ floorId: string }> },
) {
  const { floorId } = await context.params;
  const response = await shareCardResponse(floorId);
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}
