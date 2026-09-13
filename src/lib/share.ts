export function floorSharePath(stackId: string, floorId: string) {
  return `/stacks/${encodeURIComponent(stackId)}?floor=${encodeURIComponent(floorId)}`;
}

export function floorShareText(stackNumber: number, floorIndex: number) {
  return `Can you guess Floor ${floorIndex} in Stack #${String(stackNumber).padStart(3, "0")}? Draw the next floor on DrawStacks!`;
}

export function xShareUrl(url: string, text: string) {
  const intent = new URL("https://x.com/intent/tweet");
  intent.searchParams.set("text", text);
  intent.searchParams.set("url", url);
  return intent.toString();
}
