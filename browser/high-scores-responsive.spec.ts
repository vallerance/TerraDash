import { expect, test } from '@playwright/test';

const scores = Object.fromEntries(
  Array.from({ length: 5 }, (_, index) => [
    `entry-${index}`,
    {
      id: `entry-${index}`,
      username: `Player ${index + 1}`,
      score: 100 - index,
      elapsedMs: 1_000 + index,
      createdAt: index,
    },
  ]),
);
const quizIds = [
  'world',
  'africa',
  'asia',
  'europe',
  'north-america',
  'south-america',
  'oceania',
  'caribbean',
];

for (const viewport of [
  { width: 375, height: 667 },
  { width: 1024, height: 768 },
]) {
  test(`high scores page scrolls at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(
      (storedScores) => {
        window.localStorage.setItem(
          'terradash.high-scores.v1',
          JSON.stringify({
            version: 1,
            playerName: 'Player 1',
            scores: storedScores,
          }),
        );
      },
      Object.fromEntries(
        quizIds.map((quizId) => [quizId, Object.values(scores)]),
      ),
    );
    await page.goto('/TerraDash/?page=high-scores');
    await expect(
      page.getByRole('heading', { name: 'High Scores' }),
    ).toBeVisible();

    const beforeScroll = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(beforeScroll.scrollHeight).toBeGreaterThan(
      beforeScroll.clientHeight,
    );
    expect(beforeScroll.scrollWidth).toBeLessThanOrEqual(
      beforeScroll.clientWidth,
    );

    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    const footer = page.locator('.app-footer');
    await expect(footer).toBeVisible();
    const afterScroll = await footer.boundingBox();
    expect(afterScroll).not.toBeNull();
    expect(afterScroll!.y + afterScroll!.height).toBeLessThanOrEqual(
      viewport.height,
    );
    expect(afterScroll!.y).toBeGreaterThanOrEqual(0);
  });
}
