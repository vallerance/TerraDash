import { expect, test, type Page } from '@playwright/test';

async function expectDialogOverlay(page: Page) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('A viewport is required for overlay assertions');

  const overlay = page.locator('.quiz-dialog-backdrop');
  const dialog = page.getByRole('dialog', { name: 'World UN Countries' });
  await expect(overlay).toBeVisible();
  await expect(dialog).toBeVisible();

  const metrics = await overlay.evaluate((element) => {
    const overlayBox = element.getBoundingClientRect();
    const dialogElement = element.querySelector('.quiz-dialog');
    if (!dialogElement) throw new Error('Dialog surface is missing');
    const dialogBox = dialogElement.getBoundingClientRect();
    const overlayStyle = getComputedStyle(element);
    const dialogStyle = getComputedStyle(dialogElement);
    return {
      overlay: {
        left: overlayBox.left,
        top: overlayBox.top,
        right: overlayBox.right,
        bottom: overlayBox.bottom,
      },
      dialog: {
        left: dialogBox.left,
        top: dialogBox.top,
        right: dialogBox.right,
        bottom: dialogBox.bottom,
      },
      overlayBackground: overlayStyle.backgroundColor,
      dialogBackground: dialogStyle.backgroundColor,
      dialogOpacity: dialogStyle.opacity,
      overlayZIndex: overlayStyle.zIndex,
    };
  });

  expect(metrics.overlay.left).toBeLessThanOrEqual(0);
  expect(metrics.overlay.top).toBeLessThanOrEqual(0);
  expect(metrics.overlay.right).toBeGreaterThanOrEqual(viewport.width);
  expect(metrics.overlay.bottom).toBeGreaterThanOrEqual(viewport.height);
  expect(metrics.overlayBackground).toMatch(/rgba\(5, 10, 18, 0\.8\)/);
  expect(metrics.dialogBackground).toBe('rgb(17, 28, 46)');
  expect(metrics.dialogOpacity).toBe('1');
  expect(metrics.overlayZIndex).toBe('1000');
  expect(metrics.dialog.left).toBeGreaterThan(metrics.overlay.left);
  expect(metrics.dialog.top).toBeGreaterThan(metrics.overlay.top);
  expect(metrics.dialog.right).toBeLessThan(metrics.overlay.right);
  expect(metrics.dialog.bottom).toBeLessThan(metrics.overlay.bottom);
}

test('home quiz dialog has a full-viewport dim backdrop at desktop size', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/TerraDash/');
  await page.getByRole('button', { name: 'World UN Countries' }).click();
  await expectDialogOverlay(page);
  await page.screenshot({
    path: testInfo.outputPath('dialog-overlay-home-wide.png'),
    fullPage: true,
  });
});

test('home quiz dialog keeps the dim backdrop and crisp surface on mobile', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/TerraDash/');
  await page.getByRole('button', { name: 'World UN Countries' }).click();
  await expectDialogOverlay(page);
  await page.screenshot({
    path: testInfo.outputPath('dialog-overlay-home-mobile.png'),
    fullPage: true,
  });
});

test('cross-page quiz dialog retains the same backdrop contract', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/TerraDash/diagnostics.html');
  await page.getByRole('button', { name: /Quizzes/ }).click();
  await page.getByRole('menuitem', { name: 'World' }).click();
  await expectDialogOverlay(page);
  await page.screenshot({
    path: testInfo.outputPath('dialog-overlay-diagnostics.png'),
    fullPage: true,
  });
});
