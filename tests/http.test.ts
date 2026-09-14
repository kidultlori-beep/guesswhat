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
    {
      word: " ELON MUSK,马斯克,elon musk ",
      hint: "A technology founder.",
      key: "http-create-1",
      image,
    },
    a.cookie,
  );
  assert.equal(created.status, 201);
  const s = await created.json();
  assert.equal((await call("words")).status, 404);
  const publicView = await (await call(`stacks/${s.id}`)).json();
  assert.equal(publicView.word, null);
  assert.equal(publicView.floors.length, 1);
  assert.equal(publicView.creator, "HTTP Alice");
  assert.equal(publicView.floors[0].hint, "A technology founder.");
  const img = await call(`floors/${s.floor}/image`);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get("content-type"), "image/png");
  assert.equal(PNG.sync.read(Buffer.from(await img.arrayBuffer())).width, 960);
  let shareCard: Response;
  try {
    shareCard = await call(`share-card/${s.floor}`);
  } catch (error) {
    throw new Error(
      `Share-card request failed: ${error}\nServer output:\n${output}`,
    );
  }
  if (shareCard.status !== 200)
    throw new Error(
      `Share card returned ${shareCard.status}: ${await shareCard.text()}\nServer output:\n${output}`,
    );
  assert.match(shareCard.headers.get("content-type") || "", /^image\/png/);
  const card = PNG.sync.read(Buffer.from(await shareCard.arrayBuffer()));
  assert.equal(card.width, 1200);
  assert.equal(card.height, 630);
  const sharedPage = await fetch(
    `${root}/stacks/${s.id}?floor=${encodeURIComponent(s.floor)}`,
  );
  const sharedHtml = await sharedPage.text();
  assert.match(sharedHtml, /summary_large_image/);
  assert.ok(sharedHtml.includes(`/api/share-card/${s.floor}`));
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
  assert.equal(wrong.state.guesses[0].text, "car");
  assert.equal(wrong.state.guesses[0].author, "HTTP Bob");
  const own = await (
    await call(`stacks/${s.id}`, "GET", undefined, a.cookie)
  ).json();
  assert.equal(own.guesses[0].text, "car");
  assert.equal(own.word, "ELON MUSK,马斯克");
  const solve = await (
    await call(`stacks/${s.id}/guess`, "POST", { guess: "马斯克" }, b.cookie)
  ).json();
  assert.equal(solve.correct, true);
  assert.equal(solve.state.canDraw, true);
  assert.equal((await call(`floors/${s.floor}/comments`)).status, 200);
  const c = await player("HTTP Charlie");
  assert.equal(
    (
      await call(
        `stacks/${s.id}/guess`,
        "POST",
        { guess: "  elon  musk  " },
        c.cookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        "stacks",
        "POST",
        {
          word: "bad,,answer",
          hint: "Invalid answers.",
          key: "http-invalid-answer",
          image,
        },
        a.cookie,
      )
    ).status,
    400,
  );
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
  const posted = comments.comments.find(
    (item: { kind: string }) => item.kind === "comment",
  );
  const solved = comments.comments.find(
    (item: { kind: string }) => item.kind === "solve",
  );
  assert.equal(posted.text, "Lovely!");
  assert.equal(solved.guess, "马斯克");
  assert.equal(solved.answers, "ELON MUSK,马斯克");
  assert.equal(
    (await call(`comments/${posted.id}`, "DELETE", {}, a.cookie)).status,
    404,
  );
  assert.equal(
    (await call(`comments/${posted.id}`, "DELETE", {}, b.cookie)).status,
    200,
  );
  const relay = await call(
    `stacks/${s.id}/draw`,
    "POST",
    {
      image,
      word: "rocket,火箭",
      hint: "It launches into space.",
      parent: s.floor,
      key: "http-relay-1",
    },
    b.cookie,
  );
  assert.equal(relay.status, 201);
  assert.equal((await (await call(`stacks/${s.id}`)).json()).floors.length, 2);
  const alerts = await (
    await call("notifications", "GET", undefined, a.cookie)
  ).json();
  assert.equal(alerts.notifications[0].actor, "HTTP Bob");
  assert.equal(alerts.notifications[0].guess, "马斯克");
  assert.equal(alerts.notifications[0].read, false);
  assert.equal((await call("notifications", "PUT", {}, a.cookie)).status, 200);
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
