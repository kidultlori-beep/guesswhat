import type { Metadata } from "next";
import "@fontsource/patrick-hand/400.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "./globals.css";
import {
  HOME_SHARE_DESCRIPTION,
  HOME_SHARE_TITLE,
  absoluteAssetUrl,
  homeOgImagePath,
  ogImageDescriptor,
} from "@/lib/share";

const title = HOME_SHARE_TITLE;
const description = HOME_SHARE_DESCRIPTION;
const metadataOrigin =
  process.env.DRAWSTACKS_PUBLIC_URL || "http://localhost:3000";
const homeCard = absoluteAssetUrl(homeOgImagePath(), metadataOrigin);
const homeImage = ogImageDescriptor(homeCard, title);

export const metadata: Metadata = {
  title,
  description,
  metadataBase: new URL(metadataOrigin),
  openGraph: {
    type: "website",
    title,
    description,
    siteName: "DrawStacks",
    images: [homeImage],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [homeImage],
  },
  other: {
    "og:image:secure_url": homeCard,
    "twitter:image:src": homeCard,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-96.png", sizes: "96x96", type: "image/png" },
    ],
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
