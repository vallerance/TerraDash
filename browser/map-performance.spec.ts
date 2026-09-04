import { expect, test, type BrowserContext } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

type Capture = {
  longTasks: { startTime: number; duration: number }[];
  inputTasks: number[];
};

type InteractionWindow = { start: number; end: number };

type TraceEvent = {
  name?: string;
  ph?: string;
  dur?: number;
  tid?: number;
  args?: { name?: string };
};

async function stopTrace(
  client: Awaited<ReturnType<BrowserContext['newCDPSession']>>,
): Promise<TraceEvent[]> {
  const complete = new Promise<{ stream: string }>((resolve) => {
    client.once('Tracing.tracingComplete', resolve);
  });
  await client.send('Tracing.end');
  const { stream } = await complete;
  let data = '';
  for (;;) {
    const chunk = await client.send('IO.read', { handle: stream });
    data += chunk.data;
    if (chunk.eof) break;
  }
  await client.send('IO.close', { handle: stream });
  return (JSON.parse(data) as { traceEvents?: TraceEvent[] }).traceEvents ?? [];
}

test.describe('production map performance capture', () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const longTasks: { startTime: number; duration: number }[] = [];
      const inputTasks: number[] = [];
      const observers: PerformanceObserver[] = [];
      const interactionWindows: InteractionWindow[] = [];
      const observe = (
        type: string,
        target: unknown[],
        options: Omit<PerformanceObserverInit, 'buffered'> = {},
      ) => {
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries())
              target.push(
                type === 'longtask'
                  ? { startTime: entry.startTime, duration: entry.duration }
                  : entry.duration,
              );
          });
          observer.observe({ type, buffered: false, ...options });
          observers.push(observer);
        } catch {
          // The capture remains valid on browsers without this optional entry type.
        }
      };
      Object.assign(window, {
        __resetTerraDashCapture: () => {
          for (const observer of observers) observer.disconnect();
          observers.length = 0;
          longTasks.length = 0;
          inputTasks.length = 0;
          interactionWindows.length = 0;
          observe('longtask', longTasks);
          observe('event', inputTasks, { durationThreshold: 16 });
        },
        __readTerraDashCapture: (): Capture => ({ longTasks, inputTasks }),
        __beginTerraDashInteraction: () => performance.now(),
        __endTerraDashInteraction: (start: number) =>
          interactionWindows.push({ start, end: performance.now() }),
        __readTerraDashInteractionWindows: () => interactionWindows,
      });
    });
  });

  test('calibrates that the 50 ms gate detects a blocking application task', async ({
    page,
  }) => {
    await page.goto('/TerraDash/?quiz=caribbean&start=1');
    await page.evaluate(() => {
      (
        window as Window & { __resetTerraDashCapture: () => void }
      ).__resetTerraDashCapture();
    });
    await page.evaluate(() => {
      const end = performance.now() + 60;
      while (performance.now() < end) {
        // Deliberately emulate one blocking application task for calibration.
      }
    });
    await page.waitForTimeout(0);
    const capture = await page.evaluate(() =>
      (
        window as Window & {
          __readTerraDashCapture: () => Capture;
        }
      ).__readTerraDashCapture(),
    );
    expect(
      Math.max(0, ...capture.longTasks.map(({ duration }) => duration)),
    ).toBeGreaterThanOrEqual(50);
  });

  for (const fixture of [
    { id: 'caribbean', durationMs: 8_000 },
    { id: 'china-provinces', durationMs: 32_370 },
  ]) {
    test(
      'captures ' + fixture.id + ' idle and typing workload',
      async ({ page, context }, testInfo) => {
        await page.goto('/TerraDash/?quiz=' + fixture.id + '&start=1');
        await expect(page.locator('.active-player')).toBeVisible();
        await expect(page.locator('.world-map')).toBeVisible();
        const client = await context.newCDPSession(page);
        await client.send('Tracing.start', {
          categories:
            'devtools.timeline,disabled-by-default-devtools.timeline,v8.execute',
          transferMode: 'ReturnAsStream',
        });
        await page.evaluate(() => {
          (
            window as Window & { __resetTerraDashCapture: () => void }
          ).__resetTerraDashCapture();
        });
        await page.waitForTimeout(fixture.durationMs);
        const answer = page.getByRole('combobox', { name: 'Location name' });
        for (const value of ['a', 'ca', 'car', 'cari', 'carib']) {
          const start = await page.evaluate(() =>
            (
              window as Window & {
                __beginTerraDashInteraction: () => number;
              }
            ).__beginTerraDashInteraction(),
          );
          await answer.fill(value);
          await page.evaluate((interactionStart) => {
            (
              window as Window & {
                __endTerraDashInteraction: (start: number) => void;
              }
            ).__endTerraDashInteraction(interactionStart);
          }, start);
        }
        await page.waitForTimeout(0);
        const traceEvents = await stopTrace(client);
        const capture = await page.evaluate(() =>
          (
            window as Window & {
              __readTerraDashCapture: () => Capture;
            }
          ).__readTerraDashCapture(),
        );
        const interactionWindows = await page.evaluate(() =>
          (
            window as Window & {
              __readTerraDashInteractionWindows: () => InteractionWindow[];
            }
          ).__readTerraDashInteractionWindows(),
        );
        const interactionLongTasks = capture.longTasks.filter((task) =>
          interactionWindows.some(
            ({ start, end }) =>
              task.startTime < end && task.startTime + task.duration > start,
          ),
        );
        const busyTimeMs = capture.longTasks.reduce(
          (total, { duration }) => total + duration,
          0,
        );
        const rendererThreadIds = new Set(
          traceEvents
            .filter(
              (event) =>
                event.name === 'thread_name' &&
                /RendererMain|MainThread/.test(event.args?.name ?? ''),
            )
            .map((event) => event.tid)
            .filter((tid): tid is number => tid !== undefined),
        );
        const rendererTaskOccupancyMs = traceEvents
          .filter(
            (event) =>
              event.ph === 'X' &&
              event.name === 'RunTask' &&
              (rendererThreadIds.size === 0 ||
                rendererThreadIds.has(event.tid)),
          )
          .reduce((total, event) => total + (event.dur ?? 0) / 1000, 0);
        const result = {
          fixture: fixture.id,
          captureDurationMs: fixture.durationMs,
          busyTimeMs,
          rendererTaskOccupancyMs,
          baselineTaskOccupancyMs:
            fixture.id === 'china-provinces' ? 29_730 : null,
          reductionPercent:
            fixture.id === 'china-provinces'
              ? (1 - rendererTaskOccupancyMs / 29_730) * 100
              : null,
          maxInputTaskMs: Math.max(0, ...capture.inputTasks),
          longTaskCount: capture.longTasks.length,
          interactionLongTaskCount: interactionLongTasks.length,
          maxInteractionLongTaskMs: Math.max(
            0,
            ...interactionLongTasks.map(({ duration }) => duration),
          ),
        };
        const artifactPath = testInfo.outputPath(
          fixture.id + '-performance.json',
        );
        await writeFile(artifactPath, JSON.stringify(result, null, 2));
        console.log(fixture.id + ' performance: ' + JSON.stringify(result));
        await testInfo.attach(fixture.id + '-performance.json', {
          path: artifactPath,
          contentType: 'application/json',
        });
        expect(result.maxInputTaskMs).toBeLessThan(100);
        expect(result.maxInteractionLongTaskMs).toBeLessThan(50);
        if (fixture.id === 'china-provinces') {
          expect(result.rendererTaskOccupancyMs).toBeLessThan(29_730 * 0.2);
        }
      },
    );
  }
});
