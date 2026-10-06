import { test, expect } from "@playwright/test";
// Sharing tests substitute a public URL without deploying a real site.
// Keep config routes independent from the Service Worker's static cache.
test.use({ serviceWorkers: "block" });

async function prepare(
  page,
  {
    publicUrl = "https://yani.example.org/app/",
    shareMode = "success",
    clipboard = true,
  } = {},
) {
  await page.route("**/config.json", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), publicUrl },
    });
  });
  await page.addInitScript(
    ({ shareMode, clipboard }) => {
      window.shared = [];
      window.copied = [];
      window.opened = [];
      Object.defineProperty(navigator, "canShare", {
        value: () => shareMode !== "unsupported",
        configurable: true,
      });
      Object.defineProperty(navigator, "share", {
        value: async (data) => {
          if (shareMode === "cancel")
            throw new DOMException("cancel", "AbortError");
          window.shared.push({
            title: data.title,
            text: data.text,
            url: data.url,
            files: data.files?.map((f) => ({
              name: f.name,
              type: f.type,
              size: f.size,
            })),
          });
        },
        configurable: true,
      });
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async (text) => {
            if (!clipboard) throw new DOMException("denied", "NotAllowedError");
            window.copied.push(text);
          },
        },
        configurable: true,
      });
      window.open = (url) => window.opened.push(url);
    },
    { shareMode, clipboard },
  );
  await page.goto("/");
  await page.locator("[data-product]").first().click();
  await page.locator("#start").click();
  await expect(page.locator("#save")).toBeVisible();
  await page.evaluate(async () => {
    const { mutate } = await import("/src/storage.js");
    const { makeEvent } = await import("/src/core.js");
    await mutate((s) => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      s.events = [
        makeEvent("saved", s.settings, { lifeMinutesPerStick: 20 }, yesterday),
        makeEvent("saved", s.settings, { lifeMinutesPerStick: 20 }),
      ];
      return s;
    });
  });
  await page.reload();
  await expect(page.locator("#today-count")).toHaveText("1");
  await page.locator('[data-action="share"]').click();
  await expect(page.locator("#share-file")).toBeEnabled();
}

test("today/cumulative image, native sharing, X composer and copy carry the public link", async ({
  page,
}) => {
  await prepare(page);
  await expect(page.locator(".share-preview")).toHaveAttribute(
    "alt",
    /今日の成果：1本/,
  );
  await page.locator('[data-share-period="all"]').click();
  await expect(page.locator(".share-preview")).toHaveAttribute(
    "alt",
    /累計の成果：2本/,
  );
  await page.locator("#share-file").click();
  const data = await page.evaluate(() => window.shared[0]);
  expect(data.url).toBe("https://yani.example.org/app/");
  expect(data.text).toContain("累計2本");
  expect(data.files[0].name).toBe("yani-wars-all.png");
  expect(data.files[0].type).toBe("image/png");
  await page.locator("#share-copy-url").click();
  await page.locator("#share-copy-caption").click();
  const copied = await page.evaluate(() => window.copied);
  expect(copied[0]).toBe(data.url);
  expect(copied[1]).toContain("累計2本");
  expect(copied[1]).toContain(data.url);
  await page.locator("#share-x").click();
  const intent = new URL(await page.evaluate(() => window.opened[0]));
  expect(intent.searchParams.get("url")).toBe(data.url);
  expect(intent.searchParams.get("text")).toBe(data.text);
  await page.getByRole("button", { name: "閉じる" }).click();
  const todayButton = page.getByRole("button", {
    name: "今日の成果をシェア",
    exact: true,
  });
  const allButton = page.getByRole("button", {
    name: "今までの成果をシェア",
    exact: true,
  });
  const todayBox = await todayButton.boundingBox(),
    allBox = await allButton.boundingBox();
  expect(Math.abs(todayBox.y - allBox.y)).toBeLessThan(2);
  expect(allBox.x).toBeGreaterThan(todayBox.x);
  await allButton.click();
  await expect(page.locator('[data-share-period="all"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".share-preview")).toHaveAttribute(
    "alt",
    /累計の成果：2本/,
  );
  await page.screenshot({
    path: `test-results/share-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("local preview has no public link; save and clipboard fallback remain usable", async ({
  page,
}) => {
  await prepare(page, {
    publicUrl: "",
    shareMode: "unsupported",
    clipboard: false,
  });
  await expect(page.locator("#share-x")).toBeDisabled();
  await expect(page.locator("#share-copy-url")).toBeDisabled();
  await page.locator("#share-copy-caption").click();
  await expect(page.locator("#share-copy-fallback")).toBeVisible();
  expect(await page.locator("#share-copy-text").inputValue()).not.toContain(
    "localhost",
  );
  const downloaded = page.waitForEvent("download");
  await page.locator("#share-file").click();
  expect((await downloaded).suggestedFilename()).toBe("yani-wars-today.png");
});

test("cancelling native sharing does not trigger a download", async ({
  page,
}) => {
  await prepare(page, { shareMode: "cancel" });
  const downloads = [];
  page.on("download", (d) => downloads.push(d));
  await page.locator("#share-file").click();
  await expect(page.locator("#share-heading")).toBeVisible();
  expect(downloads).toHaveLength(0);
});
