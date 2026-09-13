// SQLite-backed game rules, validation and ranking calculations; all writes are transactional.
import { DatabaseSync } from "node:sqlite";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { PNG } from "pngjs";
import { WORDS, ALIASES, normalize } from "./words";
import type { User, StackDetail, StackSummary, Floor, RankRow } from "./types";

export class GameError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (status: number, message: string): never => {
  throw new GameError(status, message);
};
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const text = (value: unknown, min: number, max: number) => {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    fail(400, `Please enter ${min}–${max} characters.`);
  return (value as string).trim();
};
type StackRow = {
  id: string;
  number: number;
  word: string;
  creator_id: string;
  created: number;
  updated: number;
};
export class Game {
  db: DatabaseSync;
  constructor(
    path: string,
    public now = () => Date.now(),
  ) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;",
    );
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, nickname TEXT NOT NULL, session_hash TEXT UNIQUE NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS stacks(number INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, word TEXT NOT NULL, creator_id TEXT NOT NULL REFERENCES users(id), created INTEGER NOT NULL, updated INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS floors(id TEXT PRIMARY KEY, stack_id TEXT NOT NULL REFERENCES stacks(id), author_id TEXT NOT NULL REFERENCES users(id), floor_index INTEGER NOT NULL, image BLOB NOT NULL, preview BLOB NOT NULL, created INTEGER NOT NULL, UNIQUE(stack_id, floor_index), UNIQUE(stack_id, author_id));
      CREATE TABLE IF NOT EXISTS guesses(id INTEGER PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), stack_id TEXT NOT NULL REFERENCES stacks(id), text TEXT NOT NULL, correct INTEGER NOT NULL, created INTEGER NOT NULL, UNIQUE(user_id,stack_id,text));
      CREATE UNIQUE INDEX IF NOT EXISTS one_solve ON guesses(user_id,stack_id) WHERE correct=1;
      CREATE TABLE IF NOT EXISTS meters(user_id TEXT NOT NULL REFERENCES users(id), stack_id TEXT NOT NULL REFERENCES stacks(id), remaining INTEGER NOT NULL, anchor INTEGER NOT NULL, PRIMARY KEY(user_id,stack_id));
      CREATE TABLE IF NOT EXISTS likes(user_id TEXT NOT NULL REFERENCES users(id), floor_id TEXT NOT NULL REFERENCES floors(id), created INTEGER NOT NULL, PRIMARY KEY(user_id,floor_id));
      CREATE TABLE IF NOT EXISTS comments(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), floor_id TEXT NOT NULL REFERENCES floors(id), text TEXT NOT NULL, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS publications(user_id TEXT NOT NULL REFERENCES users(id), key TEXT NOT NULL, stack_id TEXT NOT NULL REFERENCES stacks(id), floor_id TEXT NOT NULL REFERENCES floors(id), PRIMARY KEY(user_id,key));
      CREATE INDEX IF NOT EXISTS floor_stack ON floors(stack_id,floor_index);
      CREATE INDEX IF NOT EXISTS comment_floor ON comments(floor_id,created);
    `);
  }
  transaction<T>(action: () => T) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = action();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  user(token?: string): User | null {
    if (!token || token.length > 200) return null;
    return (
      (this.db
        .prepare(
          "SELECT id,nickname FROM users WHERE session_hash=? AND expires>?",
        )
        .get(hash(token), this.now()) as unknown as User) || null
    );
  }
  identify(nickname: unknown, token?: string) {
    const name = text(nickname, 1, 20);
    if (!/^[\p{L}\p{N} _-]+$/u.test(name))
      fail(400, "Use letters, numbers, spaces, underscores or hyphens.");
    const user = this.user(token);
    if (user) {
      this.db
        .prepare("UPDATE users SET nickname=? WHERE id=?")
        .run(name, user.id);
      return { user: { ...user, nickname: name }, token };
    }
    const fresh = randomBytes(32).toString("hex"),
      id = randomUUID();
    this.db
      .prepare("INSERT INTO users VALUES(?,?,?,?)")
      .run(id, name, hash(fresh), this.now() + 30 * 86400000);
    return { user: { id, nickname: name }, token: fresh };
  }
  stack(id: string) {
    return (
      (this.db
        .prepare("SELECT * FROM stacks WHERE id=?")
        .get(id) as StackRow) || fail(404, "Stack not found.")
    );
  }
  solved(uid: string | undefined, id: string) {
    return (
      !!uid &&
      !!this.db
        .prepare(
          "SELECT 1 FROM guesses WHERE user_id=? AND stack_id=? AND correct=1",
        )
        .get(uid, id)
    );
  }
  contributed(uid: string | undefined, id: string) {
    return (
      !!uid &&
      !!this.db
        .prepare("SELECT 1 FROM floors WHERE author_id=? AND stack_id=?")
        .get(uid, id)
    );
  }
  meter(uid: string | undefined, id: string) {
    const now = this.now();
    const row = uid
      ? (this.db
          .prepare(
            "SELECT remaining,anchor FROM meters WHERE user_id=? AND stack_id=?",
          )
          .get(uid, id) as { remaining: number; anchor: number } | undefined)
      : undefined;
    if (!row) return { remaining: 5, anchor: now, resetAt: null };
    const ticks = Math.max(0, Math.floor((now - row.anchor) / 60000)),
      remaining = Math.min(5, row.remaining + ticks);
    const anchor = remaining === 5 ? now : row.anchor + ticks * 60000;
    return {
      remaining,
      anchor,
      resetAt: remaining === 5 ? null : anchor + 60000,
    };
  }
  list(uid?: string, offset = 0): StackSummary[] {
    const rows = this.db
      .prepare(
        `SELECT s.id,s.number,u.nickname creator,s.updated,
      (SELECT COUNT(*) FROM floors WHERE stack_id=s.id) count,
      (SELECT id FROM floors WHERE stack_id=s.id ORDER BY floor_index DESC LIMIT 1) latest,
      (SELECT COUNT(*) FROM likes l JOIN floors f ON l.floor_id=f.id WHERE f.stack_id=s.id) likes
      FROM stacks s JOIN users u ON u.id=s.creator_id ORDER BY s.updated DESC,s.number DESC LIMIT 12 OFFSET ?`,
      )
      .all(Math.max(0, offset)) as Omit<
      StackSummary,
      "solved" | "contributed"
    >[];
    return rows.map((r) => ({
      ...r,
      solved: this.solved(uid, r.id),
      contributed: this.contributed(uid, r.id),
    }));
  }
  detail(id: string, uid?: string): StackDetail {
    const s = this.stack(id),
      solved = this.solved(uid, id),
      contributed = this.contributed(uid, id);
    const floors = this.db
      .prepare(
        `SELECT f.id,f.floor_index AS 'index',f.author_id authorId,u.nickname author,f.created,
      (SELECT COUNT(*) FROM likes WHERE floor_id=f.id) likes,
      EXISTS(SELECT 1 FROM likes WHERE floor_id=f.id AND user_id=?) liked,
      (SELECT COUNT(*) FROM comments WHERE floor_id=f.id) comments
      FROM floors f JOIN users u ON u.id=f.author_id WHERE f.stack_id=? ORDER BY f.floor_index`,
      )
      .all(uid ?? "", id) as unknown as Floor[];
    const creator = (
      this.db
        .prepare("SELECT nickname FROM users WHERE id=?")
        .get(s.creator_id) as { nickname: string }
    ).nickname;
    const guesses = uid
      ? (this.db
          .prepare(
            "SELECT text,correct FROM guesses WHERE stack_id=? AND user_id=? ORDER BY id DESC LIMIT 50",
          )
          .all(id, uid) as unknown as { text: string; correct: boolean }[])
      : [];
    const meter = this.meter(uid, id);
    return {
      id: s.id,
      number: s.number,
      creator,
      creatorId: s.creator_id,
      floors: floors.map((f) => ({ ...f, liked: !!f.liked })),
      word: solved || uid === s.creator_id ? s.word : null,
      solved,
      contributed,
      canDraw: solved && !contributed && floors.length < 50,
      remaining: meter.remaining,
      resetAt: meter.resetAt,
      now: this.now(),
      guesses: guesses.map((g) => ({ ...g, correct: !!g.correct })),
    };
  }
  image(data: unknown) {
    if (
      typeof data !== "string" ||
      data.length > 2800000 ||
      !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data)
    )
      fail(400, "Please submit a valid PNG drawing (under 2 MB).");
    let png: PNG;
    try {
      const bytes = Buffer.from((data as string).split(",")[1], "base64");
      if (
        bytes.length > 2000000 ||
        bytes.length < 24 ||
        bytes.readUInt32BE(16) !== 960 ||
        bytes.readUInt32BE(20) !== 640
      )
        fail(400, "Drawing must be 960 × 640 pixels.");
      png = PNG.sync.read(bytes, { checkCRC: true });
    } catch {
      return fail(400, "Drawing must be a valid 960 × 640 PNG.");
    }
    let marks = 0;
    for (let i = 0; i < png.data.length; i += 4)
      if (
        png.data[i + 3] > 10 &&
        Math.min(png.data[i], png.data[i + 1], png.data[i + 2]) < 245
      )
        marks++;
    if (marks < 8) fail(400, "Your canvas is empty. Draw something first!");
    // Re-encode pixel data to discard metadata or attached content.
    const image = PNG.sync.write(png),
      thumb = new PNG({ width: 300, height: 200 });
    for (let y = 0; y < 200; y++)
      for (let x = 0; x < 300; x++) {
        const src = (Math.floor(y * 3.2) * 960 + Math.floor(x * 3.2)) * 4,
          dest = (y * 300 + x) * 4;
        png.data.copy(thumb.data, dest, src, src + 4);
      }
    return { image, preview: PNG.sync.write(thumb) };
  }
  publish(
    uid: string,
    input: { word?: unknown; image?: unknown; key?: unknown; parent?: unknown },
    stackId?: string,
  ) {
    const key = text(input.key, 8, 100);
    const old = this.db
      .prepare(
        "SELECT stack_id id,floor_id floor FROM publications WHERE user_id=? AND key=?",
      )
      .get(uid, key) as { id: string; floor: string } | undefined;
    if (old) return old;
    const pixels = this.image(input.image);
    return this.transaction(() => {
      // Another process may have committed this key while image validation ran.
      const repeated = this.db
        .prepare(
          "SELECT stack_id id,floor_id floor FROM publications WHERE user_id=? AND key=?",
        )
        .get(uid, key) as { id: string; floor: string } | undefined;
      if (repeated) return repeated;
      let id = stackId,
        index = 1;
      if (id) {
        this.stack(id);
        if (!this.solved(uid, id))
          fail(403, "Solve this stack before drawing the next floor.");
        if (this.contributed(uid, id))
          fail(409, "You already contributed to this stack.");
        const latest = this.db
          .prepare(
            "SELECT id,floor_index FROM floors WHERE stack_id=? ORDER BY floor_index DESC LIMIT 1",
          )
          .get(id) as { id: string; floor_index: number };
        if (latest.floor_index >= 50)
          fail(409, "This stack is complete. Start a new one!");
        if (latest.id !== input.parent)
          fail(
            409,
            "A new floor arrived. Review it before publishing your saved drawing.",
          );
        index = latest.floor_index + 1;
      } else {
        if (
          typeof input.word !== "string" ||
          !(WORDS as readonly string[]).includes(input.word)
        )
          fail(400, "Choose a word from the suggestions.");
        id = randomUUID();
        this.db
          .prepare(
            "INSERT INTO stacks(id,word,creator_id,created,updated) VALUES(?,?,?,?,?)",
          )
          .run(id, input.word as string, uid, this.now(), this.now());
      }
      const floor = randomUUID();
      this.db
        .prepare("INSERT INTO floors VALUES(?,?,?,?,?,?,?)")
        .run(floor, id, uid, index, pixels.image, pixels.preview, this.now());
      this.db
        .prepare("UPDATE stacks SET updated=? WHERE id=?")
        .run(this.now(), id);
      this.db
        .prepare("INSERT INTO publications VALUES(?,?,?,?)")
        .run(uid, key, id, floor);
      return { id, floor };
    });
  }
  guess(uid: string, id: string, raw: unknown) {
    const guess = normalize(text(raw, 1, 40));
    return this.transaction(() => {
      const s = this.stack(id);
      if (s.creator_id === uid)
        fail(403, "You created this stack. Let someone else guess!");
      if (this.solved(uid, id)) return { correct: true, duplicate: true };
      if (
        this.db
          .prepare(
            "SELECT 1 FROM guesses WHERE user_id=? AND stack_id=? AND text=?",
          )
          .get(uid, id, guess)
      )
        return { correct: false, duplicate: true };
      const meter = this.meter(uid, id);
      if (meter.remaining < 1)
        fail(429, "No tries left yet. Wait for the next refill.");
      const correct =
        guess === s.word || (ALIASES[s.word] ?? []).includes(guess);
      this.db
        .prepare(
          "INSERT INTO guesses(user_id,stack_id,text,correct,created) VALUES(?,?,?,?,?)",
        )
        .run(uid, id, guess, Number(correct), this.now());
      if (!correct)
        this.db
          .prepare(
            "INSERT INTO meters VALUES(?,?,?,?) ON CONFLICT(user_id,stack_id) DO UPDATE SET remaining=excluded.remaining,anchor=excluded.anchor",
          )
          .run(uid, id, meter.remaining - 1, meter.anchor);
      return { correct, duplicate: false };
    });
  }
  floor(id: string) {
    return (
      (this.db
        .prepare("SELECT id,stack_id,author_id FROM floors WHERE id=?")
        .get(id) as { id: string; stack_id: string; author_id: string }) ||
      fail(404, "Drawing not found.")
    );
  }
  like(uid: string, id: string, liked: boolean) {
    const f = this.floor(id);
    if (f.author_id === uid) fail(403, "You cannot like your own drawing.");
    if (liked)
      this.db
        .prepare("INSERT OR IGNORE INTO likes VALUES(?,?,?)")
        .run(uid, id, this.now());
    else
      this.db
        .prepare("DELETE FROM likes WHERE user_id=? AND floor_id=?")
        .run(uid, id);
  }
  canComment(uid: string | undefined, floor: string) {
    const f = this.floor(floor),
      s = this.stack(f.stack_id);
    return !!uid && (uid === s.creator_id || this.solved(uid, s.id));
  }
  comments(uid: string | undefined, floor: string) {
    if (!this.canComment(uid, floor))
      fail(403, "Comments unlock after you solve this stack.");
    return this.db
      .prepare(
        "SELECT c.id,c.user_id authorId,u.nickname author,c.text,c.created FROM comments c JOIN users u ON u.id=c.user_id WHERE c.floor_id=? ORDER BY c.created,c.id LIMIT 200",
      )
      .all(floor);
  }
  comment(uid: string, floor: string, raw: unknown) {
    if (!this.canComment(uid, floor))
      fail(403, "Solve the stack before commenting.");
    const content = text(raw, 1, 300);
    const recent = this.db
      .prepare("SELECT COUNT(*) n FROM comments WHERE user_id=? AND created>?")
      .get(uid, this.now() - 60000) as { n: number };
    if (recent.n >= 10)
      fail(429, "A few too many comments. Try again in a minute.");
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO comments VALUES(?,?,?,?,?)")
      .run(id, uid, floor, content, this.now());
    return { id };
  }
  removeComment(uid: string, id: string) {
    const result = this.db
      .prepare("DELETE FROM comments WHERE id=? AND user_id=?")
      .run(id, uid);
    if (!result.changes) fail(404, "Comment not found or not yours.");
  }
  rankings(tab: string, uid?: string) {
    let rows: Omit<RankRow, "rank">[];
    if (tab === "stacks")
      rows = this.db
        .prepare(
          `SELECT s.id,printf('Stack #%03d',s.number) name,COUNT(f.id) score,u.nickname creator,
      (SELECT id FROM floors WHERE stack_id=s.id ORDER BY floor_index DESC LIMIT 1) image
      FROM stacks s JOIN floors f ON f.stack_id=s.id JOIN users u ON u.id=s.creator_id GROUP BY s.id ORDER BY score DESC,s.updated,s.id`,
        )
        .all() as typeof rows;
    else if (tab === "guessers")
      rows = this.db
        .prepare(
          "SELECT u.id,u.nickname name,COUNT(g.id) score FROM users u JOIN guesses g ON g.user_id=u.id AND g.correct=1 GROUP BY u.id ORDER BY score DESC,MAX(g.created),u.id",
        )
        .all() as typeof rows;
    else if (tab === "artists")
      rows = this.db
        .prepare(
          "SELECT u.id,u.nickname name,COUNT(l.user_id) score FROM users u JOIN floors f ON f.author_id=u.id JOIN likes l ON l.floor_id=f.id GROUP BY u.id ORDER BY score DESC,MAX(l.created),u.id",
        )
        .all() as typeof rows;
    else return fail(400, "Unknown leaderboard.");
    const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));
    return {
      rows: ranked.slice(0, 20),
      mine: ranked.find((r) => r.id === uid) ?? null,
    };
  }
  contributions(uid: string) {
    return this.db
      .prepare(
        "SELECT f.id,f.stack_id stackId,f.floor_index AS floor,s.number,(SELECT COUNT(*) FROM likes WHERE floor_id=f.id) likes FROM floors f JOIN stacks s ON s.id=f.stack_id WHERE f.author_id=? ORDER BY f.created DESC LIMIT 100",
      )
      .all(uid);
  }
}
