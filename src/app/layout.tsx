import type { Metadata } from "next";
import "@fontsource/patrick-hand/400.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "DrawStacks — Draw. Guess. Build together.",
  description:
    "One secret word. A new drawing on every floor. A collaborative drawing and guessing game.",
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
