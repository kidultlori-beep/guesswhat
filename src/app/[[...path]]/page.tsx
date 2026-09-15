import GameApp from "@/components/GameApp";
import type { Metadata } from "next";
import { getGame } from "@/lib/server";
import { publicOrigin } from "@/lib/public-origin";
import {
  HOME_SHARE_DESCRIPTION,
  HOME_SHARE_TITLE,
  absoluteAssetUrl,
  floorOgImagePath,
  floorShareAbsoluteUrl,
  homeOgImagePath,
  ogImageDescriptor,
} from "@/lib/share";

type PageProps = {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ShareFloor = {
  id: string;
  floor: number;
  number: number;
  author: string;
  stackId: string;
};

async function shareFloor(
  path: string[],
  searchParams: Record<string, string | string[] | undefined>,
): Promise<ShareFloor | null> {
  if (path[0] !== "stacks" || !path[1]) return null;
  const requested = Array.isArray(searchParams.floor)
    ? searchParams.floor[0]
    : searchParams.floor;
  const game = getGame();
  const floor = game.db
    .prepare(
      `SELECT f.id,f.floor_index floor,s.number,u.nickname author,s.id stackId
       FROM floors f JOIN stacks s ON s.id=f.stack_id JOIN users u ON u.id=f.author_id
       WHERE f.stack_id=? AND f.id=COALESCE(?,(SELECT id FROM floors WHERE stack_id=? ORDER BY floor_index DESC LIMIT 1))`,
    )
    .get(path[1], requested || null, path[1]) as ShareFloor | undefined;
  return floor ?? null;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { path = [] } = await params;
  const origin = await publicOrigin();
  const query = await searchParams;
  const floor = await shareFloor(path, query);
  if (!floor) {
    if (path.length > 0) return {};
    const pageUrl = origin;
    const cardUrl = absoluteAssetUrl(homeOgImagePath(), origin);
    const image = ogImageDescriptor(cardUrl, HOME_SHARE_TITLE);
    return {
      title: HOME_SHARE_TITLE,
      description: HOME_SHARE_DESCRIPTION,
      alternates: { canonical: pageUrl },
      openGraph: {
        type: "website",
        title: HOME_SHARE_TITLE,
        description: HOME_SHARE_DESCRIPTION,
        url: pageUrl,
        siteName: "DrawStacks",
        images: [image],
      },
      twitter: {
        card: "summary_large_image",
        title: HOME_SHARE_TITLE,
        description: HOME_SHARE_DESCRIPTION,
        images: [image],
      },
      other: {
        "og:image:secure_url": cardUrl,
        "twitter:image:src": cardUrl,
      },
    };
  }

  const title = `Can you guess Floor ${floor.floor}? — DrawStacks`;
  const description = `A drawing by ${floor.author} in Stack #${String(floor.number).padStart(3, "0")}. Solve it to draw the next floor.`;
  const pageUrl = floorShareAbsoluteUrl(origin, floor.stackId, floor.id);
  const cardUrl = absoluteAssetUrl(floorOgImagePath(floor.id), origin);
  const cardImage = ogImageDescriptor(cardUrl, title);
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
    other: {
      "og:image:secure_url": cardUrl,
      "twitter:image:src": cardUrl,
    },
  };
}

export default async function Page({ params, searchParams }: PageProps) {
  const origin = await publicOrigin();
  const { path = [] } = await params;
  const floor = await shareFloor(path, await searchParams);
  const image = floor
    ? absoluteAssetUrl(floorOgImagePath(floor.id), origin)
    : absoluteAssetUrl(homeOgImagePath(), origin);
  return (
    <>
      <link rel="image_src" href={image} />
      <GameApp />
    </>
  );
}
