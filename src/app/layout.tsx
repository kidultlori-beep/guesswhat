import type { Metadata } from "next";
import "@fontsource/patrick-hand/400.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "./globals.css";
import { homeOgImagePath } from "@/lib/share";

const title = "DrawStacks — Draw. Guess. Build together.";
const description =
  "New answers and a new drawing on every floor. A collaborative drawing and guessing game.";
const homeCard = homeOgImagePath();
const homeImage = {
  url: homeCard,
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: title,
};

export const metadata: Metadata = {
  title,
  description,
  metadataBase: new URL(
    process.env.DRAWSTACKS_PUBLIC_URL || "http://localhost:3000",
  ),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title,
    description,
    url: "/",
    siteName: "DrawStacks",
    images: [homeImage],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [homeImage],
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
