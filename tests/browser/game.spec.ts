import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { mkdirSync } from "node:fs";

async function identify(context: BrowserContext, name: string) {
  const r = await context.request.put("/api/me", {
    headers: { "X-DrawStacks": "1" },
    data: { nickname: name },
  });
  expect(r.status()).toBe(200);
  return (await r.json()).user;
}
async function stroke(page: Page, points: number[][]) {
  const box = (await page.getByLabel("Drawing canvas").boundingBox())!;
  await page.mouse.move(
    box.x + points[0][0] * box.width,
    box.y + points[0][1] * box.height,
  );
  await page.mouse.down();
  for (const [x, y] of points.slice(1))
    await page.mouse.move(box.x + x * box.width, box.y + y * box.height, {
      steps: 5,
    });
  await page.mouse.up();
}
async function drawUmbrella(page: Page) {
  await page.getByLabel("HEX color").fill("#343434");
  await stroke(page, [
    [0.5, 0.24],
    [0.5, 0.72],
    [0.49, 0.78],
    [0.46, 0.81],
    [0.42, 0.8],
    [0.4, 0.76],
  ]);
  await page.getByLabel("HEX color").fill("#EA5548");
  await stroke(page, [
    [0.23, 0.59],
    [0.26, 0.48],
    [0.32, 0.36],
    [0.4, 0.29],
    [0.5, 0.27],
    [0.6, 0.31],
    [0.68, 0.42],
    [0.73, 0.58],
    [0.75, 0.62],
    [0.69, 0.58],
    [0.63, 0.6],
    [0.6, 0.63],
    [0.55, 0.59],
    [0.5, 0.59],
    [0.46, 0.63],
    [0.41, 0.59],
    [0.35, 0.6],
    [0.32, 0.63],
    [0.29, 0.59],
    [0.26, 0.57],
    [0.23, 0.59],
  ]);
  await stroke(page, [
    [0.5, 0.27],
    [0.45, 0.37],
    [0.4, 0.48],
    [0.35, 0.6],
  ]);
  await stroke(page, [
    [0.5, 0.27],
    [0.5, 0.41],
    [0.48, 0.53],
    [0.46, 0.63],
  ]);
  await stroke(page, [
    [0.5, 0.27],
    [0.56, 0.4],
    [0.6, 0.53],
    [0.6, 0.63],
  ]);
}
async function canvasData(page: Page) {
  return page
    .getByLabel("Drawing canvas")
    .evaluate((c: HTMLCanvasElement) => c.toDataURL());
}
test("two players create, guess, relay, socialize, share and rank; real desktop/mobile screens", async ({
  page,
  browser,
}) => {
  mkdirSync("test-results/qa", { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByText("No stacks yet. Yours could be the first."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start a stack" }).click();
  await page.getByLabel("Your nickname").fill("Jamie");
  await page.getByRole("button", { name: "Let’s play" }).click();
  await expect(
    page.getByRole("heading", { name: "What will you draw?" }),
  ).toBeVisible();
  const chosen = page.locator(".word-options button").first();
  const word = (await chosen.textContent())!;
  await chosen.click();
  await page
    .getByRole("button", { name: "Publish stack", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("canvas is empty");
  await drawUmbrella(page);
  await expect(page.getByText("Draft saved on this device")).toBeVisible();
  const first = await canvasData(page);
  await page.getByRole("button", { name: "Save & exit" }).click();
  await page.getByRole("button", { name: "Start a stack" }).click();
  await expect.poll(() => canvasData(page)).toBe(first);
  await page.screenshot({
    path: "test-results/qa/editor-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Publish stack", exact: true })
    .click();
  await expect(page.getByText("Your stack is growing.")).toBeVisible();
  const stackPath = new URL(page.url()).pathname,
    detail = await (await page.request.get(`/api${stackPath}`)).json(),
    floor = detail.floors[0].id;
  await expect(
    page.getByRole("button", { name: "Like 0", exact: true }),
  ).toBeDisabled();
  const guest = await browser.newContext({
    baseURL: "http://127.0.0.1:3100",
    viewport: { width: 1487, height: 1058 },
  });
  const player = await guest.newPage();
  player.on("pageerror", (e) => errors.push(e.message));
  const anonymous = await (await guest.request.get(`/api${stackPath}`)).json();
  expect(anonymous.word).toBeNull();
  expect(anonymous.guesses).toEqual([]);
  await player.goto(stackPath);
  await expect(player.getByText("A spoiler-free zone.")).toBeVisible();
  await player.getByLabel("Your guess", { exact: true }).fill("not the word");
  await player.getByRole("button", { name: "Guess", exact: true }).click();
  await player.getByLabel("Your nickname").fill("Alex");
  await player.getByRole("button", { name: "Let’s play" }).click();
  await expect(player.getByText("4 / 5 tries left")).toBeVisible();
  await expect(player.locator(".guess-history")).toContainText("not the word");
  await player.screenshot({
    path: "test-results/qa/detail-wrong-desktop.png",
    fullPage: true,
  });
  await player.getByLabel("Your guess", { exact: true }).fill(word);
  await player.getByRole("button", { name: "Guess", exact: true }).click();
  await expect(
    player.getByRole("heading", { name: "You got it!" }),
  ).toBeVisible();
  await player.getByRole("button", { name: "Like 0", exact: true }).click();
  await expect(
    player.getByRole("button", { name: "Like 1", exact: true }),
  ).toBeVisible();
  await player
    .getByLabel("Add a comment")
    .fill("Love this drawing! <script>plain text</script>");
  await player.getByRole("button", { name: "Post comment" }).click();
  await expect(player.locator(".comment p")).toHaveText(
    "Love this drawing! <script>plain text</script>",
  );
  await player.getByRole("link", { name: "Draw the next floor" }).click();
  await expect(
    player.getByRole("heading", { name: "Add floor 2" }),
  ).toBeVisible();
  await drawUmbrella(player);
  await player
    .getByRole("button", { name: "Publish floor", exact: true })
    .click();
  await expect(player.getByText("2 / 50 floors")).toBeVisible();
  await expect(player.getByText("You’ve added your floor.")).toBeVisible();
  await player.getByRole("button", { name: "Floor 1 Jamie" }).click();
  await player
    .getByRole("button", { name: "Delete comment", exact: true })
    .click();
  await player
    .getByRole("button", { name: "Delete comment", exact: true })
    .last()
    .click();
  await expect(player.locator(".comment")).toHaveCount(0);
  await guest.grantPermissions(["clipboard-read", "clipboard-write"]);
  await player.getByRole("button", { name: "Share", exact: true }).click();
  await expect(player.getByText("Link copied!")).toBeVisible();
  expect(await player.evaluate(() => navigator.clipboard.readText())).toContain(
    `floor=${floor}`,
  );
  await player.getByRole("link", { name: "Leaderboards", exact: true }).click();
  await expect(player.locator(".rank-row")).toContainText("Stack #001");
  await player.getByRole("tab", { name: "Top guessers" }).click();
  await expect(player.locator(".rank-row")).toContainText("Alex");
  await player.getByRole("tab", { name: "Most-loved artists" }).click();
  await expect(player.locator(".rank-row")).toContainText("Jamie");
  await player.screenshot({
    path: "test-results/qa/leaderboards-desktop.png",
    fullPage: true,
  });
  await player.getByRole("button", { name: "Jamie", exact: true }).click();
  await expect(
    player.getByRole("heading", { name: "Jamie’s drawings" }),
  ).toBeVisible();
  await player.getByRole("button", { name: "Close profile" }).click();
  await page.goto("/");
  await expect(page.locator(".stack-card")).toHaveCount(1);
  await page.screenshot({
    path: "test-results/qa/home-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/qa/home-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto(stackPath);
  await page.screenshot({
    path: "test-results/qa/detail-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/new");
  await page.locator(".word-options button").first().click();
  await expect(page.getByLabel("Drawing canvas")).toBeVisible();
  await page.screenshot({
    path: "test-results/qa/editor-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await guest.close();
});
test("editor supports erase, shapes, fill, selection, undo/redo, clear and zoom", async ({
  page,
  context,
}) => {
  await identify(context, "Painter");
  await page.goto("/new");
  await page.locator(".word-options button").first().click();
  const blank = await canvasData(page);
  await stroke(page, [
    [0.2, 0.3],
    [0.4, 0.3],
    [0.5, 0.4],
  ]);
  const drawn = await canvasData(page);
  expect(drawn).not.toBe(blank);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(() => canvasData(page)).toBe(blank);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(() => canvasData(page)).toBe(drawn);
  await page.getByRole("button", { name: "Eraser", exact: true }).click();
  await stroke(page, [
    [0.2, 0.3],
    [0.4, 0.3],
  ]);
  expect(await canvasData(page)).not.toBe(drawn);
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await stroke(page, [
    [0.55, 0.5],
    [0.8, 0.8],
  ]);
  await page.getByRole("button", { name: "Fill", exact: true }).click();
  await page.getByLabel("HEX color").fill("#2F80ED");
  await stroke(page, [[0.65, 0.65]]);
  const pixel = await page
    .getByLabel("Drawing canvas")
    .evaluate((c: HTMLCanvasElement) =>
      Array.from(c.getContext("2d")!.getImageData(624, 416, 1, 1).data),
    );
  expect(pixel).toEqual([47, 128, 237, 255]);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await stroke(page, [
    [0.52, 0.47],
    [0.83, 0.83],
  ]);
  await expect(page.locator(".selection-outline")).toBeVisible();
  const selected = await canvasData(page);
  await stroke(page, [
    [0.65, 0.65],
    [0.35, 0.4],
  ]);
  expect(await canvasData(page)).not.toBe(selected);
  await page.getByRole("button", { name: "Delete selection" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.locator(".canvas-actions")).toContainText("125%");
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await expect(page.locator(".canvas-actions")).toContainText("100%");
  const beforeClear = await canvasData(page);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.getByRole("button", { name: "Clear canvas", exact: true }).click();
  await expect.poll(() => canvasData(page)).toBe(blank);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(() => canvasData(page)).toBe(beforeClear);
});
test("API rejects anonymous writes, forged identity, cross-site writes and comment spoilers", async ({
  request,
  context,
}) => {
  expect(
    (
      await request.post("/api/stacks", {
        headers: { "X-DrawStacks": "1" },
        data: {},
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.put("/api/me", { data: { nickname: "No header" } })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.put("/api/me", {
        headers: { "X-DrawStacks": "1", Origin: "https://evil.example" },
        data: { nickname: "Cross site" },
      })
    ).status(),
  ).toBe(403);
  const me = await identify(context, "Security tester");
  await context.clearCookies();
  await context.addCookies([
    { name: "drawstacks_session", value: me.id, url: "http://127.0.0.1:3100" },
  ]);
  expect((await (await context.request.get("/api/me")).json()).user).toBeNull();
  const list = await (await context.request.get("/api/stacks")).json();
  if (list.stacks.length) {
    const id = list.stacks[0].latest;
    expect(
      (await context.request.get(`/api/floors/${id}/comments`)).status(),
    ).toBe(403);
  }
});
