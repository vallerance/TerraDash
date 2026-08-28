import { expect, test } from '@playwright/test';

type Capture = {
  longTasks: number[];
  inputTasks: number[];
};

test.describe('production map performance capture', () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const longTasks: number[] = [];
      const inputTasks: number[] = [];
      const observe = (type: string, target: number[]) => {
        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) target.push(entry.duration);
          }).observe({ type, buffered: true } as PerformanceObserverInit);
        } catch {
          // The capture remains valid on browsers without this optional entry type.
        }
      };
      observe('longtask', longTasks);
      observe('event', inputTasks);
      Object.assign(window, {
        __resetTerraDashCapture: () => {
          longTasks.length = 0;
          inputTasks.length = 0;
        },
        __readTerraDashCapture: (): Capture => ({ longTasks, inputTasks }),
      });
    });
  });

  for (const fixture of [
    { id: 'caribbean', durationMs: 8_000 },
    { id: 'china-provinces', durationMs: 32_370 },
  ]) {
    test(
      'captures ' + fixture.id + ' idle and typing workload',
      async ({ page }, testInfo) => {
        await page.goto('/TerraDash/?quiz=' + fixture.id + '&start=1');
        await expect(page.locator('.active-player')).toBeVisible();
        await expect(page.locator('.world-map')).toBeVisible();
        await page.evaluate(() => {
          (
            window as Window & { __resetTerraDashCapture: () => void }
          ).__resetTerraDashCapture();
        });
        await page.waitForTimeout(fixture.durationMs);
        const answer = page.getByRole('combobox', { name: 'Location name' });
        for (const value of ['a', 'ca', 'car', 'cari', 'carib']) {
          await answer.fill(value);
        }
        const capture = await page.evaluate(() =>
          (
            window as Window & {
              __readTerraDashCapture: () => Capture;
            }
          ).__readTerraDashCapture(),
        );
        const busyTimeMs = capture.longTasks.reduce(
          (total, duration) => total + duration,
          0,
        );
        const result = {
          fixture: fixture.id,
          captureDurationMs: fixture.durationMs,
          busyTimeMs,
          maxInputTaskMs: Math.max(0, ...capture.inputTasks),
          longTaskCount: capture.longTasks.length,
        };
        await testInfo.attach(fixture.id + '-performance.json', {
          body: JSON.stringify(result, null, 2),
          contentType: 'application/json',
        });
        expect(result.maxInputTaskMs).toBeLessThan(100);
        if (fixture.id === 'china-provinces') {
          expect(result.busyTimeMs).toBeLessThan(29_730 * 0.2);
        }
      },
    );
  }
});
