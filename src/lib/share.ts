import { HOME_OG_FILE } from "./og-home-file";

// Bump this path token when the floor JPEG renderer changes so crawlers
// fetch a filename they have never cached. Do not version with a query
// string: X's image fetcher often ignores `?v=` on image URLs.
export const FLOOR_OG_TAG = "ds1";

export function homeOgImagePath() {
  return `/og/${HOME_OG_FILE}`;
}

export function floorOgImagePath(floorId: string) {
  return `/og/x/${encodeURIComponent(floorId)}-${FLOOR_OG_TAG}.jpg`;
}

export function floorIdFromOgSlug(slug: string) {
  const decoded = decodeURIComponent(slug);
  const name = decoded.toLowerCase().endsWith(".jpg")
    ? decoded.slice(0, -4)
    : decoded;
  const suffix = `-${FLOOR_OG_TAG}`;
  if (!name.endsWith(suffix)) return null;
  const id = name.slice(0, -suffix.length);
  return id || null;
}

export function canonicalShareOrigin(fallback: string) {
  try {
    const url = new URL(fallback);
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
    const local =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname.endsWith(".local");
    if (!local && url.protocol === "http:") url.protocol = "https:";
    return url.origin;
  } catch {
    return fallback.replace(/\/$/, "");
  }
}

export function floorSharePath(stackId: string, floorId: string) {
  return `/stacks/${encodeURIComponent(stackId)}?floor=${encodeURIComponent(floorId)}`;
}

export function floorShareAbsoluteUrl(
  origin: string,
  stackId: string,
  floorId: string,
) {
  return `${canonicalShareOrigin(origin)}${floorSharePath(stackId, floorId)}`;
}

export function browserShareOrigin() {
  if (typeof document !== "undefined") {
    const href = document
      .querySelector('link[rel="canonical"]')
      ?.getAttribute("href");
    if (href) {
      try {
        return canonicalShareOrigin(new URL(href, window.location.href).origin);
      } catch {}
    }
  }
  if (typeof window !== "undefined")
    return canonicalShareOrigin(window.location.origin);
  return "";
}

export function floorShareText(stackNumber: number, floorIndex: number) {
  return `Can you guess Floor ${floorIndex} in Stack #${String(stackNumber).padStart(3, "0")}? Draw the next floor on DrawStacks!`;
}

export function xShareUrl(url: string, text: string) {
  const intent = new URL("https://x.com/intent/tweet");
  intent.searchParams.set("text", text);
  intent.searchParams.set("url", url);
  return intent.toString();
}

export function absoluteAssetUrl(path: string, origin: string) {
  return new URL(path, `${canonicalShareOrigin(origin)}/`).toString();
}

export function ogImageDescriptor(url: string, alt: string) {
  return {
    url,
    secureUrl: url,
    width: 1200,
    height: 630,
    type: "image/jpeg",
    alt,
  };
}
