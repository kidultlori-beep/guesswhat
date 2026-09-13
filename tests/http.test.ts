import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { PNG } from "pngjs";
let server: ChildProcess;
const root = "http://127.0.0.1:3101";
let output = "";
before(async () => {
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3101",
    ],
    {
      windowsHide: true,
      stdio: "pipe",
      env: {
        ...process.env,
        DRAWSTACKS_DB: resolve(`data/http-${process.pid}-${Date.now()}.sqlite`),
      },
    },
  );
  server.stdout?.on("data", (d) => (output += d.toString()));
  server.stderr?.on("data", (d) => (output += d.toString()));
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(output);
    try {
      if (output.includes("Ready") && (await fetch(`${root}/api/me`)).ok)
        return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Test server failed to start: ${output}`);
});
after(() => server?.kill());
async function call(
  path: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
  headers: Record<string, string> = {},
) {
  return fetch(`${root}/api/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-DrawStacks": "1",
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function player(nickname: string) {
  const r = await call("me", "PUT", { nickname });
  assert.equal(r.status, 200);
  return {
    user: (await r.json()).user,
    cookie: r.headers.get("set-cookie")!.split(";")[0],
  };
}
test("real HTTP publication, permissions, private guesses, social actions, relay and images", async () => {
  const a = await player("HTTP Alice"),
    b = await player("HTTP Bob");
  const png = new PNG({ width: 960, height: 640 });
  for (let i = 0; i < 400; i += 4) {
    png.data[i] = 47;
    png.data[i + 1] = 128;
    png.data[i + 2] = 237;
    png.data[i + 3] = 255;
  }
  const image = `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
  assert.equal((await call("stacks", "POST", {})).status, 401);
  assert.equal(
    (
      await call("me", "PUT", { nickname: "no csrf" }, undefined, {
        "X-DrawStacks": "0",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("me", "PUT", { nickname: "cross site" }, undefined, {
        Origin: "https://evil.example",
      })
    ).status,
    403,
  );
  const created = await call(
    "stacks",
    "POST",
    { word: "bicycle", key: "http-create-1", image },
    a.cookie,
  );
  assert.equal(created.status, 201);
  const s = await created.json();
  const publicView = await (await call(`stacks/${s.id}`)).json();
  assert.equal(publicView.word, null);
  assert.equal(publicView.floors.length, 1);
  assert.equal(publicView.creator, "HTTP Alice");
  const img = await call(`floors/${s.floor}/image`);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get("content-type"), "image/png");
  assert.equal(PNG.sync.read(Buffer.from(await img.arrayBuffer())).width, 960);
  assert.equal(
    (await call(`floors/${s.floor}/comments`, "GET", undefined, b.cookie))
      .status,
    403,
  );
  const wrong = await (
    await call(`stacks/${s.id}/guess`, "POST", { guess: "car" }, b.cookie)
  ).json();
  assert.equal(wrong.correct, false);
  assert.equal(wrong.state.remaining, 4);
  assert.equal(wrong.state.word, null);
  const own = await (
    await call(`stacks/${s.id}`, "GET", undefined, a.cookie)
  ).json();
  assert.equal(own.guesses.length, 0);
  assert.equal(own.word, "bicycle");
  const solve = await (
    await call(`stacks/${s.id}/guess`, "POST", { guess: "bike" }, b.cookie)
  ).json();
  assert.equal(solve.correct, true);
  assert.equal(solve.state.canDraw, true);
  assert.equal(
    (await call(`floors/${s.floor}/like`, "PUT", { liked: true }, b.cookie))
      .status,
    200,
  );
  assert.equal(
    (await call(`floors/${s.floor}/like`, "PUT", { liked: true }, a.cookie))
      .status,
    403,
  );
  assert.equal(
    (
      await call(
        `floors/${s.floor}/comments`,
        "POST",
        { text: "Lovely!" },
        b.cookie,
      )
    ).status,
    201,
  );
  const comments = await (
    await call(`floors/${s.floor}/comments`, "GET", undefined, a.cookie)
  ).json();
  assert.equal(comments.comments[0].text, "Lovely!");
  assert.equal(
    (await call(`comments/${comments.comments[0].id}`, "DELETE", {}, a.cookie))
      .status,
    404,
  );
  assert.equal(
    (await call(`comments/${comments.comments[0].id}`, "DELETE", {}, b.cookie))
      .status,
    200,
  );
  const relay = await call(
    `stacks/${s.id}/draw`,
    "POST",
    { image, parent: s.floor, key: "http-relay-1" },
    b.cookie,
  );
  assert.equal(relay.status, 201);
  assert.equal((await (await call(`stacks/${s.id}`)).json()).floors.length, 2);
  const rank = await (await call("leaderboards?tab=artists")).json();
  assert.equal(rank.rows[0].id, a.user.id);
  assert.equal(rank.rows[0].score, 1);
  assert.equal(
    (
      await (
        await call("me", "GET", undefined, `drawstacks_session=${a.user.id}`)
      ).json()
    ).user,
    null,
  );
});
