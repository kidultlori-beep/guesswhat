import { headers } from "next/headers";
import { canonicalShareOrigin } from "./share";

export async function publicOrigin() {
  const configured = process.env.DRAWSTACKS_PUBLIC_URL;
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "http:" || url.protocol === "https:")
        return canonicalShareOrigin(url.origin);
    } catch {}
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const protocol = h.get("x-forwarded-proto") || "http";
  return canonicalShareOrigin(`${protocol}://${host}`);
}
