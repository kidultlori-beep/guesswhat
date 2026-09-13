import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { Game, GameError } from "../src/lib/game";
import { PNG } from "pngjs";
import { WORDS } from "../src/lib/words";
import { floodFill } from "../src/lib/paint";
import { mkdtempSync, existsSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
function drawing(blank = false) {
  const png = new PNG({ width: 960, height: 640 });
  if (!blank)
    for (let y = 100; y < 130; y++)
      for (let x = 100; x < 150; x++) {
        const i = (y * 960 + x) * 4;
        png.data[i] = 234;
        png.data[i + 1] = 85;
        png.data[i + 2] = 72;
        png.data[i + 3] = 255;
      }
  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
}
const picture = drawing();
function setup(t: TestContext) {
  let now = 1_000_000;
  const game = new Game(":memory:", () => now);
  t.after(() => game.db.close());
  const a = game.identify("Alice"),
    b = game.identify("Bob"),
    c = game.identify("Charlie");
  const s = game.publish(a.user.id, {
    word: "bicycle",
    image: picture,
    key: "initial-0001",
  });
  return { game, a, b, c, s, advance: (ms: number) => (now += ms) };
}
function status(code: number) {
  return (e: unknown) => e instanceof GameError && e.status === code;
}
test("curated word bank is exactly 80 unique words", () => {
  assert.equal(WORDS.length, 80);
  assert.equal(new Set(WORDS).size, 80);
});
test("sessions are private, expiring, independent from public ids", (t) => {
  const { game, a, advance } = setup(t);
  assert.equal(game.user(a.token)?.id, a.user.id);
  assert.equal(game.user(a.user.id), null);
  assert.equal(game.user("invented"), null);
  assert.equal(game.identify("New Name", a.token).user.id, a.user.id);
  assert.throws(() => game.identify("<script>"), status(400));
  advance(31 * 86400000);
  assert.equal(game.user(a.token), null);
});
test("answer and other players guesses never leak to unsolved viewers", (t) => {
  const { game, a, b, c, s } = setup(t);
  game.guess(b.user.id, s.id, "scooter");
  const publicData = JSON.stringify({
    list: game.list(),
    detail: game.detail(s.id, c.user.id),
    rank: game.rankings("stacks"),
    floors: game.contributions(a.user.id),
  });
  assert(!publicData.includes("bicycle"));
  assert(!publicData.includes("scooter"));
  assert(!publicData.includes(a.token!));
  assert.equal(game.detail(s.id, b.user.id).word, null);
  assert.equal(game.detail(s.id, a.user.id).word, "bicycle");
  assert.throws(() => game.comments(b.user.id, s.floor), status(403));
});
test("tries decrement once, normalize duplicates, refill on server time, correct is free", (t) => {
  const { game, b, s, advance } = setup(t);
  assert.throws(() => game.guess(b.user.id, s.id, "   "), status(400));
  game.guess(b.user.id, s.id, " Car ");
  assert.equal(game.detail(s.id, b.user.id).remaining, 4);
  assert.equal(game.guess(b.user.id, s.id, "CAR").duplicate, true);
  assert.equal(game.detail(s.id, b.user.id).remaining, 4);
  for (const g of ["bus", "train", "plane", "ship"])
    game.guess(b.user.id, s.id, g);
  assert.equal(game.detail(s.id, b.user.id).remaining, 0);
  assert.throws(() => game.guess(b.user.id, s.id, "bike"), status(429));
  advance(60000);
  assert.equal(game.detail(s.id, b.user.id).remaining, 1);
  assert.equal(game.guess(b.user.id, s.id, " BIKE ").correct, true);
  assert.equal(game.detail(s.id, b.user.id).remaining, 1);
  assert.equal(game.detail(s.id, b.user.id).word, "bicycle");
  game.guess(b.user.id, s.id, "bicycle");
  assert.equal(game.rankings("guessers").rows[0].score, 1);
  advance(600000);
  assert.equal(game.detail(s.id, b.user.id).remaining, 5);
});
test("relay requires solve, one floor/player, stale parent conflict, idempotent retry", (t) => {
  const { game, a, b, c, s } = setup(t);
  assert.deepEqual({ ...game.publish(a.user.id, { key: "initial-0001" }) }, s);
  assert.throws(() => game.guess(a.user.id, s.id, "bicycle"), status(403));
  assert.throws(
    () =>
      game.publish(
        b.user.id,
        { image: picture, key: "unsolved-01", parent: s.floor },
        s.id,
      ),
    status(403),
  );
  game.guess(b.user.id, s.id, "bike");
  game.guess(c.user.id, s.id, "bicycle");
  const second = game.publish(
    b.user.id,
    { image: picture, key: "second-0001", parent: s.floor },
    s.id,
  );
  assert.deepEqual(
    { ...game.publish(b.user.id, { key: "second-0001" }, s.id) },
    second,
  );
  assert.throws(
    () =>
      game.publish(
        b.user.id,
        { image: picture, key: "second-0002", parent: second.floor },
        s.id,
      ),
    status(409),
  );
  assert.throws(
    () =>
      game.publish(
        c.user.id,
        { image: picture, key: "third-0001", parent: s.floor },
        s.id,
      ),
    status(409),
  );
  game.publish(
    c.user.id,
    { image: picture, key: "third-0001", parent: second.floor },
    s.id,
  );
  assert.equal(game.detail(s.id).floors.length, 3);
  assert.equal(game.rankings("stacks").rows[0].score, 3);
});
test("blank, malformed, wrong-size images rejected and no orphan stacks created", (t) => {
  const { game, a } = setup(t);
  assert.throws(
    () =>
      game.publish(a.user.id, {
        word: "cat",
        key: "blank-0001",
        image: drawing(true),
      }),
    status(400),
  );
  assert.throws(
    () =>
      game.publish(a.user.id, {
        word: "cat",
        key: "invalid-01",
        image: "data:image/png;base64,abc",
      }),
    status(400),
  );
  assert.throws(
    () =>
      game.publish(a.user.id, {
        word: "not-in-bank",
        key: "invalid-02",
        image: picture,
      }),
    status(400),
  );
  assert.equal(game.list().length, 1);
  const row = game.db
    .prepare("SELECT image,preview FROM floors LIMIT 1")
    .get()!;
  assert.equal(PNG.sync.read(Buffer.from(row.image as Uint8Array)).width, 960);
  assert.equal(
    PNG.sync.read(Buffer.from(row.preview as Uint8Array)).width,
    300,
  );
});
test("likes are idempotent, no self likes, artists and homepage use live attribution", (t) => {
  const { game, a, b, c, s } = setup(t);
  assert.throws(() => game.like(a.user.id, s.floor, true), status(403));
  game.like(b.user.id, s.floor, true);
  game.like(b.user.id, s.floor, true);
  game.like(c.user.id, s.floor, true);
  assert.equal(game.list()[0].likes, 2);
  assert.equal(game.rankings("artists", a.user.id).mine?.score, 2);
  game.like(b.user.id, s.floor, false);
  assert.equal(game.rankings("artists").rows[0].score, 1);
  game.like(c.user.id, s.floor, false);
  assert.equal(game.rankings("artists").rows.length, 0);
});
test("comments locked until solved, validated, plain text, owner-only delete", (t) => {
  const { game, a, b, c, s } = setup(t);
  assert.throws(() => game.comment(b.user.id, s.floor, "spoiler"), status(403));
  game.guess(b.user.id, s.id, "bike");
  assert.throws(() => game.comment(b.user.id, s.floor, " "), status(400));
  assert.throws(
    () => game.comment(b.user.id, s.floor, "x".repeat(301)),
    status(400),
  );
  const comment = game.comment(b.user.id, s.floor, "<b>Great drawing!</b>");
  assert.equal(
    game.comments(a.user.id, s.floor)[0].text,
    "<b>Great drawing!</b>",
  );
  assert.throws(() => game.removeComment(c.user.id, comment.id), status(404));
  game.removeComment(b.user.id, comment.id);
  assert.equal(game.comments(a.user.id, s.floor).length, 0);
});
test("50 floors completes stack, guesses and likes remain open", (t) => {
  const { game, a, b, s } = setup(t);
  const row = game.db
    .prepare("SELECT image,preview FROM floors WHERE id=?")
    .get(s.floor)!;
  for (let i = 2; i <= 50; i++) {
    const u = game.identify(`Builder ${i}`).user;
    game.db
      .prepare("INSERT INTO floors VALUES(?,?,?,?,?,?,?)")
      .run(`floor-${i}`, s.id, u.id, i, row.image, row.preview, game.now() + i);
  }
  game.guess(b.user.id, s.id, "bike");
  assert.equal(game.detail(s.id, b.user.id).canDraw, false);
  assert.throws(
    () =>
      game.publish(
        b.user.id,
        { image: picture, key: "floor-51-key", parent: "floor-50" },
        s.id,
      ),
    status(409),
  );
  game.like(b.user.id, s.floor, true);
  assert.equal(game.detail(s.id, a.user.id).floors.length, 50);
});
test("ranking ties use earlier most-recent counted activity", (t) => {
  const { game, a, b, c, s, advance } = setup(t);
  game.guess(b.user.id, s.id, "bike");
  advance(100);
  game.guess(c.user.id, s.id, "bike");
  assert.equal(game.rankings("guessers").rows[0].id, b.user.id);
  const other = game.publish(c.user.id, {
    word: "cat",
    image: picture,
    key: "other-0001",
  });
  game.like(b.user.id, s.floor, true);
  advance(100);
  game.like(a.user.id, other.floor, true);
  assert.equal(game.rankings("artists").rows[0].id, a.user.id);
});
test("flood fill remains inside connected boundary and honors opacity", () => {
  const data = new Uint8ClampedArray(5 * 3 * 4);
  for (let y = 0; y < 3; y++) data[(y * 5 + 2) * 4 + 3] = 255;
  floodFill(data, 5, 3, 0, 0, "#EA5548", 1, 0);
  assert.deepEqual(Array.from(data.slice(0, 4)), [234, 85, 72, 255]);
  assert.equal(data[(0 * 5 + 4) * 4 + 3], 0);
  assert.equal(data[(0 * 5 + 2) * 4], 0);
  floodFill(data, 5, 3, 4, 0, "#2F80ED", 0.5, 0);
  assert.equal(data[(0 * 5 + 4) * 4 + 3], 128);
});
test("server restart preserves drawings, identity, guesses and statistics", () => {
  const dir = mkdtempSync(join(tmpdir(), "drawstacks-test-")),
    path = join(dir, "persistence.sqlite");
  let game: Game | undefined;
  try {
    game = new Game(path);
    const a = game.identify("Persistent Alice"),
      b = game.identify("Persistent Bob");
    const s = game.publish(a.user.id, {
      image: picture,
      word: "cat",
      key: "persistent-1",
    });
    game.guess(b.user.id, s.id, "cat");
    game.like(b.user.id, s.floor, true);
    game.comment(b.user.id, s.floor, "Still here");
    game.db.close();
    game = new Game(path);
    assert.equal(game.user(a.token)?.id, a.user.id);
    assert.equal(game.detail(s.id, b.user.id).word, "cat");
    assert.equal(game.detail(s.id).floors[0].likes, 1);
    assert.equal(game.comments(a.user.id, s.floor)[0].text, "Still here");
    assert.equal(game.rankings("guessers").rows[0].score, 1);
  } finally {
    game?.db.close();
    for (const file of [path, `${path}-shm`, `${path}-wal`])
      if (existsSync(file)) unlinkSync(file);
    rmdirSync(dir);
  }
});
