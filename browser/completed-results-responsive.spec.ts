import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 375, height: 667 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
]) {
  test(`completed results fit ${viewport.width}x${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/TerraDash/?quiz=world&start=1');
    await expect(page.locator('.active-player')).toBeVisible();
    expect(await page.evaluate(() => window.terraDash?.completeQuiz())).toBe(
      'completed',
    );

    const measurements = await page.evaluate(() => {
      const metrics = document.querySelector<HTMLElement>('.results-grid')!;
      return {
        pageScrollWidth: document.documentElement.scrollWidth,
        pageClientWidth: document.documentElement.clientWidth,
        metricsScrollWidth: metrics.scrollWidth,
        metricsClientWidth: metrics.clientWidth,
        animationName: getComputedStyle(
          document.querySelector<HTMLElement>('.result-mood > span')!,
        ).animationName,
      };
    });
    console.log(JSON.stringify({ viewport, measurements }));
    expect(measurements.pageScrollWidth).toBeLessThanOrEqual(
      measurements.pageClientWidth,
    );
    expect(measurements.metricsScrollWidth).toBeLessThanOrEqual(
      measurements.metricsClientWidth,
    );
    expect(measurements.animationName).toBe('none');
    await expect(page.locator('.result-score')).toBeVisible();
    await expect(page.locator('.results-grid dt').nth(0)).toHaveText('Time');
    await expect(page.locator('.results-grid dt').nth(1)).toHaveText(
      'Accuracy',
    );
    await expect(page.locator('.results-grid dt').nth(2)).toHaveText('Missed');
    const reachability = await page.evaluate(() => {
      const playAgain = document.querySelector<HTMLButtonElement>(
        '.quiz-results > .primary-action',
      );
      const footer = document.querySelector<HTMLElement>('.app-footer');
      playAgain?.scrollIntoView({ block: 'center' });
      const playAgainVisible = Boolean(
        playAgain && playAgain.getBoundingClientRect().bottom <= innerHeight,
      );
      footer?.scrollIntoView({ block: 'center' });
      const footerVisible = Boolean(
        footer &&
        footer.getBoundingClientRect().top >= 0 &&
        footer.getBoundingClientRect().bottom <= innerHeight,
      );
      return {
        playAgainVisible,
        footerVisible,
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: innerHeight,
      };
    });
    expect(reachability.playAgainVisible).toBe(true);
    expect(reachability.footerVisible).toBe(true);
    expect(reachability.documentHeight).toBeGreaterThan(
      reachability.viewportHeight,
    );
    const disclaimerContained = await page
      .locator('.app-footer .disclaimer')
      .evaluate((disclaimer) => {
        const footer = disclaimer
          .closest('.app-footer')!
          .getBoundingClientRect();
        const text = disclaimer.getBoundingClientRect();
        return (
          text.left >= footer.left &&
          text.right <= footer.right &&
          text.top >= footer.top &&
          text.bottom <= footer.bottom
        );
      });
    expect(disclaimerContained).toBe(true);
    const footerContentFit = await page
      .locator('.app-footer')
      .evaluate((footer) => {
        const footerBox = footer.getBoundingClientRect();
        const contentBottom = Math.max(
          ...[...footer.children].map(
            (child) => child.getBoundingClientRect().bottom,
          ),
        );
        const bottomGap = footerBox.bottom - contentBottom;
        const paddingBottom = Number.parseFloat(
          getComputedStyle(footer).paddingBottom,
        );
        return bottomGap >= 0 && bottomGap <= paddingBottom + 2;
      });
    expect(footerContentFit).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(
        `completed-results-${viewport.width}x${viewport.height}.png`,
      ),
      fullPage: true,
    });
  });
}
