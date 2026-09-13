export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/${path}`, {
      method,
      cache: "no-store",
      headers:
        method === "GET"
          ? {}
          : { "Content-Type": "application/json", "X-DrawStacks": "1" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "Cannot reach the game. Check your connection and try again.",
      0,
    );
  }
  const data = await res.json();
  if (!res.ok)
    throw new ApiError(data.error || "Please try again.", res.status);
  return data;
}
export const stackName = (n: number) => `Stack #${String(n).padStart(3, "0")}`;
export const imageUrl = (id: string, preview = false) =>
  `/api/floors/${id}/image${preview ? "?preview=1" : ""}`;
export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Please try again.";
export function draftKey(uid: string, stack?: string) {
  return `drawstacks:draft:${uid}:${stack || "new"}`;
}
export function freshKey() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(20)), (v) =>
        v.toString(16).padStart(2, "0"),
      ).join("");
}
