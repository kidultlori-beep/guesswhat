// Shared validation only. This module contains no word bank or automatic aliases.
export const MAX_ANSWERS = 10;
export const MAX_ANSWER_LENGTH = 80;
export const MAX_ANSWERS_INPUT_LENGTH =
  MAX_ANSWERS * (MAX_ANSWER_LENGTH + 1) - 1;

const clean = (value: string) =>
  value.normalize("NFC").trim().replace(/\s+/gu, " ");
export const normalize = (value: string) => clean(value).toLowerCase();

export function parseAnswers(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim())
    throw new Error("Enter at least one answer.");
  if (value.length > MAX_ANSWERS_INPUT_LENGTH)
    throw new Error(
      `Keep your answers under ${MAX_ANSWERS_INPUT_LENGTH + 1} characters in total.`,
    );
  if (value.includes("，"))
    throw new Error(
      "Separate answers with English commas (,), not full-width commas.",
    );
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value))
    throw new Error("Answers cannot contain control characters.");
  const answers = value.split(",").map(clean);
  if (answers.some((answer) => !answer))
    throw new Error("Enter an answer between each comma. Remove extra commas.");
  if (answers.some((answer) => answer.length > MAX_ANSWER_LENGTH))
    throw new Error(
      `Each answer can have up to ${MAX_ANSWER_LENGTH} characters.`,
    );
  const unique = answers.filter(
    (answer, index) =>
      answers.findIndex((other) => normalize(other) === normalize(answer)) ===
      index,
  );
  if (unique.length > MAX_ANSWERS)
    throw new Error(`Use up to ${MAX_ANSWERS} different answers.`);
  return unique;
}

export function matchesAnswer(guess: string, storedAnswers: string): boolean {
  // The existing word column also supports pre-change stacks containing one answer.
  return storedAnswers
    .split(",")
    .some((answer) => normalize(answer) === normalize(guess));
}
