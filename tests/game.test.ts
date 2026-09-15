import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { Game, GameError } from "../src/lib/game";
import { PNG } from "pngjs";
import { parseAnswers, matchesAnswer } from "../src/lib/answers";
import {
  canonicalShareOrigin,
  floorIdFromOgSlug,
  floorOgImagePath,
  floorShareAbsoluteUrl,
  floorSharePath,
  floorShareText,
  HOME_SHARE_PATH,
  homeOgImagePath,
  homeShareAbsoluteUrl,
  xShareUrl,
} from "../src/lib/share";
import { floodFill } from "../src/lib/paint";
import { renderShareCard } from "../src/lib/share-card";
import sharp from "sharp";
import { mkdtempSync, existsSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
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
    word: "bicycle,bike",
    hint: "It has two wheels.",
    image: picture,
    key: "initial-0001",
  });
  return { game, a, b, c, s, advance: (ms: number) => (now += ms) };
}
function status(code: number) {
  return (e: unknown) => e instanceof GameError && e.status === code;
}
test("custom answers trim, normalize spacing and deduplicate", () => {
  assert.deepEqual(parseAnswers(" ELON  MUSK,马斯克,elon musk "), [
    "ELON MUSK",
    "马斯克",
  ]);
  assert.deepEqual(parseAnswers("Cafe\u0301,CAFÉ"), ["Café"]);
});
test("custom answers reject invalid separators, blanks and oversized input", () => {
  for (const raw of [
    "",
    null,
    123,
    " , ",
    ",cat",
    "cat,",
    "cat,,dog",
    "ELON MUSK，马斯克",
    "x".repeat(81),
    Array.from({ length: 11 }, (_, i) => `answer${i}`).join(","),
    "x".repeat(810),
    "cat\u0000",
  ])
    assert.throws(() => parseAnswers(raw));
  assert.equal(parseAnswers("a".repeat(80))[0].length, 80);
  assert.equal(
    parseAnswers(Array.from({ length: 10 }, (_, i) => String(i)).join(","))
      .length,
    10,
  );
});
test("exact phrase matching accepts either language, not partials or comma-separated guesses", () => {
  for (const guess of ["ELON MUSK", "elon musk", "  Elon   Musk  ", "马斯克"])
    assert.equal(matchesAnswer(guess, "ELON MUSK,马斯克"), true);
  for (const guess of [
    "Elon",
    "Musk",
    "马斯",
    "ELON MUSK,马斯克",
    "billionaire",
    "",
  ])
    assert.equal(matchesAnswer(guess, "ELON MUSK,马斯克"), false);
  assert.equal(matchesAnswer("bike", "bicycle"), false);
  assert.equal(matchesAnswer(" CAT ", "cat"), true);
  assert.equal(matchesAnswer("CAFÉ", "Cafe\u0301"), true);
});

