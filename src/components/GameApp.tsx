"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowClockwise,
  Plus,
  Trophy,
  Smiley,
  Heart,
  ChatCircle,
  ShareNetwork,
  CheckCircle,
  XCircle,
  LockSimple,
  Stack as StackIcon,
  PencilSimple,
  Trash,
  X,
  Buildings,
  Lightbulb,
  Bell,
  XLogo,
} from "@phosphor-icons/react";
import type {
  User,
  StackSummary,
  StackDetail,
  Comment,
  RankRow,
  Notification,
} from "@/lib/types";
import { api, imageUrl, stackName, errorMessage } from "@/lib/client";
import { MAX_ANSWER_LENGTH } from "@/lib/answers";
import { floorSharePath, floorShareText, xShareUrl } from "@/lib/share";
import DrawingEditor from "./DrawingEditor";

type RequireUser = (action: () => void) => void;
export default function GameApp() {
  const router = useRouter(),
    path = usePathname(),
    [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [identityOpen, setIdentityOpen] = useState(false),
    [notifications, setNotifications] = useState<Notification[]>([]),
    [notificationsOpen, setNotificationsOpen] = useState(false),
    [error, setError] = useState("");
  const pending = useRef<(() => void) | null>(null);
  const loadIdentity = useCallback(() => {
    setError("");
    api<{ user: User | null }>("me")
      .then((d) => {
        setUser(d.user);
        setReady(true);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(loadIdentity, [loadIdentity]);
  const loadNotifications = useCallback(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    api<{ notifications: Notification[] }>("notifications")
      .then((d) => setNotifications(d.notifications))
      .catch(() => {});
  }, [user]);
  useEffect(() => {
    loadNotifications();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") loadNotifications();
    }, 4000);
    return () => clearInterval(timer);
  }, [loadNotifications]);
  async function openNotifications() {
    const open = !notificationsOpen;
    setNotificationsOpen(open);
    if (open && notifications.some((n) => !n.read)) {
      setNotifications((items) => items.map((n) => ({ ...n, read: true })));
      try {
        await api("notifications", "PUT");
      } catch {}
    }
  }
  useEffect(() => {
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const modals = document.querySelectorAll<HTMLElement>("[role=dialog]");
      const modal = modals[modals.length - 1];
      if (!modal) return;
      const items = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]',
        ),
      );
      const first = items[0],
        last = items.at(-1);
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !modal.contains(document.activeElement))
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !modal.contains(document.activeElement))
      ) {
        e.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", trap);
    return () => window.removeEventListener("keydown", trap);
  }, []);
  const requireUser: RequireUser = (action) => {
    if (user) action();
    else {
      pending.current = action;
      setIdentityOpen(true);
    }
  };
  const parts = path.split("/").filter(Boolean),
    isEditor = parts[0] === "new" || parts[2] === "draw";
  return (
    <>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="DrawStacks home">
          DRAWSTACKS
        </Link>
        <span className="tagline">Draw. Guess. Build together.</span>
        <nav aria-label="Main navigation">
          <Link className={path === "/" ? "active" : ""} href="/">
            Stacks
          </Link>
          <Link
            className={parts[0] === "leaderboards" ? "active" : ""}
            href="/leaderboards"
          >
            <Trophy size={26} /> Leaderboards
          </Link>
        </nav>
        {user && (
          <div className="notification-wrap">
            <button
              className="notification-button"
              aria-label={`Notifications${notifications.some((n) => !n.read) ? `, ${notifications.filter((n) => !n.read).length} unread` : ""}`}
              aria-expanded={notificationsOpen}
              onClick={openNotifications}
            >
              <Bell size={27} />
              {notifications.some((n) => !n.read) && (
                <span>{notifications.filter((n) => !n.read).length}</span>
              )}
            </button>
            {notificationsOpen && (
              <div className="notification-menu panel">
                <h2>Your notifications</h2>
                {notifications.length ? (
                  notifications.map((n) => (
                    <Link
                      href={`/stacks/${n.stackId}?floor=${n.floorId}`}
                      key={n.id}
                      onClick={() => setNotificationsOpen(false)}
                      className={n.read ? "" : "unread"}
                    >
                      <img src={imageUrl(n.floorId, true)} alt="" />
                      <span>
                        <strong>{n.actor}</strong> guessed “{n.guess}” and
                        solved your Floor {n.floor}.
                        <small>
                          {stackName(n.stackNumber)} ·{" "}
                          {new Date(n.created).toLocaleString("en", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </small>
                      </span>
                    </Link>
                  ))
                ) : (
                  <p>
                    No notifications yet. When somebody solves your drawing,
                    you’ll see it here.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        <button
          className="identity"
          onClick={() => setIdentityOpen(true)}
          disabled={!ready}
        >
          <Smiley size={35} />
          <span>{user?.nickname || "Join in"}</span>
        </button>
      </header>
      <main className={isEditor ? "page editor-page" : "page"}>
        {!ready ? (
          <div className="empty-state">
            <Smiley size={48} />
            <h1>
              {error
                ? "The game is taking a break."
                : "Opening the sketchbook…"}
            </h1>
            {error && (
              <>
                <p role="alert">{error}</p>
                <button onClick={loadIdentity}>Try again</button>
              </>
            )}
          </div>
        ) : parts.length === 0 ? (
          <Home
            user={user}
            requireUser={requireUser}
            onNew={() => router.push("/new")}
          />
        ) : parts[0] === "leaderboards" ? (
          <Leaderboards user={user} />
        ) : parts[0] === "new" ? (
          user ? (
            <DrawingEditor
              key={`${user.id}:new`}
              user={user}
              onExit={() => router.push("/")}
              onPublished={(id, floor) =>
                router.push(`/stacks/${id}?floor=${floor}`)
              }
            />
          ) : (
            <JoinPrompt join={() => requireUser(() => router.push("/new"))} />
          )
        ) : parts[0] === "stacks" && parts[1] ? (
          <StackPage
            key={`${parts[1]}:${parts[2] || "detail"}`}
            id={parts[1]}
            editor={parts[2] === "draw"}
            user={user}
            requireUser={requireUser}
          />
        ) : (
          <div className="empty-state">
            <h1>That page wandered off.</h1>
            <Link href="/">Back to all stacks</Link>
          </div>
        )}
      </main>
      {!isEditor && (
        <footer className="site-footer">
          New answers. A new drawing on every floor.
        </footer>
      )}
      {identityOpen && (
        <IdentityModal
          user={user}
          onClose={() => {
            setIdentityOpen(false);
            pending.current = null;
          }}
          onSave={(u) => {
            setUser(u);
            setIdentityOpen(false);
            const action = pending.current;
            pending.current = null;
            action?.();
          }}
        />
      )}
    </>
  );
}

function IdentityModal({
  user,
  onSave,
  onClose,
}: {
  user: User | null;
  onSave: (u: User) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(user?.nickname || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ user: User }>("me", "PUT", { nickname: name });
      onSave(r.user);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="nickname-title"
        className="modal panel"
      >
        <button className="close-button" aria-label="Close" onClick={onClose}>
          <X />
        </button>
        <Smiley size={52} className="blue" />
        <h1 id="nickname-title">
          {user ? "Hello again!" : "Make yourself a name."}
        </h1>
        <p>No passwords. Just a nickname and a little imagination.</p>
        <form onSubmit={submit}>
          <label>
            Your nickname
            <input
              autoFocus
              required
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jamie"
              autoComplete="nickname"
            />
          </label>
          <small>
            1–20 characters. Your identity stays in this browser for 30 days.
            Clearing cookies creates a new player.
          </small>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <button className="primary full" disabled={busy || !name.trim()}>
            {busy ? "One moment…" : user ? "Save nickname" : "Let’s play"}
            <ArrowRight />
          </button>
        </form>
      </section>
    </div>
  );
}
function JoinPrompt({ join }: { join: () => void }) {
  return (
    <div className="empty-state">
      <PencilSimple size={56} />
      <h1>A blank page awaits.</h1>
      <p>Choose a nickname before you draw your first floor.</p>
      <button className="primary" onClick={join}>
        Choose a nickname <ArrowRight />
      </button>
    </div>
  );
}
function Home({
  user,
  requireUser,
  onNew,
}: {
  user: User | null;
  requireUser: RequireUser;
  onNew: () => void;
}) {
  const [stacks, setStacks] = useState<StackSummary[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [more, setMore] = useState(false);
  const load = useCallback(async (offset = 0) => {
    setLoading(true);
    setError("");
    try {
      const r = await api<{ stacks: StackSummary[] }>(
        `stacks?offset=${offset}`,
      );
      setStacks((s) =>
        offset
          ? [...s, ...r.stacks.filter((n) => !s.some((x) => x.id === n.id))]
          : r.stacks,
      );
      setMore(r.stacks.length === 12);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load, user?.id]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 5000);
    return () => clearInterval(timer);
  }, [load]);
  return (
    <>
      <section className="hero">
        <h1>Every drawing builds a story.</h1>
        <p>Pick a stack, guess the answer, and draw the next floor.</p>
        <button className="primary hero-cta" onClick={() => requireUser(onNew)}>
          <Plus size={29} /> Start a stack
        </button>
      </section>
      {error && (
        <div role="alert" className="notice error">
          {error}
          <button onClick={() => load()}>Try again</button>
        </div>
      )}
      <section className="stack-grid" aria-label="Stacks">
        {stacks.map((s) => (
          <article className="stack-card panel" key={s.id}>
            <Link className="card-main" href={`/stacks/${s.id}`}>
              <img
                className="stack-preview"
                src={imageUrl(s.latest, true)}
                alt={`Latest drawing in ${stackName(s.number)}`}
              />
              <div className="card-info">
                {(s.contributed || s.solved || s.count >= 50) && (
                  <span className={`badge ${s.solved ? "success" : ""}`}>
                    {s.contributed
                      ? "Your floor"
                      : s.solved
                        ? "Solved"
                        : "Complete"}
                  </span>
                )}
                <h2>{stackName(s.number)}</h2>
                <p>
                  {s.count} {s.count === 1 ? "floor" : "floors"}
                </p>
                <p className="truncate">By {s.creator}</p>
                <span className="like-count">
                  <Heart weight="fill" />
                  {s.likes}
                </span>
              </div>
            </Link>
            <Link
              className="soft-button"
              href={`/stacks/${s.id}${s.solved && s.count < 50 ? "/draw" : ""}`}
            >
              {s.count >= 50
                ? "View completed stack"
                : s.contributed
                  ? "View this stack"
                  : s.solved
                    ? "Draw the next floor"
                    : "Guess this stack"}
              <ArrowRight size={22} />
            </Link>
          </article>
        ))}
      </section>
      {!loading && !error && !stacks.length && (
        <div className="empty-state home-empty">
          <Buildings size={62} weight="duotone" />
          <h2>Big stories start with one little drawing.</h2>
          <p>No stacks yet. Yours could be the first.</p>
          <p className="hint">
            Draw your own subject. Share your stack. Friends guess it and add
            their own drawing.
          </p>
        </div>
      )}
      {loading && (
        <p className="center muted" role="status">
          Loading stacks…
        </p>
      )}
      {more && !loading && (
        <div className="center">
          <button onClick={() => load(stacks.length)}>Load more stacks</button>
        </div>
      )}
    </>
  );
}
function StackPage({
  id,
  editor,
  user,
  requireUser,
}: {
  id: string;
  editor: boolean;
  user: User | null;
  requireUser: RequireUser;
}) {
  const router = useRouter(),
    [data, setData] = useState<StackDetail | null>(null),
    [error, setError] = useState(""),
    [floorId, setFloorId] = useState(""),
    [liveNotice, setLiveNotice] = useState("");
  const revision = useRef(0);
  const targetRef = useRef("");
  const load = useCallback(async () => {
    const request = ++revision.current;
    try {
      const r = await api<StackDetail>(`stacks/${id}`);
      if (request !== revision.current) return;
      setData(r);
      if (targetRef.current && targetRef.current !== r.targetFloorId) {
        setFloorId(r.targetFloorId);
        setLiveNotice(
          "A new floor was published. You are now viewing the latest drawing.",
        );
      }
      targetRef.current = r.targetFloorId;
      setError("");
      setFloorId((current) =>
        r.floors.some((f) => f.id === current)
          ? current
          : new URLSearchParams(window.location.search).get("floor") ||
            r.floors.at(-1)!.id,
      );
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load, user?.id]);
  useEffect(() => {
    if (editor) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 3000);
    return () => clearInterval(timer);
  }, [editor, load]);
  if (!data)
    return (
      <div className="empty-state">
        {error ? (
          <>
            <h1>Couldn’t open this stack.</h1>
            <p role="alert">{error}</p>
            <button onClick={load}>Try again</button>
            <Link href="/">All stacks</Link>
          </>
        ) : (
          <p role="status">Unfolding the drawings…</p>
        )}
      </div>
    );
  if (editor) {
    if (!user) return <JoinPrompt join={() => requireUser(() => load())} />;
    if (!data.canDraw)
      return (
        <div className="empty-state">
          <LockSimple size={48} />
          <h1>
            {data.floors.length >= 50
              ? "This stack is complete!"
              : "Solve it before you draw it."}
          </h1>
          <p>
            Guess the latest drawing correctly before starting the next floor.
          </p>
          <Link className="primary" href={`/stacks/${id}`}>
            Back to this stack
          </Link>
        </div>
      );
    return (
      <DrawingEditor
        user={user}
        stack={data}
        onExit={() => router.push(`/stacks/${id}`)}
        onPublished={(sid, f) => router.push(`/stacks/${sid}?floor=${f}`)}
      />
    );
  }
  const floor =
    data.floors.find((f) => f.id === floorId) || data.floors.at(-1)!;
  function selectFloor(value: string) {
    setFloorId(value);
    window.history.replaceState(null, "", `/stacks/${id}?floor=${value}`);
  }
  return (
    <>
      <div className="detail-heading">
        <Link className="text-button" href="/">
          <ArrowLeft /> All stacks
        </Link>
        <div>
          <h1>{stackName(data.number)}</h1>
          <span className="muted">Started by {data.creator}</span>
          <span className="badge">
            <StackIcon />
            {data.floors.length} / 50 floors
          </span>
          <button className="text-button" onClick={load} title="Refresh stack">
            <ArrowClockwise /> Refresh
          </button>
        </div>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {liveNotice && (
        <p className="notice success" role="status">
          <CheckCircle />
          {liveNotice}
          <button onClick={() => setLiveNotice("")}>Dismiss</button>
        </p>
      )}
      <div className="detail-grid">
        <aside className="floor-list">
          <h3>The floors</h3>
          <div>
            {[...data.floors].reverse().map((f) => (
              <button
                key={f.id}
                className={floor.id === f.id ? "selected" : ""}
                onClick={() => selectFloor(f.id)}
              >
                <img src={imageUrl(f.id, true)} alt="" />
                <span>
                  Floor {f.index}
                  <small>{f.author}</small>
                </span>
              </button>
            ))}
          </div>
        </aside>
        <section className="floor-display">
          <div className="floor-meta">
            <span>
              Floor {floor.index}{" "}
              <span className="muted">by {floor.author}</span>
            </span>
            {floor.index === data.floors.length && (
              <span className="badge">Latest floor</span>
            )}
          </div>
          <img
            className="drawing-image"
            src={imageUrl(floor.id)}
            alt={`Drawing by ${floor.author}, floor ${floor.index}`}
          />
          <Social
            key={floor.id}
            floor={floor}
            data={data}
            user={user}
            requireUser={requireUser}
            refresh={load}
          />
        </section>
        <GuessPanel
          data={data}
          onChange={(d) => {
            revision.current++;
            setData(d);
          }}
          user={user}
          requireUser={requireUser}
        />
      </div>
    </>
  );
}
function GuessPanel({
  data,
  onChange,
  user,
  requireUser,
}: {
  data: StackDetail;
  onChange: (d: StackDetail) => void;
  user: User | null;
  requireUser: RequireUser;
}) {
  const [guess, setGuess] = useState(""),
    [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false),
    [tick, setTick] = useState(0),
    serverClock = useRef({ time: data.now, client: Date.now() });
  useEffect(() => {
    serverClock.current = { time: data.now, client: Date.now() };
  }, [data.now]);
  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  const now =
      serverClock.current.time + Date.now() - serverClock.current.client,
    ticks = data.resetAt
      ? Math.max(0, Math.floor((now - data.resetAt) / 60000) + 1)
      : 0,
    remaining = Math.min(5, data.remaining + ticks),
    next = data.resetAt ? data.resetAt + ticks * 60000 : 0;
  void tick;
  async function submit() {
    setBusy(true);
    setFeedback("");
    try {
      const r = await api<{
        correct: boolean;
        duplicate: boolean;
        state: StackDetail;
      }>(`stacks/${data.id}/guess`, "POST", { guess });
      onChange(r.state);
      setFeedback(
        r.correct
          ? "You got it!"
          : r.duplicate
            ? "You tried that already. No try used."
            : "Not quite! Give it another try.",
      );
      setGuess("");
    } catch (e) {
      setFeedback(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const latest = data.floors.at(-1)!,
    own = user?.id === latest.authorId,
    unlocked = !!data.word,
    wrong = data.guesses;
  return (
    <aside className="guess-panel panel">
      {unlocked ? (
        <>
          {latest.revealed ? (
            <CheckCircle className="green" size={44} weight="duotone" />
          ) : (
            <Lightbulb className="blue" size={44} weight="duotone" />
          )}
          <h2>
            {data.solved
              ? "You got it!"
              : own && !latest.revealed
                ? "Waiting for a guess."
                : "This floor was solved."}
          </h2>
          <p>
            {latest.revealed
              ? "The artist accepted"
              : "Your private accepted answers"}
          </p>
          <div className="revealed-word">
            {data.word?.split(",").join(" / ")}
          </div>
          {data.canDraw ? (
            <>
              <p>
                Set new answers, then draw the next idea.
                <br />
                Add your drawing to the story.
              </p>
              <Link className="primary full" href={`/stacks/${data.id}/draw`}>
                <PencilSimple /> Draw the next floor
              </Link>
              <small>No rush — you can come back later.</small>
            </>
          ) : (
            <p>
              {data.floors.length >= 50
                ? "50 floors! This stack is complete."
                : own
                  ? latest.revealed
                    ? "Your drawing was solved — check your notification above."
                    : "Share it and let your friends guess."
                  : latest.revealed
                    ? "The winner is drawing the next floor."
                    : "See what others draw next!"}
            </p>
          )}
        </>
      ) : (
        <>
          <Lightbulb size={39} className="blue" weight="duotone" />
          <h2>What’s the answer?</h2>
          <p>
            Guess the latest drawing. Match any answer its artist set to win the
            next drawing turn.
          </p>
          {latest.hint && <p className="hint">Hint: “{latest.hint}”</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              requireUser(submit);
            }}
          >
            <label className="sr-only" htmlFor="guess">
              Your guess
            </label>
            <input
              id="guess"
              placeholder="Type your guess…"
              value={guess}
              maxLength={MAX_ANSWER_LENGTH}
              onChange={(e) => setGuess(e.target.value)}
              autoComplete="off"
              disabled={busy}
            />
            <button
              className="primary full"
              disabled={busy || !guess.trim() || remaining === 0}
            >
              {busy ? "Checking…" : "Guess"}
              <ArrowRight />
            </button>
          </form>
          <div className="tries" aria-label={`${remaining} tries left`}>
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className={i < remaining ? "available" : ""} />
            ))}
          </div>
          <p className="tries-label">{remaining} / 5 tries left</p>
          <small>
            {remaining < 5
              ? `Next try in ${Math.max(1, Math.ceil((next - now) / 1000))}s`
              : "Wrong guesses use one try. A try returns every minute."}
          </small>
        </>
      )}
      {feedback && (
        <p
          role="status"
          className={`notice ${data.solved ? "success" : "error"}`}
        >
          {data.solved ? <CheckCircle /> : <XCircle />}
          {feedback}
        </p>
      )}
      {wrong.length > 0 && (
        <div className="guess-history">
          <h3>Wrong guesses</h3>
          {wrong.slice(0, 12).map((g, index) => (
            <p key={`${g.author}-${g.text}-${index}`}>
              <XCircle size={19} />
              <span>
                <strong>{g.author}</strong> guessed “{g.text}”
              </span>
              <small>Not quite</small>
            </p>
          ))}
        </div>
      )}
      <div className="how-it-works">
        <h3>A little team effort</h3>
        <p>1. Guess an accepted answer.</p>
        <p>2. Set new answers and draw the next floor.</p>
        <p>3. The next player continues the chain.</p>
      </div>
    </aside>
  );
}
function Social({
  floor,
  data,
  user,
  requireUser,
  refresh,
}: {
  floor: StackDetail["floors"][number];
  data: StackDetail;
  user: User | null;
  requireUser: RequireUser;
  refresh: () => Promise<void>;
}) {
  const [comments, setComments] = useState<Comment[]>([]),
    [text, setText] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [deleteId, setDeleteId] = useState(""),
    [shareUrl, setShareUrl] = useState("");
  const unlocked = !!floor.answers;
  const load = useCallback(async () => {
    if (!unlocked) return;
    try {
      const r = await api<{ comments: Comment[] }>(
        `floors/${floor.id}/comments`,
      );
      setComments(r.comments);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [floor.id, unlocked]);
  useEffect(() => {
    void load();
    if (!unlocked) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 3000);
    return () => clearInterval(timer);
  }, [load, unlocked]);
  async function like() {
    setBusy(true);
    setError("");
    try {
      await api(`floors/${floor.id}/like`, "PUT", { liked: !floor.liked });
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function comment() {
    setBusy(true);
    setError("");
    try {
      await api(`floors/${floor.id}/comments`, "POST", { text });
      setText("");
      await load();
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await api(`comments/${deleteId}`, "DELETE");
      setDeleteId("");
      await load();
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    const url = `${window.location.origin}${floorSharePath(data.id, floor.id)}`;
    setMessage("");
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${stackName(data.number)} — DrawStacks`,
          text: "Can you guess the answer? Draw the next floor!",
          url,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setMessage("Link copied!");
      } else setShareUrl(url);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setShareUrl(url);
    }
  }
  function shareOnX() {
    const url = `${window.location.origin}${floorSharePath(data.id, floor.id)}`;
    window.open(
      xShareUrl(url, floorShareText(data.number, floor.index)),
      "_blank",
      "noopener,noreferrer",
    );
  }
  return (
    <div className="social">
      <div className="social-bar">
        <button
          className={floor.liked ? "liked" : ""}
          disabled={busy || user?.id === floor.authorId}
          onClick={() => requireUser(like)}
          title={
            user?.id === floor.authorId
              ? "You cannot like your own drawing"
              : "Like this drawing"
          }
        >
          <Heart weight={floor.liked ? "fill" : "regular"} /> Like {floor.likes}
        </button>
        <a href="#comments">
          <ChatCircle /> Comments {floor.comments}
        </a>
        <button onClick={share}>
          <ShareNetwork /> Share
        </button>
        <button onClick={shareOnX} aria-label="Share this floor on X">
          <XLogo weight="bold" /> Share on X
        </button>
        <span role="status">{message}</span>
      </div>
      {shareUrl && (
        <label className="share-fallback">
          Copy this link
          <input
            readOnly
            autoFocus
            value={shareUrl}
            onFocus={(e) => e.target.select()}
          />
        </label>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <section id="comments" className="comments">
        <h2>Down in the comments</h2>
        {unlocked ? (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                requireUser(comment);
              }}
            >
              <label className="sr-only" htmlFor="comment">
                Add a comment
              </label>
              <textarea
                id="comment"
                placeholder="Leave a little encouragement…"
                value={text}
                maxLength={300}
                rows={2}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="comment-submit">
                <small>{text.length}/300</small>
                <button disabled={busy || !text.trim()}>Post comment</button>
              </div>
            </form>
            {comments.length === 0 && (
              <p className="muted">
                No comments yet. Be the first to cheer them on.
              </p>
            )}
            {comments.map((c) =>
              c.kind === "solve" ? (
                <article className="solve-event" key={c.id}>
                  <img
                    src={imageUrl(floor.id, true)}
                    alt={`Solved drawing by ${floor.author}`}
                  />
                  <div>
                    <strong>
                      {c.author} solved Floor {floor.index}!
                    </strong>
                    <p>Correct guess: “{c.guess}”</p>
                    <p>Accepted answers: {c.answers?.split(",").join(" / ")}</p>
                    <time dateTime={new Date(c.created).toISOString()}>
                      {new Date(c.created).toLocaleString("en", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                </article>
              ) : (
                <article className="comment" key={c.id}>
                  <Smiley size={29} className="blue" />
                  <div>
                    <strong>{c.author}</strong>
                    <time dateTime={new Date(c.created).toISOString()}>
                      {new Date(c.created).toLocaleString("en", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    <p>{c.text}</p>
                  </div>
                  {c.authorId === user?.id && (
                    <button
                      aria-label="Delete comment"
                      onClick={() => setDeleteId(c.id)}
                    >
                      <Trash size={18} />
                    </button>
                  )}
                </article>
              ),
            )}
          </>
        ) : (
          <div className="locked-comments">
            <LockSimple size={24} />
            <div>
              <strong>A spoiler-free zone.</strong>
              <p>
                Comments and the artist’s answers appear when this drawing is
                solved.
              </p>
            </div>
          </div>
        )}
      </section>
      {deleteId && (
        <div className="modal-backdrop">
          <div
            className="modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">Delete this comment?</h2>
            <p>This cannot be undone.</p>
            <div className="button-row">
              <button autoFocus disabled={busy} onClick={() => setDeleteId("")}>
                Keep it
              </button>
              <button className="danger" disabled={busy} onClick={remove}>
                Delete comment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function Leaderboards({ user }: { user: User | null }) {
  const [tab, setTab] = useState("stacks"),
    [rows, setRows] = useState<RankRow[]>([]),
    [mine, setMine] = useState<RankRow | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [profile, setProfile] = useState<RankRow | null>(null),
    [contributions, setContributions] = useState<
      {
        id: string;
        stackId: string;
        floor: number;
        number: number;
        likes: number;
      }[]
    >([]),
    [profileLoading, setProfileLoading] = useState(false);
  const request = useRef(0);
  const load = useCallback(async () => {
    const seq = ++request.current;
    setLoading(true);
    setError("");
    try {
      const r = await api<{ rows: RankRow[]; mine: RankRow | null }>(
        `leaderboards?tab=${tab}`,
      );
      if (seq === request.current) {
        setRows(r.rows);
        setMine(r.mine);
      }
    } catch (e) {
      if (seq === request.current) setError(errorMessage(e));
    } finally {
      if (seq === request.current) setLoading(false);
    }
  }, [tab]);
  useEffect(() => {
    void load();
  }, [load, user?.id]);
  async function openProfile(row: RankRow) {
    setProfile(row);
    setContributions([]);
    setProfileLoading(true);
    try {
      const r = await api<{ floors: typeof contributions }>(
        `users/${row.id}/contributions`,
      );
      setContributions(r.floors);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setProfileLoading(false);
    }
  }
  const unit =
    tab === "stacks"
      ? "floors"
      : tab === "guessers"
        ? "correct guesses"
        : "drawing likes";
  return (
    <section className="leaderboards">
      <Link href="/" className="text-button">
        <ArrowLeft /> All stacks
      </Link>
      <div className="leaderboard-title">
        <Trophy size={56} weight="duotone" />
        <h1>A little hall of fame.</h1>
        <p>Big stacks. Sharp guesses. Drawings worth a little love.</p>
      </div>
      <div className="ranking-tabs" role="tablist" aria-label="Leaderboards">
        {[
          ["stacks", "Tallest stacks", Buildings],
          ["guessers", "Top guessers", Lightbulb],
          ["artists", "Most-loved artists", Heart],
        ].map(([id, label, Icon]) => {
          const IconComponent = Icon as typeof Heart;
          return (
            <button
              key={id as string}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id as string)}
              className={tab === id ? "selected" : ""}
            >
              <IconComponent size={26} />
              {label as string}
            </button>
          );
        })}
      </div>
      <div className="ranking-caption">
        <h2>
          {tab === "stacks"
            ? "Built together, one floor at a time."
            : tab === "guessers"
              ? "A knack for seeing the big picture."
              : "A round of applause for these pencils."}
        </h2>
        <span>All time · Top 20</span>
      </div>
      <button
        className="text-button ranking-refresh"
        onClick={load}
        disabled={loading}
      >
        <ArrowClockwise /> Refresh rankings
      </button>
      <div className="ranking-table panel" role="tabpanel" aria-label={tab}>
        <div className="ranking-labels">
          <span>Rank</span>
          <span>{tab === "stacks" ? "Stack" : "Player"}</span>
          <span>{unit}</span>
        </div>
        {loading ? (
          <p role="status" className="empty-state">
            Tallying up…
          </p>
        ) : error ? (
          <p role="alert" className="notice error">
            {error}
            <button onClick={load}>Try again</button>
          </p>
        ) : rows.length ? (
          rows.map((row) => (
            <div className="rank-row" key={row.id}>
              <span className={`rank-number rank-${row.rank}`}>
                {row.rank <= 3 ? <Trophy weight="duotone" size={25} /> : null}
                {row.rank}
              </span>
              {tab === "stacks" ? (
                <Link className="rank-entity" href={`/stacks/${row.id}`}>
                  <img src={imageUrl(row.image!, true)} alt="" />
                  <div>
                    <h3>{row.name}</h3>
                    <small>Started by {row.creator}</small>
                  </div>
                </Link>
              ) : (
                <button
                  className="rank-entity"
                  onClick={() => openProfile(row)}
                >
                  <Smiley className="blue" size={38} />
                  <h3>
                    {row.name}
                    {row.id === user?.id && <span className="badge">You</span>}
                  </h3>
                </button>
              )}
              <strong>
                {row.score}
                <small>{unit}</small>
              </strong>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <Trophy size={42} />
            <h2>Your name could go here.</h2>
            <p>
              {tab === "stacks"
                ? "Start the first stack to get things growing."
                : tab === "guessers"
                  ? "Solve a stack to join the leaderboard."
                  : "Give a drawing some love to get this board started."}
            </p>
            <Link className="soft-button" href="/">
              Explore stacks <ArrowRight />
            </Link>
          </div>
        )}
      </div>
      {tab !== "stacks" && user && (
        <div className="my-rank panel">
          <Smiley size={30} />
          <span>
            {user.nickname} <small>Your rank</small>
          </span>
          <strong>
            {mine
              ? `#${mine.rank} · ${mine.score} ${unit}`
              : "Not ranked yet — keep playing!"}
          </strong>
        </div>
      )}
      <p className="ranking-note">
        {tab === "stacks"
          ? "Only published floors count."
          : tab === "guessers"
            ? "Your first correct guess on each other player’s stack counts once."
            : "Likes belong to the artist of each drawing. Self-likes don’t count."}{" "}
        Ties go to the earlier latest counted activity.
      </p>
      {profile && (
        <div className="modal-backdrop">
          <section
            className="modal panel profile-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-title"
          >
            <button
              autoFocus
              aria-label="Close profile"
              className="close-button"
              onClick={() => setProfile(null)}
            >
              <X />
            </button>
            <Smiley className="blue" size={42} />
            <h2 id="profile-title">{profile.name}’s drawings</h2>
            {profileLoading ? (
              <p>Loading drawings…</p>
            ) : contributions.length ? (
              <div className="contributions">
                {contributions.map((f) => (
                  <Link
                    href={`/stacks/${f.stackId}?floor=${f.id}`}
                    key={f.id}
                    onClick={() => setProfile(null)}
                  >
                    <img src={imageUrl(f.id, true)} alt={`Floor ${f.floor}`} />
                    <span>
                      {stackName(f.number)} · Floor {f.floor}
                    </span>
                    <small>{f.likes} likes</small>
                  </Link>
                ))}
              </div>
            ) : (
              <p>No published drawings yet. A sharp guesser in the making!</p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
