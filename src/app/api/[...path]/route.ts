// JSON API: validate sessions and same-origin writes before applying server-side game rules.
import { NextRequest, NextResponse } from "next/server";
import { game } from "@/lib/server";
import { GameError } from "@/lib/game";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(req: NextRequest) {
  try {
    const p = req.nextUrl.pathname.slice(5).split("/"),
      method = req.method;
    const token = req.cookies.get("drawstacks_session")?.value,
      user = game.user(token);
    let body: Record<string, unknown> = {};
    if (method !== "GET") {
      if (req.headers.get("x-drawstacks") !== "1")
        throw new GameError(403, "Missing request header.");
      const origin = req.headers.get("origin");
      if (origin && new URL(origin).host !== req.headers.get("host"))
        throw new GameError(403, "Cross-site requests are not allowed.");
      const reader = req.body?.getReader(),
        chunks: Uint8Array[] = [];
      let length = 0;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.length;
          if (length > 3000000) {
            await reader.cancel();
            throw new GameError(413, "Drawing is too large.");
          }
          chunks.push(value);
        }
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString() || "{}");
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
          throw new Error();
        body = parsed;
      } catch {
        throw new GameError(400, "Invalid request.");
      }
    }
    const json = (data: unknown, status = 200) =>
      NextResponse.json(data, {
        status,
        headers: { "Cache-Control": "no-store" },
      });
    if (p[0] === "me" && p.length === 1) {
      if (method === "GET") return json({ user });
      if (method === "PUT") {
        const result = game.identify(body.nickname, token),
          res = json({ user: result.user });
        res.cookies.set("drawstacks_session", result.token!, {
          httpOnly: true,
          sameSite: "lax",
          secure: req.nextUrl.protocol === "https:",
          path: "/",
          maxAge: 30 * 86400,
        });
        return res;
      }
    }
    if (method === "GET") {
      if (p[0] === "stacks" && p.length === 1) {
        const offset = Number(req.nextUrl.searchParams.get("offset") || 0);
        return json({
          stacks: game.list(
            user?.id,
            Number.isSafeInteger(offset) ? offset : 0,
          ),
        });
      }
      if (p[0] === "stacks" && p.length === 2)
        return json(game.detail(p[1], user?.id));
      if (p[0] === "floors" && p[2] === "image") {
        const column = req.nextUrl.searchParams.has("preview")
          ? "preview"
          : "image";
        const row = game.db
          .prepare(`SELECT ${column} data FROM floors WHERE id=?`)
          .get(p[1]) as { data: Buffer } | undefined;
        if (!row) throw new GameError(404, "Drawing not found.");
        return new NextResponse(new Uint8Array(row.data), {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      if (p[0] === "floors" && p[2] === "comments")
        return json({ comments: game.comments(user?.id, p[1]) });
      if (p[0] === "leaderboards")
        return json(
          game.rankings(
            req.nextUrl.searchParams.get("tab") || "stacks",
            user?.id,
          ),
        );
      if (p[0] === "users" && p[2] === "contributions")
        return json({ floors: game.contributions(p[1]) });
      if (p[0] === "notifications")
        return json({ notifications: user ? game.notifications(user.id) : [] });
      throw new GameError(404, "Endpoint not found.");
    }
    if (!user) throw new GameError(401, "Choose a nickname to join in.");
    if (method === "POST" && p[0] === "stacks") {
      if (p.length === 1) return json(game.publish(user.id, body), 201);
      if (p[2] === "draw") return json(game.publish(user.id, body, p[1]), 201);
      if (p[2] === "guess")
        return json({
          ...game.guess(user.id, p[1], body.guess),
          state: game.detail(p[1], user.id),
        });
    }
    if (method === "PUT" && p[0] === "floors" && p[2] === "like") {
      if (typeof body.liked !== "boolean")
        throw new GameError(400, "Choose a like state.");
      game.like(user.id, p[1], body.liked);
      return json({ ok: true });
    }
    if (method === "PUT" && p[0] === "notifications") {
      game.readNotifications(user.id);
      return json({ ok: true });
    }
    if (method === "POST" && p[0] === "floors" && p[2] === "comments")
      return json(game.comment(user.id, p[1], body.text), 201);
    if (method === "DELETE" && p[0] === "comments") {
      game.removeComment(user.id, p[1]);
      return json({ ok: true });
    }
    throw new GameError(404, "Endpoint not found.");
  } catch (error) {
    if (error instanceof GameError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error(error);
    return NextResponse.json(
      {
        error: "Something went wrong. Please try again.",
      },
      { status: 500 },
    );
  }
}
export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