test("share links preserve the selected floor and build an encoded X intent", () => {
  const path = floorSharePath("stack / 1", "floor ? 2");
  assert.equal(path, "/stacks/stack%20%2F%201?floor=floor%20%3F%202");
  const text = floorShareText(7, 3);
  assert.equal(
    text,
    "Can you guess Floor 3 in Stack #007? Draw the next floor on DrawStacks!",
  );
  const intent = new URL(xShareUrl(`https://draw.example${path}`, text));
  assert.equal(intent.origin, "https://x.com");
  assert.equal(intent.pathname, "/intent/tweet");
  assert.equal(intent.searchParams.get("text"), text);
  assert.equal(intent.searchParams.get("url"), `https://draw.example${path}`);
  assert.match(homeOgImagePath(), /^\/og\/ds-home-[0-9a-f]{12}\.jpg$/);
  assert.equal(homeOgImagePath().includes("?"), false);
  assert.equal(floorOgImagePath("floor ? 2"), "/og/x/floor%20%3F%202-ds1.jpg");
  assert.equal(floorIdFromOgSlug("abc-ds1.jpg"), "abc");
  assert.equal(floorIdFromOgSlug("abc.jpg"), null);
  assert.equal(
    canonicalShareOrigin("http://draw.annieway.world"),
    "https://draw.annieway.world",
  );
  assert.equal(
    canonicalShareOrigin("http://localhost:3000"),
    "http://localhost:3000",
  );
  assert.equal(
    floorShareAbsoluteUrl("http://draw.annieway.world/", "s", "f"),
    "https://draw.annieway.world/stacks/s?floor=f",
  );
  assert.equal(HOME_SHARE_PATH, "/play");
  assert.equal(
    homeShareAbsoluteUrl("http://draw.annieway.world"),
    "https://draw.annieway.world/play",
  );
  const homeIntent = new URL(
    xShareUrl(homeShareAbsoluteUrl("https://draw.annieway.world"), "Play"),
  );
  assert.equal(
    homeIntent.searchParams.get("url"),
    "https://draw.annieway.world/play",
  );
});
test("share cards render as opaque JPEG without answers", async () => {
  const card = await renderShareCard({
    image: Buffer.from(picture.split(",")[1], "base64"),
    stackNumber: 12,
    floorIndex: 3,
    author: "Alice",
  });
  const meta = await sharp(card).metadata();
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.width, 1200);
  assert.equal(meta.height, 630);
  assert.equal(meta.channels, 3);
  assert.equal(meta.space, "srgb");
});
test("a correct answer reveals that floor, creates a public event and notifies its artist", (t) => {
  const { game, a, b, c } = setup(t);
  const s = game.publish(a.user.id, {
    word: " ELON   MUSK,马斯克,elon musk ",
    hint: "A famous technology founder.",
    image: picture,
    key: "custom-answers-1",
  });
  assert.equal(game.detail(s.id, a.user.id).word, "ELON MUSK,马斯克");
  const publicData = JSON.stringify({
    detail: game.detail(s.id, b.user.id),
    list: game.list(),
    rank: game.rankings("stacks"),
  });
  assert(!publicData.includes("ELON MUSK"));
  assert(!publicData.includes("马斯克"));
  assert.equal(game.guess(b.user.id, s.id, "elon  musk").correct, true);
  assert.throws(() => game.guess(c.user.id, s.id, "马斯克"), status(409));
  assert.equal(game.guess(b.user.id, s.id, "马斯克").duplicate, true);
  assert.equal(game.rankings("guessers", b.user.id).mine?.score, 1);
  assert.equal(game.detail(s.id, b.user.id).remaining, 5);
  game.publish(
    b.user.id,
    {
      word: "SPACE X,太空探索技术公司",
      hint: "A private space company.",
      image: picture,
      key: "custom-relay-1",
      parent: s.floor,
    },
    s.id,
  );
  const detail = game.detail(s.id, c.user.id);
  assert.equal(detail.floors[0].answers, "ELON MUSK,马斯克");
  assert.equal(detail.word, null);
  const events = game.comments(undefined, s.floor);
  assert.equal(events[0].kind, "solve");
  assert.equal(events[0].guess, "elon musk");
  assert.equal(events[0].answers, "ELON MUSK,马斯克");
  const notifications = game.notifications(a.user.id);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].actor, "Bob");
  assert.equal(notifications[0].guess, "elon musk");
  assert.equal(notifications[0].read, false);
  game.readNotifications(a.user.id);
  assert.equal(game.notifications(a.user.id)[0].read, true);
  assert.throws(
    () =>
      game.publish(a.user.id, {
        word: "a,,b",
        hint: "An invalid answer test.",
        image: picture,
        key: "invalid-custom-1",
      }),
    status(400),
  );
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
test("existing single-answer stacks work without a migration or automatic aliases", (t) => {
  const { game, b, c, s } = setup(t);
  game.db
    .prepare("UPDATE floors SET answers=? WHERE id=?")
    .run("bicycle", s.floor);
  assert.equal(game.guess(b.user.id, s.id, "BICYCLE").correct, true);
  const other = game.publish(c.user.id, {
    word: "bicycle",
    hint: "It has two wheels.",
    image: picture,
    key: "legacy-single-2",
  });
  assert.equal(game.guess(b.user.id, other.id, "bike").correct, false);
});
test("answers stay private while wrong guesses and hints are public", (t) => {
  const { game, a, b, c, s } = setup(t);
  game.guess(b.user.id, s.id, "scooter");
  const publicData = JSON.stringify({
    list: game.list(),
    detail: game.detail(s.id, c.user.id),
    rank: game.rankings("stacks"),
    floors: game.contributions(a.user.id),
  });
  assert(!publicData.includes("bicycle"));
  assert(publicData.includes("scooter"));
  assert(publicData.includes("Bob"));
  assert(publicData.includes("It has two wheels."));
  assert(!publicData.includes(a.token!));
  assert.deepEqual(game.detail(s.id).guesses[0], {
    text: "scooter",
    correct: false,
    author: "Bob",
  });
  assert.deepEqual(game.detail(s.id).floors[0].guesses[0], {
    text: "scooter",
    correct: false,
    author: "Bob",
  });
  assert.equal(game.detail(s.id, b.user.id).word, null);
  assert.equal(game.detail(s.id, a.user.id).word, "bicycle,bike");
  assert.throws(() => game.comments(b.user.id, s.floor), status(403));
});
test("new floors require a concise public hint", (t) => {
  const { game, a } = setup(t);
  assert.throws(
    () =>
      game.publish(a.user.id, {
        word: "cat",
        image: picture,
        key: "missing-hint-1",
      }),
    status(400),
  );
  assert.throws(
    () =>
      game.publish(a.user.id, {
        word: "cat",
        hint: "x".repeat(161),
        image: picture,
        key: "long-hint-001",
      }),
    status(400),
  );
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
  assert.equal(game.detail(s.id, b.user.id).word, "bicycle,bike");
  game.guess(b.user.id, s.id, "bicycle");
  assert.equal(game.rankings("guessers").rows[0].score, 1);
  advance(600000);
  assert.equal(game.detail(s.id, b.user.id).remaining, 5);
});
test("relay requires solving latest floor, new answers, and supports alternating artists", (t) => {
  const { game, a, b, c, s } = setup(t);
  assert.deepEqual({ ...game.publish(a.user.id, { key: "initial-0001" }) }, s);
  assert.throws(() => game.guess(a.user.id, s.id, "bicycle"), status(403));
  assert.throws(
    () =>
      game.publish(
        b.user.id,
        {
          image: picture,
          word: "cat",
          hint: "It purrs.",
          key: "unsolved-01",
          parent: s.floor,
        },
        s.id,
      ),
    status(403),
  );
  game.guess(b.user.id, s.id, "bike");
  const second = game.publish(
    b.user.id,
    {
      image: picture,
      word: "cat,kitty",
      hint: "It purrs.",
      key: "second-0001",
      parent: s.floor,
    },
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
        {
          image: picture,
          word: "dog",
          hint: "A loyal pet.",
          key: "second-0002",
          parent: second.floor,
        },
        s.id,
      ),
    status(403),
  );
  assert.throws(
    () =>
      game.publish(
        c.user.id,
        {
          image: picture,
          word: "dog",
          hint: "A loyal pet.",
          key: "third-0001",
          parent: s.floor,
        },
        s.id,
      ),
    status(403),
  );
  game.guess(c.user.id, s.id, "kitty");
  const third = game.publish(
    c.user.id,
    {
      image: picture,
      word: "dog,puppy",
      hint: "A loyal pet.",
      key: "third-0001",
      parent: second.floor,
    },
    s.id,
  );
  game.guess(a.user.id, s.id, "puppy");
  game.publish(
    a.user.id,
    {
      image: picture,
      word: "moon",
      hint: "It shines at night.",
      key: "fourth-0001",
      parent: third.floor,
    },
    s.id,
  );
  assert.equal(game.detail(s.id).floors.length, 4);
  assert.equal(game.rankings("stacks").rows[0].score, 4);
});
test("solved floors keep wrong guesses, accepted answers and hints", (t) => {
  const { game, b, c, s } = setup(t);
  game.guess(b.user.id, s.id, "scooter");
  game.guess(c.user.id, s.id, "bike");
  game.publish(
    c.user.id,
    {
      word: "cat,kitty",
      hint: "It purrs.",
      image: picture,
      key: "history-relay-1",
      parent: s.floor,
    },
    s.id,
  );
  const publicDetail = game.detail(s.id, b.user.id);
  const past = publicDetail.floors[0];
  const latest = publicDetail.floors[1];
  assert.equal(past.hint, "It has two wheels.");
  assert.equal(past.answers, "bicycle,bike");
  assert.equal(past.winningGuess, "bike");
  assert.equal(past.winner, "Charlie");
  assert.deepEqual(past.guesses[0], {
    text: "scooter",
    correct: false,
    author: "Bob",
  });
  assert.equal(latest.answers, null);
  assert.equal(latest.winningGuess, null);
  assert.equal(latest.hint, "It purrs.");
  assert.equal(publicDetail.word, null);
  assert.equal(publicDetail.guesses.length, 0);
  const hidden = JSON.stringify({
    latest,
    list: game.list(),
    rank: game.rankings("stacks"),
  });
  assert(!hidden.includes("cat"));
  assert(!hidden.includes("kitty"));
});
test("home lists stacks by latest activity, not only new drawings", (t) => {
  const { game, a, b, s, advance } = setup(t);
  advance(1000);
  const newer = game.publish(a.user.id, {
    word: "cat",
    hint: "It purrs.",
    image: picture,
    key: "activity-newer-1",
  });
  assert.equal(game.list()[0].id, newer.id);
  advance(1000);
  game.like(b.user.id, s.floor, true);
  assert.equal(game.list()[0].id, s.id);
  advance(1000);
  game.guess(b.user.id, newer.id, "dog");
  assert.equal(game.list()[0].id, newer.id);
  advance(1000);
  game.guess(b.user.id, newer.id, "cat");
  advance(1000);
  const third = game.publish(a.user.id, {
    word: "moon",
    hint: "It shines at night.",
    image: picture,
    key: "activity-third-1",
  });
  assert.equal(game.list()[0].id, third.id);
  advance(1000);
  game.comment(b.user.id, newer.floor, "Nice!");
  assert.equal(game.list()[0].id, newer.id);
});
test("blank, malformed, wrong-size images rejected and no orphan stacks created", (t) => {
  const { game, a } = setup(t);
  assert.throws(
    () =>
      game.publish(a.user.id, {
        word: "cat",
        hint: "It purrs.",
        key: "blank-0001",
        image: drawing(true),
      }),
    status(400),
  );
  assert.throws(
    () =>
      game.publish(a.user.id, {
        word: "cat",
        hint: "It purrs.",
        key: "invalid-01",
        image: "data:image/png;base64,abc",
      }),
    status(400),
  );
  assert.throws(
    () =>
      game.publish(a.user.id, {
        word: " , ",
        hint: "An invalid answer test.",
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
    game.comments(a.user.id, s.floor).find((event) => event.kind === "comment")!
      .text,
    "<b>Great drawing!</b>",
  );
  assert.throws(() => game.removeComment(c.user.id, comment.id), status(404));
  game.removeComment(b.user.id, comment.id);
  assert.equal(
    game
      .comments(a.user.id, s.floor)
      .filter((event) => event.kind === "comment").length,
    0,
  );
});
test("50 floors completes stack, guesses and likes remain open", (t) => {
  const { game, a, b, s } = setup(t);
  const row = game.db
    .prepare("SELECT image,preview FROM floors WHERE id=?")
    .get(s.floor)!;
  for (let i = 2; i <= 50; i++) {
    const u = game.identify(`Builder ${i}`).user;
    game.db
      .prepare(
        "INSERT INTO floors(id,stack_id,author_id,floor_index,image,preview,created,answers) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(
        `floor-${i}`,
        s.id,
        u.id,
        i,
        row.image,
        row.preview,
        game.now() + i,
        "bike",
      );
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
  const tie = game.publish(a.user.id, {
    word: "cat",
    hint: "It purrs.",
    image: picture,
    key: "ranking-tie-2",
  });
  game.guess(c.user.id, tie.id, "cat");
  assert.equal(game.rankings("guessers").rows[0].id, b.user.id);
  const other = game.publish(c.user.id, {
    word: "cat",
    hint: "It purrs.",
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
      word: "ELON MUSK,马斯克",
      hint: "A famous technology founder.",
      key: "persistent-1",
    });
    game.guess(b.user.id, s.id, "马斯克");
    game.like(b.user.id, s.floor, true);
    game.comment(b.user.id, s.floor, "Still here");
    game.db.close();
    game = new Game(path);
    assert.equal(game.user(a.token)?.id, a.user.id);
    assert.equal(game.detail(s.id, b.user.id).word, "ELON MUSK,马斯克");
    assert.equal(game.detail(s.id).floors[0].likes, 1);
    assert.equal(
      game
        .comments(a.user.id, s.floor)
        .find((event) => event.kind === "comment")!.text,
      "Still here",
    );
    assert.equal(game.rankings("guessers").rows[0].score, 1);
  } finally {
    game?.db.close();
    for (const file of [path, `${path}-shm`, `${path}-wal`])
      if (existsSync(file)) unlinkSync(file);
    rmdirSync(dir);
  }
});
test("legacy stack database migrates answers per floor and allows artists to return", () => {
  const dir = mkdtempSync(join(tmpdir(), "drawstacks-legacy-")),
    path = join(dir, "legacy.sqlite");
  let game: Game | undefined;
  try {
    const legacy = new DatabaseSync(path);
    legacy.exec(`PRAGMA foreign_keys=ON;
      CREATE TABLE users(id TEXT PRIMARY KEY,nickname TEXT NOT NULL,session_hash TEXT UNIQUE NOT NULL,expires INTEGER NOT NULL);
      CREATE TABLE stacks(number INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,word TEXT NOT NULL,creator_id TEXT NOT NULL REFERENCES users(id),created INTEGER NOT NULL,updated INTEGER NOT NULL);
      CREATE TABLE floors(id TEXT PRIMARY KEY,stack_id TEXT NOT NULL REFERENCES stacks(id),author_id TEXT NOT NULL REFERENCES users(id),floor_index INTEGER NOT NULL,image BLOB NOT NULL,preview BLOB NOT NULL,created INTEGER NOT NULL,UNIQUE(stack_id,floor_index),UNIQUE(stack_id,author_id));
      CREATE TABLE guesses(id INTEGER PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),stack_id TEXT NOT NULL REFERENCES stacks(id),text TEXT NOT NULL,correct INTEGER NOT NULL,created INTEGER NOT NULL,UNIQUE(user_id,stack_id,text));`);
    legacy
      .prepare("INSERT INTO users VALUES(?,?,?,?)")
      .run("a", "Legacy A", "hash-a", 9999999999999);
    legacy
      .prepare("INSERT INTO users VALUES(?,?,?,?)")
      .run("b", "Legacy B", "hash-b", 9999999999999);
    legacy
      .prepare(
        "INSERT INTO stacks(id,word,creator_id,created,updated) VALUES(?,?,?,?,?)",
      )
      .run("stack", "cat,猫", "a", 1, 1);
    const pixels = Buffer.from(picture.split(",")[1], "base64");
    legacy
      .prepare("INSERT INTO floors VALUES(?,?,?,?,?,?,?)")
      .run("floor-1", "stack", "a", 1, pixels, pixels, 1);
    legacy.close();
    game = new Game(path);
    assert.equal(game.detail("stack", "a").word, "cat,猫");
    assert.deepEqual(game.db.prepare("PRAGMA foreign_key_check").all(), []);
    const schema = (
      game.db
        .prepare("SELECT sql FROM sqlite_master WHERE name='floors'")
        .get() as { sql: string }
    ).sql;
    assert(!/UNIQUE\s*\(\s*stack_id\s*,\s*author_id/i.test(schema));
    game.guess("b", "stack", "猫");
    const second = game.publish(
      "b",
      {
        word: "dog,狗",
        hint: "A loyal pet.",
        image: picture,
        key: "legacy-next-1",
        parent: "floor-1",
      },
      "stack",
    );
    game.guess("a", "stack", "dog");
    game.publish(
      "a",
      {
        word: "moon,月亮",
        hint: "It shines at night.",
        image: picture,
        key: "legacy-return-1",
        parent: second.floor,
      },
      "stack",
    );
    assert.equal(game.detail("stack").floors.length, 3);
  } finally {
    game?.db.close();
    for (const file of [path, `${path}-shm`, `${path}-wal`])
      if (existsSync(file)) unlinkSync(file);
    rmdirSync(dir);
  }
});
