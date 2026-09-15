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
