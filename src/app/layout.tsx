import type { Metadata } from "next";
import "@fontsource/patrick-hand/400.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "DrawStacks — Draw. Guess. Build together.",
  description:
    "New answers and a new drawing on every floor. A collaborative drawing and guessing game.",
  metadataBase: new URL(
    process.env.DRAWSTACKS_PUBLIC_URL || "http://localhost:3000",
  ),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title: "DrawStacks — Draw. Guess. Build together.",
    description:
      "New answers and a new drawing on every floor. A collaborative drawing and guessing game.",
    url: "/",
    siteName: "DrawStacks",
    images: [
      {
        url: "/og/home.jpg",
        width: 1200,
        height: 630,
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DrawStacks — Draw. Guess. Build together.",
    description:
      "New answers and a new drawing on every floor. A collaborative drawing and guessing game.",
    images: ["/og/home.jpg"],
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
