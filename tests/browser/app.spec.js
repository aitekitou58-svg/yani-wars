import { test, expect } from "@playwright/test";

test("month-equivalent landscape grows, persists, and appears in today sharing", async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(async () => {
    const { mutate } = await import("/src/storage.js");
    const { makeEvent } = await import("/src/core.js");
    await mutate((s) => {
      s.events = Array.from({ length: 1800 }, () =>
        makeEvent("saved", s.settings, { lifeMinutesPerStick: 20 }),
      );
      return s;
    });
  });
  await page.reload();
  await expect(page.locator("#today-count")).toHaveText("1800");
  const growth = await page
    .locator('[data-plant="tree"]')
    .evaluateAll((nodes) => nodes.map((n) => Number(n.dataset.growth)));
  expect(growth.filter((n) => n > 0.2).length).toBeGreaterThan(3);
  await page.locator("#smoked").click();
  expect(
    await page
      .locator('[data-plant="tree"]')
      .evaluateAll((nodes) => nodes.map((n) => Number(n.dataset.growth))),
  ).toEqual(growth);
  await page
    .getByRole("button", { name: "今日の成果をシェア", exact: true })
    .click();
  await expect(page.locator(".share-preview")).toHaveAttribute(
    "alt",
    /今日の成果：1800本/,
  );
  await expect(page.locator(".share-preview")).toHaveJSProperty(
    "naturalWidth",
    1080,
  );
});

test("imported brands match English, katakana and partial names", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#search").fill("marlboro");
  await expect(page.locator("[data-product]").first()).toContainText(
    "マールボロ",
  );
  await page.locator("#search").fill("まーるぼろ");
  await expect(page.locator("[data-product]").first()).toBeVisible();
  await page.locator("#search").fill("マール");
  await expect(page.locator("[data-product]").first()).toBeVisible();
});

test("rapid taps and two tabs retain every record", async ({
  page,
  context,
}) => {
  await setup(page);
  await page.locator("#save").evaluate((b) => {
    b.click();
    b.click();
    b.click();
  });
  await expect(page.locator("#today-count")).toHaveText("3");
  const second = await context.newPage();
  await second.goto("/");
  await expect(second.locator("#today-count")).toHaveText("3");
  await Promise.all([
    page.locator("#save").click(),
    second.locator("#save").click(),
  ]);
  await expect(page.locator("#today-count")).toHaveText("5");
  await expect(second.locator("#today-count")).toHaveText("5");
});
async function setup(page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "世界を、 取り戻そう。" }),
  ).toBeVisible();
  await page.locator("[data-product]").first().click();
  await page.getByRole("button", { name: "ヤニウォーズを始める" }).click();
  await expect(page.locator("#save")).toBeVisible();
}
test("onboarding, immutable gains, persistence, share, settings, deletion", async ({
  page,
}) => {
  await setup(page);
  await page.locator("#save").click();
  await expect(page.locator("#today-count")).toHaveText("1");
  await page.locator("#smoked").click();
  await expect(page.locator("#notice")).toHaveText(
    "最終喫煙時刻を更新しました",
  );
  await expect(page.locator("#today-count")).toHaveText("1");
  await page.reload();
  await expect(page.locator("#today-count")).toHaveText("1");
  await page.getByRole("button", { name: "今日の成果をシェア" }).click();
  await expect(page.locator(".share-preview")).toBeVisible();
  expect(
    await page.locator(".share-preview").evaluate((img) => img.naturalWidth),
  ).toBe(1080);
  await page.getByRole("button", { name: "閉じる" }).click();
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await page.locator('[data-minutes="7"]').click();
  await page.getByRole("button", { name: "ホーム", exact: true }).click();
  await page.locator("#save").click();
  await expect(page.locator(".time-stats")).toContainText("12分");
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await page
    .getByRole("button", { name: "すべての記録を削除", exact: true })
    .click();
  await page
    .getByRole("button", { name: "すべて削除する", exact: true })
    .click();
  await expect(page.locator("#start")).toBeVisible();
  await page.reload();
  await expect(page.locator("#start")).toBeVisible();
});
test("offline restart, OPFS restore, milestones, mobile layout", async ({
  page,
  context,
}) => {
  await setup(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  for (let n = 0; n < 10; n++) {
    await page.locator("#save").click();
    await expect(page.locator("#today-count")).toHaveText(String(n + 1));
  }
  await expect(page.locator("#notice")).toContainText("10本");
  const count = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory(),
      d = await root.getDirectoryHandle("yani-backups");
    let n = 0;
    for await (const _ of d.entries()) n++;
    return n;
  });
  expect(count).toBe(3);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#today-count")).toHaveText("10");
  await page.locator("#save").click();
  await expect(page.locator("#today-count")).toHaveText("11");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/home-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const r = indexedDB.open("yani-wars-v1");
        r.onsuccess = () => {
          const db = r.result,
            t = db.transaction("state", "readwrite");
          t.objectStore("state").put({ broken: true }, "main");
          t.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
  );
  await page.reload();
  await expect(page.locator("#today-count")).toHaveText("11");
  await expect(page.locator("#notice")).toContainText("復元");
});
test("paper and heated search filters plus manual fallback", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-category="paper"]').click();
  await expect(page.locator("[data-product]").first()).toBeVisible();
  await page.locator('[data-category="IQOS"]').click();
  await expect(page.locator("[data-product]").first()).toBeVisible();
  await page.locator("#search").fill("does-not-exist");
  await expect(page.locator("#products")).toContainText(
    "該当する銘柄がありません",
  );
  await page.locator("summary").click();
  await page.locator("#manual-name").fill("未掲載の商品");
  await page.locator("#manual-price").fill("650");
  await page.locator("#manual-count").fill("20");
  await page.locator("#manual-select").click();
  await expect(page.locator("#selection")).toContainText("32.5円");
  await page.locator("#start").click();
  await page.locator("#save").click();
  await expect(page.locator(".money")).toContainText("32.5");
});
