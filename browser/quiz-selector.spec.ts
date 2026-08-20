import { expect, test } from '@playwright/test';

const quizNames = [
  'World UN Countries',
  'Africa UN Countries',
  'Asia UN Countries',
  'Europe UN Countries',
  'North America UN Countries',
  'South America UN Countries',
  'Oceania UN Countries',
  'Caribbean UN Countries',
];

test('header navbar exposes all quizzes and enters the selected quiz', async ({
  page,
}) => {
  await page.goto('/TerraDash/');
  const navbar = page.getByRole('navigation', { name: 'Quizzes' });
  const links = navbar.getByRole('link');
  await expect(links).toHaveText(
    quizNames.map((name) => name.replace(' UN Countries', '')),
  );
  await expect(page.locator('.quiz-option')).toHaveCount(8);
  await expect(page.locator('.quiz-option-thumbnail')).toHaveCount(8);
  await expect(
    page.getByText(/Identify all .* locations with three attempts per location/),
  ).toHaveCount(0);
  await links.filter({ hasText: /^Asia$/ }).click();
  await expect(page).toHaveURL(/\?quiz=asia$/);
  await expect(navbar.getByRole('link', { name: 'Asia' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('button', { name: 'Start quiz' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Asia UN Countries' }).click();
  const dialog = page.getByRole('dialog', { name: 'Asia UN Countries' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('48 locations')).toBeVisible();
  await dialog
    .getByRole('button', { name: 'Start Asia UN Countries Quiz' })
    .click();
  await expect(page.locator('.active-player .quiz-name')).toHaveText(
    'Asia UN Countries',
  );
});

test('home composition and every deployed header destination work', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/TerraDash/');
  const measurements = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>('#start-title')!.getBoundingClientRect();
    const grid = document.querySelector<HTMLElement>('.quiz-options')!.getBoundingClientRect();
    const footer = document.querySelector<HTMLElement>('.app-footer')!.getBoundingClientRect();
    return { heroLeft: hero.left, gridLeft: grid.left, gridWidth: grid.width, footerBottom: footer.bottom, viewport: innerWidth };
  });
  expect(Math.abs(measurements.heroLeft - measurements.gridLeft)).toBeLessThan(2);
  expect(measurements.gridWidth).toBeGreaterThan(900);
  expect(measurements.footerBottom).toBeLessThanOrEqual(900);
  await page.screenshot({ path: testInfo.outputPath('home-wide.png'), fullPage: true });

  const quizLinks = page.getByRole('navigation', { name: 'Quizzes' }).getByRole('link');
  const quizIds = ['world', 'africa', 'asia', 'europe', 'north-america', 'south-america', 'oceania', 'caribbean'];
  for (const [index, id] of quizIds.entries()) {
    await quizLinks.nth(index).click();
    await expect(page).toHaveURL(new RegExp(`/TerraDash/\\?quiz=${id}$`));
    await expect(page.getByRole('navigation', { name: 'Quizzes' }).getByRole('link').nth(index)).toHaveAttribute('aria-current', 'page');
  }
  await page.getByRole('link', { name: 'TerraDash home' }).click();
  await expect(page).toHaveURL(/\/TerraDash\/$/);
  await page.getByRole('link', { name: 'Diagnostics' }).click();
  await expect(page).toHaveURL(/\/TerraDash\/diagnostics\.html$/);
  await expect(page.getByRole('heading', { name: 'Inspect a location' })).toBeVisible();
  await page.getByRole('link', { name: 'Quiz' }).click();
  await expect(page).toHaveURL(/\/TerraDash\/$/);
});

test('home cards stack into a readable mobile surface', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/TerraDash/');
  const bounds = await page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>('.quiz-options')!.getBoundingClientRect();
    return { gridWidth: grid.width, viewport: innerWidth, cards: [...document.querySelectorAll<HTMLElement>('.quiz-option')].map((card) => card.getBoundingClientRect().width) };
  });
  expect(bounds.gridWidth).toBeLessThanOrEqual(bounds.viewport);
  expect(Math.min(...bounds.cards)).toBeGreaterThanOrEqual(140);
  await page.screenshot({ path: testInfo.outputPath('home-mobile.png'), fullPage: true });
});
