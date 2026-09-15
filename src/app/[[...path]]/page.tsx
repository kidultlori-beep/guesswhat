import GameApp from "@/components/GameApp";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getGame } from "@/lib/server";
import { floorOgImagePath, floorSharePath } from "@/lib/share";

type PageProps = {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function publicOrigin() {
  const configured = process.env.DRAWSTACKS_PUBLIC_URL;
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "http:" || url.protocol === "https:")
        return url.origin;
    } catch {}
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const protocol = h.get("x-forwarded-proto") || "http";
  return `${protocol}://${host}`;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { path = [] } = await params;
  if (path[0] !== "stacks" || !path[1]) return {};

  const query = await searchParams;
  const requested = Array.isArray(query.floor) ? query.floor[0] : query.floor;
  const game = getGame();
  const floor = game.db
    .prepare(
      `SELECT f.id,f.floor_index floor,s.number,u.nickname author
       FROM floors f JOIN stacks s ON s.id=f.stack_id JOIN users u ON u.id=f.author_id
       WHERE f.stack_id=? AND f.id=COALESCE(?,(SELECT id FROM floors WHERE stack_id=? ORDER BY floor_index DESC LIMIT 1))`,
    )
    .get(path[1], requested || null, path[1]) as
    { id: string; floor: number; number: number; author: string } | undefined;
  if (!floor) return {};

  const origin = await publicOrigin();
  const title = `Can you guess Floor ${floor.floor}? — DrawStacks`;
  const description = `A drawing by ${floor.author} in Stack #${String(floor.number).padStart(3, "0")}. Solve it to draw the next floor.`;
  const pageUrl = `${origin}${floorSharePath(path[1], floor.id)}`;
  const cardUrl = `${origin}${floorOgImagePath(floor.id)}`;
  const cardImage = {
    url: cardUrl,
    secureUrl: cardUrl,
    width: 1200,
    height: 630,
    alt: title,
    type: "image/jpeg",
  };
  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "website",
      title,
      description,
      url: pageUrl,
      siteName: "DrawStacks",
      images: [cardImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [cardImage],
    },
  };
}

export default function Page() {
  return <GameApp />;
}
