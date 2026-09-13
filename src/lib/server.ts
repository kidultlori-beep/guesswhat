// Share one database connection across development hot reloads.
import { Game } from "./game";
import path from "node:path";
const globalGame = globalThis as unknown as { drawstacks?: Game };
export const game = (globalGame.drawstacks ??= new Game(
  process.env.DRAWSTACKS_DB ||
    path.join(process.cwd(), "data", "drawstacks.db"),
));
