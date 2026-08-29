import { expect, test, type BrowserContext } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

type Capture = {
  longTasks: number[];
  inputTasks: number[];
};

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
          await answer.fill(value);
        }
        const traceEvents = await stopTrace(client);
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
        if (fixture.id === 'china-provinces') {
          expect(result.rendererTaskOccupancyMs).toBeLessThan(29_730 * 0.2);
        }
      },
    );
  }
});
