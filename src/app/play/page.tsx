import GameApp from "@/components/GameApp";
import type { Metadata } from "next";
import { publicOrigin } from "@/lib/public-origin";
import {
  absoluteAssetUrl,
  HOME_SHARE_DESCRIPTION,
  HOME_SHARE_TITLE,
  homeOgImagePath,
  homeShareAbsoluteUrl,
  ogImageDescriptor,
} from "@/lib/share";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await publicOrigin();
  const pageUrl = homeShareAbsoluteUrl(origin);
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

export default async function PlayPage() {
  const origin = await publicOrigin();
  const image = absoluteAssetUrl(homeOgImagePath(), origin);
  return (
    <>
      <link rel="image_src" href={image} />
      <GameApp />
    </>
  );
}
