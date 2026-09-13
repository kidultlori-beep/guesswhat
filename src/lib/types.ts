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
export interface Floor {
  id: string;
  index: number;
  authorId: string;
  author: string;
  created: number;
  likes: number;
  liked: boolean;
  comments: number;
}
export interface StackDetail {
  id: string;
  number: number;
  creator: string;
  creatorId: string;
  floors: Floor[];
  // Comma-separated accepted answers, visible only to the creator/solved player.
  word: string | null;
  solved: boolean;
  contributed: boolean;
  canDraw: boolean;
  remaining: number;
  resetAt: number | null;
  now: number;
  guesses: { text: string; correct: boolean }[];
}
export interface Comment {
  id: string;
  author: string;
  authorId: string;
  text: string;
  created: number;
}
export interface RankRow {
  id: string;
  name: string;
  score: number;
  rank: number;
  image?: string;
  creator?: string;
}
