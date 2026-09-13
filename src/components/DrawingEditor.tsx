"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  PencilSimple,
  Highlighter,
  Eraser,
  PaintBucket,
  LineSegment,
  Rectangle,
  Circle,
  Selection,
  ArrowCounterClockwise,
  ArrowClockwise,
  Trash,
  Minus,
  Plus,
  ArrowsOut,
  Hand,
  FloppyDisk,
  ArrowRight,
  CheckCircle,
  LockSimple,
  Heart,
  ChatCircle,
  ShareNetwork,
} from "@phosphor-icons/react";
import { floodFill } from "@/lib/paint";
import { parseAnswers, MAX_ANSWERS_INPUT_LENGTH } from "@/lib/answers";
import { api, draftKey, freshKey, errorMessage, imageUrl } from "@/lib/client";
import type { StackDetail, User } from "@/lib/types";

type Tool =
  | "pencil"
  | "marker"
  | "eraser"
  | "fill"
  | "line"
  | "rectangle"
  | "ellipse"
  | "select"
  | "pan";
type Point = { x: number; y: number };
type Rect = Point & { w: number; h: number };
type Draft = {
  image: string;
  word: string;
  answerInput?: string;
  key: string;
  parent?: string;
};
const tools = [
  ["pencil", "Pencil", PencilSimple],
  ["marker", "Marker", Highlighter],
  ["eraser", "Eraser", Eraser],
  ["fill", "Fill", PaintBucket],
  ["line", "Line", LineSegment],
  ["rectangle", "Rectangle", Rectangle],
  ["ellipse", "Ellipse", Circle],
  ["select", "Select", Selection],
  ["pan", "Pan", Hand],
] as const;
const palette = [
  "#343434",
  "#EA5548",
  "#FAC532",
  "#49AD74",
  "#2F80ED",
  "#9365D5",
  "#956039",
  "#EE79AE",
  "#FA872F",
  "#FFFFFF",
];
export default function DrawingEditor({
  user,
  stack,
  onPublished,
  onExit,
}: {
  user: User;
  stack?: StackDetail;
  onPublished: (id: string, floor: string) => void;
  onExit: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    viewport = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>("pencil"),
    [color, setColor] = useState("#343434"),
    [hex, setHex] = useState("#343434");
  const [size, setSize] = useState(8),
    [eraserSize, setEraserSize] = useState(20),
    [opacity, setOpacity] = useState(100),
    [tolerance, setTolerance] = useState(24);
  const [zoom, setZoom] = useState(1),
    [fit, setFit] = useState(1),
    [selection, setSelection] = useState<Rect | null>(null),
    [cursor, setCursor] = useState<Point | null>(null);
  const [historyCount, setHistoryCount] = useState({ index: 0, total: 1 }),
    history = useRef<string[]>([]),
    historyIndex = useRef(0),
    restoring = useRef(false);
  const [word, setWord] = useState(""),
    [answerInput, setAnswerInput] = useState(""),
    [answerError, setAnswerError] = useState(""),
    [choosing, setChoosing] = useState(true);
  const [reference, setReference] = useState(stack?.floors.at(-1)),
    [showReference, setShowReference] = useState(false);
  const brushMemory = useRef({
      pencil: { size: 8, opacity: 100 },
      marker: { size: 16, opacity: 45 },
    }),
    previousTool = useRef<Tool>("pencil");
  const [saved, setSaved] = useState("Preparing canvas…"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [confirm, setConfirm] = useState<"clear" | "word" | null>(null);
  const key = useRef(""),
    parent = useRef(stack?.floors.at(-1)?.id),
    storageKey = draftKey(user.id, stack?.id),
    wordRef = useRef(word),
    answerInputRef = useRef(answerInput),
    space = useRef(false),
    modified = useRef(false);
  const stroke = useRef<{
    start: Point;
    last: Point;
    base: ImageData;
    moving?: Rect;
    pan?: Point;
    scroll?: Point;
  } | null>(null);
  useEffect(() => {
    const previous = previousTool.current;
    if (previous === "pencil" || previous === "marker")
      brushMemory.current[previous] = { size, opacity };
    if (tool === "pencil" || tool === "marker") {
      setSize(brushMemory.current[tool].size);
      setOpacity(brushMemory.current[tool].opacity);
    }
    previousTool.current = tool;
    // Preserve each brush's settings only when switching tools.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);
  const save = useCallback(() => {
    if (!canvas.current || !key.current) return false;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          image: canvas.current.toDataURL(),
          word: wordRef.current,
          answerInput: answerInputRef.current,
          key: key.current,
          parent: parent.current,
        }),
      );
      setSaved("Draft saved on this device");
      modified.current = false;
      return true;
    } catch {
      setSaved("Storage full or unavailable — keep this tab open");
      modified.current = true;
      return false;
    }
  }, [storageKey]);
  const commit = useCallback(() => {
    if (!canvas.current) return;
    const url = canvas.current.toDataURL();
    const list = history.current.slice(0, historyIndex.current + 1);
    if (list.at(-1) === url) {
      save();
      return;
    }
    list.push(url);
    if (list.length > 51) list.shift();
    history.current = list;
    historyIndex.current = list.length - 1;
    setHistoryCount({ index: historyIndex.current, total: list.length });
    save();
  }, [save]);
  const restore = useCallback(
    (index: number) => {
      if (restoring.current || index < 0 || index >= history.current.length)
        return;
      restoring.current = true;
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.current?.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, 960, 640);
          ctx.drawImage(img, 0, 0);
          historyIndex.current = index;
          setHistoryCount({ index, total: history.current.length });
          setSelection(null);
          save();
        }
        restoring.current = false;
      };
      img.onerror = () => {
        restoring.current = false;
      };
      img.src = history.current[index];
    },
    [save],
  );
  useEffect(() => {
    key.current = freshKey();
    let draft: Draft | null = null;
    try {
      draft = JSON.parse(localStorage.getItem(storageKey) || "null");
    } catch {
      setSaved("Could not restore the saved draft");
    }
    const init = () => {
      if (!canvas.current) return;
      history.current = [canvas.current.toDataURL()];
      historyIndex.current = 0;
      setReady(true);
      save();
    };
    if (
      draft &&
      typeof draft.image === "string" &&
      draft.image.startsWith("data:image/png;base64,") &&
      typeof draft.word === "string"
    ) {
      wordRef.current = draft.word;
      setWord(wordRef.current);
      answerInputRef.current =
        typeof draft.answerInput === "string"
          ? draft.answerInput
          : wordRef.current;
      setAnswerInput(answerInputRef.current);
      setChoosing(
        !wordRef.current || answerInputRef.current !== wordRef.current,
      );
      key.current = draft.key || key.current;
      parent.current = draft.parent || parent.current;
      const img = new Image();
      img.onload = () => {
        canvas.current?.getContext("2d")?.drawImage(img, 0, 0, 960, 640);
        init();
      };
      img.onerror = init;
      img.src = draft.image;
    } else init();
    const observer = new ResizeObserver(() => {
      if (viewport.current)
        setFit(Math.min(1, (viewport.current.clientWidth - 4) / 960));
    });
    if (viewport.current) observer.observe(viewport.current);
    const warn = (e: BeforeUnloadEvent) => {
      if (modified.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      observer.disconnect();
      window.removeEventListener("beforeunload", warn);
    };
    // A different editor is mounted for each player/stack; initialization must only run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const eraseSelection = useCallback(() => {
    const ctx = canvas.current?.getContext("2d");
    if (selection && ctx) {
      ctx.clearRect(selection.x, selection.y, selection.w, selection.h);
      setSelection(null);
      commit();
    }
  }, [selection, commit]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable=true],dialog",
        ) ||
        busy
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        restore(historyIndex.current + (e.shiftKey ? 1 : -1));
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === "Space") {
        if ((e.target as HTMLElement).closest("button,a")) return;
        e.preventDefault();
        space.current = true;
      }
      const shortcuts: Record<string, Tool> = {
        b: "pencil",
        m: "marker",
        e: "eraser",
        g: "fill",
        v: "select",
        h: "pan",
      };
      if (shortcuts[e.key]) {
        setTool(shortcuts[e.key]);
        setSelection(null);
      }
      if (e.key === "[" || e.key === "]") {
        e.preventDefault();
        const delta = e.key === "]" ? 1 : -1;
        if (tool === "eraser")
          setEraserSize((n) => Math.max(4, Math.min(80, n + delta)));
        else setSize((n) => Math.max(1, Math.min(40, n + delta)));
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        eraseSelection();
      }
      if (e.key === "Escape") setSelection(null);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") space.current = false;
    };
    const blur = () => {
      space.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [tool, restore, eraseSelection, busy]);
  function point(e: React.PointerEvent): Point {
    const r = canvas.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(959, ((e.clientX - r.left) * 960) / r.width)),
      y: Math.max(0, Math.min(639, ((e.clientY - r.top) * 640) / r.height)),
    };
  }
  function brush(ctx: CanvasRenderingContext2D) {
    ctx.globalCompositeOperation =
      tool === "eraser" ? "destination-out" : "source-over";
    ctx.globalAlpha = tool === "eraser" ? 1 : opacity / 100;
    ctx.lineWidth = tool === "eraser" ? eraserSize : size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
  }
  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    if (
      !ready ||
      busy ||
      choosing ||
      restoring.current ||
      e.button !== 0 ||
      stroke.current
    )
      return;
    const ctx = canvas.current!.getContext("2d")!,
      p = point(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    const base = ctx.getImageData(0, 0, 960, 640);
    stroke.current = { start: p, last: p, base };
    if (space.current || tool === "pan") {
      stroke.current.pan = { x: e.clientX, y: e.clientY };
      stroke.current.scroll = {
        x: viewport.current!.scrollLeft,
        y: viewport.current!.scrollTop,
      };
      return;
    }
    modified.current = true;
    if (tool === "fill") {
      floodFill(base.data, 960, 640, p.x, p.y, color, opacity / 100, tolerance);
      ctx.putImageData(base, 0, 0);
      stroke.current = null;
      commit();
      return;
    }
    if (tool === "select") {
      if (
        selection &&
        p.x >= selection.x &&
        p.x <= selection.x + selection.w &&
        p.y >= selection.y &&
        p.y <= selection.y + selection.h
      )
        stroke.current.moving = selection;
      else setSelection({ x: p.x, y: p.y, w: 0, h: 0 });
      return;
    }
    setSelection(null);
    ctx.save();
    brush(ctx);
    if (tool === "pencil" || tool === "marker" || tool === "eraser") {
      ctx.beginPath();
      ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    const p = point(e);
    setCursor(p);
    const s = stroke.current;
    if (!s) return;
    const ctx = canvas.current!.getContext("2d")!;
    if (s.pan && s.scroll) {
      viewport.current!.scrollLeft = s.scroll.x + s.pan.x - e.clientX;
      viewport.current!.scrollTop = s.scroll.y + s.pan.y - e.clientY;
      return;
    }
    if (tool === "select") {
      if (s.moving) {
        const r = s.moving;
        const x = Math.round(
            Math.max(0, Math.min(960 - r.w, r.x + p.x - s.start.x)),
          ),
          y = Math.round(
            Math.max(0, Math.min(640 - r.h, r.y + p.y - s.start.y)),
          );
        ctx.putImageData(s.base, 0, 0);
        const pixels = ctx.getImageData(r.x, r.y, r.w, r.h);
        ctx.clearRect(r.x, r.y, r.w, r.h);
        ctx.putImageData(pixels, x, y);
        setSelection({ ...r, x, y });
      } else
        setSelection({
          x: Math.floor(Math.min(s.start.x, p.x)),
          y: Math.floor(Math.min(s.start.y, p.y)),
          w: Math.max(1, Math.floor(Math.abs(p.x - s.start.x))),
          h: Math.max(1, Math.floor(Math.abs(p.y - s.start.y))),
        });
      return;
    }
    ctx.save();
    brush(ctx);
    ctx.beginPath();
    if (tool === "pencil" || tool === "marker" || tool === "eraser") {
      ctx.moveTo(s.last.x, s.last.y);
      ctx.lineTo(p.x, p.y);
    } else {
      ctx.putImageData(s.base, 0, 0);
      let dx = p.x - s.start.x,
        dy = p.y - s.start.y;
      if (e.shiftKey) {
        if (tool === "line") {
          const angle =
              (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI) / 4,
            len = Math.hypot(dx, dy);
          dx = Math.cos(angle) * len;
          dy = Math.sin(angle) * len;
        } else {
          const side = Math.max(Math.abs(dx), Math.abs(dy));
          dx = (dx < 0 ? -1 : 1) * side;
          dy = (dy < 0 ? -1 : 1) * side;
        }
      }
      if (tool === "line") {
        ctx.moveTo(s.start.x, s.start.y);
        ctx.lineTo(s.start.x + dx, s.start.y + dy);
      }
      if (tool === "rectangle") ctx.rect(s.start.x, s.start.y, dx, dy);
      if (tool === "ellipse")
        ctx.ellipse(
          s.start.x + dx / 2,
          s.start.y + dy / 2,
          Math.abs(dx / 2),
          Math.abs(dy / 2),
          0,
          0,
          Math.PI * 2,
        );
    }
    ctx.stroke();
    ctx.restore();
    s.last = p;
  }
  function end() {
    if (!stroke.current) return;
    const s = stroke.current;
    stroke.current = null;
    if (!s.pan) commit();
  }
  function pick(value: string) {
    setColor(value);
    setHex(value);
  }
  function choose() {
    let value: string;
    try {
      value = parseAnswers(answerInput).join(",");
    } catch (e) {
      setAnswerError(errorMessage(e));
      return;
    }
    setWord(value);
    wordRef.current = value;
    setAnswerInput(value);
    answerInputRef.current = value;
    setAnswerError("");
    setChoosing(false);
    save();
  }
  function safeExit() {
    if (save()) onExit();
    else
      setError(
        "This browser could not save your draft. Keep this tab open and publish your drawing, or free up browser storage before leaving.",
      );
  }
  async function publish() {
    if (!word || busy || !canvas.current) return;
    save();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ id: string; floor: string }>(
        stack ? `stacks/${stack.id}/draw` : "stacks",
        "POST",
        {
          word,
          image: canvas.current.toDataURL(),
          key: key.current,
          parent: parent.current,
        },
      );
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      modified.current = false;
      onPublished(r.id, r.floor);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function reviewLatest() {
    try {
      const latest = await api<StackDetail>(`stacks/${stack!.id}`);
      if (!latest.canDraw) {
        setError(
          "You can no longer add a floor here. Your draft is still saved on this device.",
        );
        return;
      }
      parent.current = latest.floors.at(-1)!.id;
      setReference(latest.floors.at(-1));
      setShowReference(true);
      save();
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <section className="editor">
      <div className="editor-title">
        <div>
          <button className="text-button" onClick={safeExit}>
            ← All stacks
          </button>
          <h1>
            {stack ? `Add floor ${stack.floors.length + 1}` : "New stack"}
          </h1>
        </div>
        <p className="steps">
          <span className="step">1</span> Set answers{" "}
          <span className="step">2</span> Draw it
        </p>
      </div>
      <div className="word-area">
        <div className="secret">
          <LockSimple size={22} /> Accepted answers:{" "}
          <strong>{word ? word.split(",").join(" / ") : "Enter below"}</strong>
          {!stack && (
            <button className="text-button" onClick={() => setConfirm("word")}>
              Edit answers
            </button>
          )}
        </div>
        <p>Only you can see this. Draw it without letters.</p>
      </div>
      {reference && (
        <div className="reference-floor">
          <button
            className="text-button"
            aria-expanded={showReference}
            onClick={() => setShowReference((v) => !v)}
          >
            {showReference ? "Hide" : "Show"} previous floor — by{" "}
            {reference.author}
          </button>
          {showReference && (
            <img
              src={imageUrl(reference.id)}
              alt={`Reference drawing, floor ${reference.index}, by ${reference.author}`}
            />
          )}
        </div>
      )}
      {choosing && (
        <div className="word-picker panel">
          <h2>What will you draw?</h2>
          <p>
            Choose your own subject. Add alternative names or translations for
            the same drawing.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              choose();
            }}
            className="answer-form"
          >
            <label htmlFor="accepted-answers">Accepted answers</label>
            <textarea
              id="accepted-answers"
              placeholder="e.g. ELON MUSK, Elon, Musk"
              rows={3}
              maxLength={MAX_ANSWERS_INPUT_LENGTH}
              value={answerInput}
              aria-describedby="answer-help"
              aria-invalid={!!answerError}
              onChange={(e) => {
                setAnswerInput(e.target.value);
                answerInputRef.current = e.target.value;
                setAnswerError("");
                save();
              }}
            />
            <small id="answer-help">
              Separate words or phrases with English commas (,). Any one exact
              answer wins. Any language is welcome; capitalization does not
              matter. Up to 10 answers, 80 characters each.
            </small>
            {answerError && (
              <p className="error-text" role="alert">
                {answerError}
              </p>
            )}
            <button
              className="primary"
              disabled={!ready || !answerInput.trim()}
            >
              Save answers & draw <ArrowRight />
            </button>
            {word && (
              <button
                type="button"
                onClick={() => {
                  setAnswerInput(word);
                  answerInputRef.current = word;
                  setAnswerError("");
                  setChoosing(false);
                  save();
                }}
              >
                Cancel edits
              </button>
            )}
          </form>
        </div>
      )}
      <div className={`editor-workspace ${choosing ? "is-choosing" : ""}`}>
        <aside className="palette" aria-label="Colors">
          <h3>Colors</h3>
          <div className="swatches">
            {palette.map((c) => (
              <button
                key={c}
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
                className={`swatch ${color === c ? "selected" : ""}`}
                style={{ backgroundColor: c }}
                onClick={() => pick(c)}
              />
            ))}
          </div>
          <label className="custom-color" title="Custom color">
            <input
              aria-label="Custom color"
              type="color"
              value={color}
              onChange={(e) => pick(e.target.value)}
            />
          </label>
        </aside>
        <aside className="toolbox" aria-label="Drawing tools">
          <h3>Tools</h3>
          <div className="tools">
            {tools.map(([id, label, Icon]) => (
              <button
                key={id}
                className={tool === id ? "selected" : ""}
                aria-pressed={tool === id}
                onClick={() => {
                  setTool(id);
                  setSelection(null);
                }}
                title={label}
              >
                <Icon size={29} weight="duotone" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </aside>
        <div className="drawing-center">
          <div ref={viewport} className="canvas-viewport">
            <div
              className="canvas-paper"
              style={{ width: 960 * fit * zoom, height: 640 * fit * zoom }}
            >
              <canvas
                ref={canvas}
                width={960}
                height={640}
                aria-label="Drawing canvas"
                tabIndex={0}
                style={{
                  cursor:
                    tool === "pan"
                      ? "grab"
                      : tool === "eraser"
                        ? "none"
                        : "crosshair",
                }}
                onPointerDown={start}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
                onLostPointerCapture={end}
                onPointerLeave={() => setCursor(null)}
              />
              {selection && tool === "select" && (
                <div
                  className="selection-outline"
                  style={{
                    left: `${selection.x / 9.6}%`,
                    top: `${selection.y / 6.4}%`,
                    width: `${selection.w / 9.6}%`,
                    height: `${selection.h / 6.4}%`,
                  }}
                />
              )}
              {cursor && tool === "eraser" && (
                <div
                  className="eraser-cursor"
                  style={{
                    left: cursor.x * fit * zoom,
                    top: cursor.y * fit * zoom,
                    width: eraserSize * fit * zoom,
                    height: eraserSize * fit * zoom,
                  }}
                />
              )}
            </div>
          </div>
          <div className="canvas-actions">
            <button
              onClick={() => restore(historyIndex.current - 1)}
              disabled={!historyCount.index || busy}
            >
              <ArrowCounterClockwise /> Undo
            </button>
            <button
              onClick={() => restore(historyIndex.current + 1)}
              disabled={historyCount.index >= historyCount.total - 1 || busy}
            >
              <ArrowClockwise /> Redo
            </button>
            <button onClick={() => setConfirm("clear")} disabled={busy}>
              <Trash /> Clear
            </button>
            <span className="divider" />
            <button
              aria-label="Zoom out"
              onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
              disabled={zoom <= 0.25}
            >
              <Minus />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              aria-label="Zoom in"
              onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
              disabled={zoom >= 2}
            >
              <Plus />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                viewport.current?.scrollTo(0, 0);
              }}
            >
              <ArrowsOut /> Fit
            </button>
          </div>
          {selection && (
            <button className="text-button danger" onClick={eraseSelection}>
              <Trash /> Delete selection
            </button>
          )}
        </div>
        <aside className="settings">
          <h3>Brush settings</h3>
          <label>
            Tool
            <select
              aria-label="Active tool"
              value={tool}
              onChange={(e) => {
                setTool(e.target.value as Tool);
                setSelection(null);
              }}
            >
              {tools.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>
              Size <output>{size} px</output>
            </span>
            <input
              aria-label="Brush size"
              type="range"
              min="1"
              max="40"
              value={size}
              onChange={(e) => setSize(+e.target.value)}
            />
          </label>
          <div className="size-presets">
            {[2, 8, 24].map((s, i) => (
              <button key={s} onClick={() => setSize(s)}>
                {["Thin", "Medium", "Thick"][i]}
              </button>
            ))}
          </div>
          <label>
            <span>
              Opacity <output>{opacity}%</output>
            </span>
            <input
              aria-label="Opacity"
              type="range"
              min="5"
              max="100"
              value={opacity}
              onChange={(e) => setOpacity(+e.target.value)}
            />
          </label>
          <label>
            Color
            <div className="color-fields">
              <input
                type="color"
                aria-label="Brush color"
                value={color}
                onChange={(e) => pick(e.target.value)}
              />
              <input
                aria-label="HEX color"
                value={hex}
                maxLength={7}
                onChange={(e) => {
                  setHex(e.target.value);
                  if (/^#[0-9a-f]{6}$/i.test(e.target.value))
                    setColor(e.target.value);
                }}
                onBlur={() => setHex(color)}
              />
            </div>
          </label>
          <label>
            <span>
              Eraser size <output>{eraserSize} px</output>
            </span>
            <input
              aria-label="Eraser size"
              type="range"
              min="4"
              max="80"
              value={eraserSize}
              onChange={(e) => setEraserSize(+e.target.value)}
            />
          </label>
          {tool === "fill" && (
            <label>
              <span>
                Fill tolerance <output>{tolerance}</output>
              </span>
              <input
                aria-label="Fill tolerance"
                type="range"
                min="0"
                max="100"
                value={tolerance}
                onChange={(e) => setTolerance(+e.target.value)}
              />
            </label>
          )}
          <p className="hint">
            Shift: straight lines & equal shapes.
            <br />
            Space + drag: pan.
            <br />B / M / E / G / V: switch tools.
          </p>
        </aside>
      </div>
      {error && (
        <div role="alert" className="notice error">
          {error}
          {stack && error.includes("new floor") && (
            <button onClick={reviewLatest}>
              Review latest floor & keep draft
            </button>
          )}
        </div>
      )}
      <div className="publish-row">
        <span className="draft-status" role="status">
          <CheckCircle size={21} />
          {saved}
        </span>
        <button
          className="primary"
          disabled={busy || !ready || !word || choosing}
          onClick={publish}
        >
          {busy ? "Publishing…" : stack ? "Publish floor" : "Publish stack"}
          <ArrowRight />
        </button>
        <button className="secondary" disabled={busy} onClick={safeExit}>
          <FloppyDisk /> Save & exit
        </button>
      </div>
      <div className="after-publish">
        <span>After publishing</span>
        <button disabled>
          <Heart /> Like
        </button>
        <button disabled>
          <ChatCircle /> Comments
        </button>
        <button disabled>
          <ShareNetwork /> Share
        </button>
        <small>Comments, likes, and sharing unlock after you publish.</small>
      </div>
      {confirm && (
        <div className="modal-backdrop">
          <div
            className="modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-confirm"
          >
            <h2 id="editor-confirm">
              {confirm === "clear"
                ? "Clear your canvas?"
                : "Edit the accepted answers?"}
            </h2>
            <p>
              {confirm === "clear"
                ? "Your drawing will be cleared. You can undo this."
                : "Your drawing stays on the canvas. All answers should describe the same subject."}
            </p>
            <div className="button-row">
              <button autoFocus onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={() => {
                  if (confirm === "clear") {
                    canvas.current!.getContext("2d")!.clearRect(0, 0, 960, 640);
                    setSelection(null);
                    commit();
                  } else setChoosing(true);
                  setConfirm(null);
                }}
              >
                {confirm === "clear" ? "Clear canvas" : "Edit answers"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
