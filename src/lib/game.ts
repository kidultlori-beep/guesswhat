// SQLite-backed game rules, validation and ranking calculations; all writes are transactional.
import { DatabaseSync } from "node:sqlite";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { PNG } from "pngjs";
import {
  parseAnswers,
  matchesAnswer,
  normalize,
  MAX_ANSWER_LENGTH,
} from "./answers";
import { MAX_HINT_LENGTH } from "./types";
import type {
  User,
  StackDetail,
  StackSummary,
  Floor,
  FloorGuess,
  RankRow,
  Notification,
} from "./types";

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
      CREATE TABLE IF NOT EXISTS floors(id TEXT PRIMARY KEY, stack_id TEXT NOT NULL REFERENCES stacks(id), author_id TEXT NOT NULL REFERENCES users(id), floor_index INTEGER NOT NULL, image BLOB NOT NULL, preview BLOB NOT NULL, created INTEGER NOT NULL, answers TEXT, hint TEXT NOT NULL DEFAULT '', UNIQUE(stack_id, floor_index));
      CREATE TABLE IF NOT EXISTS guesses(id INTEGER PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), stack_id TEXT NOT NULL REFERENCES stacks(id), text TEXT NOT NULL, correct INTEGER NOT NULL, created INTEGER NOT NULL, UNIQUE(user_id,stack_id,text));
      CREATE UNIQUE INDEX IF NOT EXISTS one_solve ON guesses(user_id,stack_id) WHERE correct=1;
      CREATE TABLE IF NOT EXISTS meters(user_id TEXT NOT NULL REFERENCES users(id), stack_id TEXT NOT NULL REFERENCES stacks(id), remaining INTEGER NOT NULL, anchor INTEGER NOT NULL, PRIMARY KEY(user_id,stack_id));
      CREATE TABLE IF NOT EXISTS likes(user_id TEXT NOT NULL REFERENCES users(id), floor_id TEXT NOT NULL REFERENCES floors(id), created INTEGER NOT NULL, PRIMARY KEY(user_id,floor_id));
      CREATE TABLE IF NOT EXISTS comments(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), floor_id TEXT NOT NULL REFERENCES floors(id), text TEXT NOT NULL, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS publications(user_id TEXT NOT NULL REFERENCES users(id), key TEXT NOT NULL, stack_id TEXT NOT NULL REFERENCES stacks(id), floor_id TEXT NOT NULL REFERENCES floors(id), PRIMARY KEY(user_id,key));
      CREATE TABLE IF NOT EXISTS floor_guesses(id INTEGER PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), floor_id TEXT NOT NULL REFERENCES floors(id), text TEXT NOT NULL, correct INTEGER NOT NULL, created INTEGER NOT NULL, UNIQUE(user_id,floor_id,text));
      CREATE UNIQUE INDEX IF NOT EXISTS one_floor_solve ON floor_guesses(user_id,floor_id) WHERE correct=1;
      CREATE TABLE IF NOT EXISTS floor_meters(user_id TEXT NOT NULL REFERENCES users(id), floor_id TEXT NOT NULL REFERENCES floors(id), remaining INTEGER NOT NULL, anchor INTEGER NOT NULL, PRIMARY KEY(user_id,floor_id));
      CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), actor_id TEXT NOT NULL REFERENCES users(id), floor_id TEXT NOT NULL REFERENCES floors(id), guess TEXT NOT NULL, created INTEGER NOT NULL, read INTEGER NOT NULL DEFAULT 0);
      CREATE INDEX IF NOT EXISTS floor_stack ON floors(stack_id,floor_index);
      CREATE INDEX IF NOT EXISTS comment_floor ON comments(floor_id,created);
      CREATE INDEX IF NOT EXISTS notification_user ON notifications(user_id,read,created);
    `);
    const floorColumns = this.db.prepare("PRAGMA table_info(floors)").all() as {
      name: string;
    }[];
    if (!floorColumns.some((column) => column.name === "answers")) {
      this.db.exec("ALTER TABLE floors ADD COLUMN answers TEXT");
      this.db.exec(
        "UPDATE floors SET answers=(SELECT word FROM stacks WHERE stacks.id=floors.stack_id) WHERE answers IS NULL",
      );
    }
    if (!floorColumns.some((column) => column.name === "hint")) {
      this.db.exec(
        "ALTER TABLE floors ADD COLUMN hint TEXT NOT NULL DEFAULT ''",
      );
    }
    const floorSchema = (
      this.db
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type='table' AND name='floors'",
        )
        .get() as { sql: string }
    ).sql;
    if (/UNIQUE\s*\(\s*stack_id\s*,\s*author_id\s*\)/i.test(floorSchema)) {
      this.db.exec("PRAGMA foreign_keys=OFF");
      this.db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE floors_new(id TEXT PRIMARY KEY,stack_id TEXT NOT NULL REFERENCES stacks(id),author_id TEXT NOT NULL REFERENCES users(id),floor_index INTEGER NOT NULL,image BLOB NOT NULL,preview BLOB NOT NULL,created INTEGER NOT NULL,answers TEXT,hint TEXT NOT NULL DEFAULT '',UNIQUE(stack_id,floor_index));
        INSERT INTO floors_new(id,stack_id,author_id,floor_index,image,preview,created,answers,hint) SELECT id,stack_id,author_id,floor_index,image,preview,created,answers,hint FROM floors;
        DROP TABLE floors; ALTER TABLE floors_new RENAME TO floors; COMMIT;`);
      this.db.exec("PRAGMA foreign_keys=ON");
    }
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS floor_stack ON floors(stack_id,floor_index)",
    );
    const migrated = this.db
      .prepare("SELECT 1 FROM floor_guesses LIMIT 1")
      .get();
    if (!migrated) {
      this.db
        .exec(`INSERT OR IGNORE INTO floor_guesses(user_id,floor_id,text,correct,created)
        SELECT g.user_id,(SELECT id FROM floors f WHERE f.stack_id=g.stack_id ORDER BY f.floor_index DESC LIMIT 1),g.text,g.correct,g.created
        FROM guesses g WHERE EXISTS(SELECT 1 FROM floors f WHERE f.stack_id=g.stack_id)`);
    }
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
  solved(uid: string | undefined, floorId: string) {
    return (
      !!uid &&
      !!this.db
        .prepare(
          "SELECT 1 FROM floor_guesses WHERE user_id=? AND floor_id=? AND correct=1",
        )
        .get(uid, floorId)
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
  touch(stackId: string) {
    this.db
      .prepare("UPDATE stacks SET updated=? WHERE id=?")
      .run(this.now(), stackId);
  }
  floorHistory(floorIds: string[]) {
    const guesses = new Map<string, FloorGuess[]>();
    const winners = new Map<string, { text: string; author: string }>();
    if (!floorIds.length) return { guesses, winners };
    const placeholders = floorIds.map(() => "?").join(",");
    const wrong = this.db
      .prepare(
        `SELECT g.floor_id floorId,g.text,u.nickname author
         FROM floor_guesses g JOIN users u ON u.id=g.user_id
         WHERE g.correct=0 AND g.floor_id IN (${placeholders})
         ORDER BY g.id DESC`,
      )
      .all(...floorIds) as { floorId: string; text: string; author: string }[];
    for (const row of wrong) {
      const list = guesses.get(row.floorId) ?? [];
      if (list.length < 50)
        list.push({ text: row.text, correct: false, author: row.author });
      guesses.set(row.floorId, list);
    }
    const solved = this.db
      .prepare(
        `SELECT g.floor_id floorId,g.text,u.nickname author
         FROM floor_guesses g JOIN users u ON u.id=g.user_id
         WHERE g.correct=1 AND g.floor_id IN (${placeholders})`,
      )
      .all(...floorIds) as { floorId: string; text: string; author: string }[];
    for (const row of solved) winners.set(row.floorId, row);
    return { guesses, winners };
  }
  meter(uid: string | undefined, floorId: string) {
    const now = this.now();
    const row = uid
      ? (this.db
          .prepare(
            "SELECT remaining,anchor FROM floor_meters WHERE user_id=? AND floor_id=?",
          )
          .get(uid, floorId) as
          { remaining: number; anchor: number } | undefined)
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
      solved: this.solved(uid, r.latest),
      contributed: !!uid && this.floor(r.latest).author_id === uid,
    }));
  }
  detail(id: string, uid?: string): StackDetail {
    const s = this.stack(id),
      target = this.db
        .prepare(
          "SELECT id,author_id,answers FROM floors WHERE stack_id=? ORDER BY floor_index DESC LIMIT 1",
        )
        .get(id) as { id: string; author_id: string; answers: string },
      solved = this.solved(uid, target.id),
      contributed = this.contributed(uid, id);
    const floors = this.db
      .prepare(
        `SELECT f.id,f.floor_index AS 'index',f.author_id authorId,u.nickname author,f.created,f.hint,
      (SELECT COUNT(*) FROM likes WHERE floor_id=f.id) likes,
      EXISTS(SELECT 1 FROM likes WHERE floor_id=f.id AND user_id=?) liked,
      (SELECT COUNT(*) FROM comments WHERE floor_id=f.id)+(SELECT COUNT(*) FROM floor_guesses WHERE floor_id=f.id AND correct=1) comments,
      CASE WHEN f.author_id=? OR EXISTS(SELECT 1 FROM floor_guesses WHERE floor_id=f.id AND correct=1) THEN f.answers ELSE NULL END answers,
      EXISTS(SELECT 1 FROM floor_guesses WHERE floor_id=f.id AND correct=1) revealed,
      (SELECT COUNT(*) FROM floor_guesses WHERE floor_id=f.id AND correct=1) solves
      FROM floors f JOIN users u ON u.id=f.author_id WHERE f.stack_id=? ORDER BY f.floor_index`,
      )
      .all(uid ?? "", uid ?? "", id) as unknown as Floor[];
    const creator = (
      this.db
        .prepare("SELECT nickname FROM users WHERE id=?")
        .get(s.creator_id) as { nickname: string }
    ).nickname;
    const history = this.floorHistory(floors.map((floor) => floor.id));
    const meter = this.meter(uid, target.id);
    const revealed = !!this.db
      .prepare("SELECT 1 FROM floor_guesses WHERE floor_id=? AND correct=1")
      .get(target.id);
    return {
      id: s.id,
      number: s.number,
      creator,
      creatorId: s.creator_id,
      floors: floors.map((f) => {
        const open = !!f.revealed;
        const winner = open ? (history.winners.get(f.id) ?? null) : null;
        return {
          ...f,
          liked: !!f.liked,
          revealed: open,
          guesses: history.guesses.get(f.id) ?? [],
          winningGuess: winner?.text ?? null,
          winner: winner?.author ?? null,
        };
      }),
      word:
        solved || uid === target.author_id || revealed ? target.answers : null,
      solved,
      contributed,
      canDraw: solved && floors.length < 50,
      remaining: meter.remaining,
      resetAt: meter.resetAt,
      now: this.now(),
      guesses: history.guesses.get(target.id) ?? [],
      targetFloorId: target.id,
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
    input: {
      word?: unknown;
      hint?: unknown;
      image?: unknown;
      key?: unknown;
      parent?: unknown;
    },
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
        if (typeof input.parent !== "string" || !this.solved(uid, input.parent))
          fail(403, "Solve the latest drawing before adding the next floor.");
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
      }
      let answers: string;
      try {
        answers = parseAnswers(input.word).join(",");
      } catch (error) {
        return fail(400, (error as Error).message);
      }
      const hint = text(input.hint, 1, MAX_HINT_LENGTH);
      if (!id) {
        id = randomUUID();
        this.db
          .prepare(
            "INSERT INTO stacks(id,word,creator_id,created,updated) VALUES(?,?,?,?,?)",
          )
          .run(id, answers, uid, this.now(), this.now());
      }
      const floor = randomUUID();
      this.db
        .prepare(
          "INSERT INTO floors(id,stack_id,author_id,floor_index,image,preview,created,answers,hint) VALUES(?,?,?,?,?,?,?,?,?)",
        )
        .run(
          floor,
          id,
          uid,
          index,
          pixels.image,
          pixels.preview,
          this.now(),
          answers,
          hint,
        );
      this.touch(id);
      this.db
        .prepare("INSERT INTO publications VALUES(?,?,?,?)")
        .run(uid, key, id, floor);
      return { id, floor };
    });
  }
  guess(uid: string, id: string, raw: unknown) {
    const guess = normalize(text(raw, 1, MAX_ANSWER_LENGTH));
    return this.transaction(() => {
      this.stack(id);
      const target = this.db
        .prepare(
          "SELECT id,author_id,answers FROM floors WHERE stack_id=? ORDER BY floor_index DESC LIMIT 1",
        )
        .get(id) as { id: string; author_id: string; answers: string };
      if (target.author_id === uid)
        fail(403, "You drew this floor. Let someone else guess!");
      if (this.solved(uid, target.id))
        return { correct: true, duplicate: true };
      if (
        this.db
          .prepare("SELECT 1 FROM floor_guesses WHERE floor_id=? AND correct=1")
          .get(target.id)
      )
        fail(
          409,
          "Someone already solved this floor. The next drawing is on its way!",
        );
      if (
        this.db
          .prepare(
            "SELECT 1 FROM floor_guesses WHERE user_id=? AND floor_id=? AND text=?",
          )
          .get(uid, target.id, guess)
      )
        return { correct: false, duplicate: true };
      const meter = this.meter(uid, target.id);
      if (meter.remaining < 1)
        fail(429, "No tries left yet. Wait for the next refill.");
      const correct = matchesAnswer(guess, target.answers);
      this.db
        .prepare(
          "INSERT INTO floor_guesses(user_id,floor_id,text,correct,created) VALUES(?,?,?,?,?)",
        )
        .run(uid, target.id, guess, Number(correct), this.now());
      this.touch(id);
      if (!correct)
        this.db
          .prepare(
            "INSERT INTO floor_meters VALUES(?,?,?,?) ON CONFLICT(user_id,floor_id) DO UPDATE SET remaining=excluded.remaining,anchor=excluded.anchor",
          )
          .run(uid, target.id, meter.remaining - 1, meter.anchor);
      if (correct)
        this.db
          .prepare("INSERT INTO notifications VALUES(?,?,?,?,?,?,0)")
          .run(
            randomUUID(),
            target.author_id,
            uid,
            target.id,
            guess,
            this.now(),
          );
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
    if (liked) {
      const result = this.db
        .prepare("INSERT OR IGNORE INTO likes VALUES(?,?,?)")
        .run(uid, id, this.now());
      if (result.changes) this.touch(f.stack_id);
    } else
      this.db
        .prepare("DELETE FROM likes WHERE user_id=? AND floor_id=?")
        .run(uid, id);
  }
  canComment(uid: string | undefined, floor: string) {
    const f = this.floor(floor);
    return (
      !!uid &&
      (uid === f.author_id ||
        this.solved(uid, floor) ||
        !!this.db
          .prepare("SELECT 1 FROM floor_guesses WHERE floor_id=? AND correct=1")
          .get(floor))
    );
  }
  comments(uid: string | undefined, floor: string) {
    const revealed = !!this.db
      .prepare("SELECT 1 FROM floor_guesses WHERE floor_id=? AND correct=1")
      .get(floor);
    if (!revealed && !this.canComment(uid, floor))
      fail(403, "Comments unlock when this drawing is solved.");
    return this.db
      .prepare(
        `SELECT c.id,c.user_id authorId,u.nickname author,c.text,c.created,'comment' kind,NULL guess,NULL answers FROM comments c JOIN users u ON u.id=c.user_id WHERE c.floor_id=?
         UNION ALL SELECT 'solve-'||g.id,g.user_id,u.nickname,NULL,g.created,'solve',g.text,f.answers FROM floor_guesses g JOIN users u ON u.id=g.user_id JOIN floors f ON f.id=g.floor_id WHERE g.floor_id=? AND g.correct=1
         ORDER BY 5,1 LIMIT 200`,
      )
      .all(floor, floor);
  }
  comment(uid: string, floor: string, raw: unknown) {
    if (!this.canComment(uid, floor))
      fail(403, "Wait until this drawing is solved before commenting.");
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
    this.touch(this.floor(floor).stack_id);
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
          "SELECT u.id,u.nickname name,COUNT(g.id) score FROM users u JOIN floor_guesses g ON g.user_id=u.id AND g.correct=1 GROUP BY u.id ORDER BY score DESC,MAX(g.created),u.id",
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
  notifications(uid: string) {
    const rows = this.db
      .prepare(
        `SELECT n.id,u.nickname actor,n.floor_id floorId,f.stack_id stackId,s.number stackNumber,f.floor_index floor,n.guess,n.created,n.read FROM notifications n JOIN users u ON u.id=n.actor_id JOIN floors f ON f.id=n.floor_id JOIN stacks s ON s.id=f.stack_id WHERE n.user_id=? ORDER BY n.created DESC LIMIT 50`,
      )
      .all(uid) as unknown as (Omit<Notification, "read"> & { read: number })[];
    return rows.map((row) => ({ ...row, read: !!row.read }));
  }
  readNotifications(uid: string) {
    this.db.prepare("UPDATE notifications SET read=1 WHERE user_id=?").run(uid);
  }
}
