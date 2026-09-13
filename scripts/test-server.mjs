// Every browser run uses a new database; tests never touch the local players' data.
import { spawn } from "node:child_process";
import { resolve } from "node:path";
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3100",
  ],
  {
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      DRAWSTACKS_DB: resolve(`data/e2e-${process.pid}-${Date.now()}.sqlite`),
    },
  },
);
child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
