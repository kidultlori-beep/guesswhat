// Public response types deliberately exclude private word identifiers and session tokens.
export interface User {
  id: string;
  nickname: string;
}
export interface StackSummary {
  id: string;
  number: number;
  creator: string;
  count: number;
  likes: number;
  latest: string;
  updated: number;
  solved: boolean;
  contributed: boolean;
}
export interface FloorGuess {
  text: string;
  correct: false;
  author: string;
}
export interface Floor {
  id: string;
  index: number;
  authorId: string;
  author: string;
  created: number;
  likes: number;
  liked: boolean;
  comments: number;
  hint: string;
  answers: string | null;
  revealed: boolean;
  solves: number;
  guesses: FloorGuess[];
  winningGuess: string | null;
  winner: string | null;
}
export interface StackDetail {
  id: string;
  number: number;
  creator: string;
  creatorId: string;
  floors: Floor[];
  // Latest floor's comma-separated answers, visible only after that floor is solved
  // (or privately to its artist / successful guesser).
  word: string | null;
  solved: boolean;
  contributed: boolean;
  canDraw: boolean;
  remaining: number;
  resetAt: number | null;
  now: number;
  guesses: FloorGuess[];
  targetFloorId: string;
}
export const MAX_HINT_LENGTH = 160;
export interface Comment {
  id: string;
  author: string;
  authorId: string;
  text: string | null;
  created: number;
  kind: "comment" | "solve";
  guess?: string;
  answers?: string;
}
export interface Notification {
  id: string;
  actor: string;
  floorId: string;
  stackId: string;
  stackNumber: number;
  floor: number;
  guess: string;
  created: number;
  read: boolean;
}
export interface RankRow {
  id: string;
  name: string;
  score: number;
  rank: number;
  image?: string;
  creator?: string;
}
