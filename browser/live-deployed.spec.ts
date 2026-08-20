import { expect, test } from '@playwright/test';

const liveBase = process.env.LIVE_BASE_URL;
const quizzes = [
  ['World', 'World UN Countries'],
  ['Africa', 'Africa UN Countries'],
  ['Asia', 'Asia UN Countries'],
  ['Europe', 'Europe UN Countries'],
  ['North America', 'North America UN Countries'],
  ['South America', 'South America UN Countries'],
  ['Oceania', 'Oceania UN Countries'],
  ['Caribbean', 'Caribbean UN Countries'],
  [
    'Non-UN Countries, Independent Territories, and Autonomous Regions',
    'Non-UN Countries, Independent Territories, and Autonomous Regions',
  ],
] as const;

test.skip(
  !liveBase,
  'Set LIVE_BASE_URL to run against the deployed Pages site',
);

test('deployed Pages dropdown opens every quiz details dialog', async ({
  page,
}) => {
  for (const [menuLabel, dialogName] of quizzes) {
    await page.goto(`${liveBase}/`);
    await page.getByRole('button', { name: /Quizzes/ }).click();
    await page.getByRole('menuitem', { name: menuLabel }).click();
    await expect(page).toHaveURL(/[?&]quiz=[^&]+/);
    const dialog = page.getByRole('dialog', { name: dialogName });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: `Start ${dialogName} Quiz` }),
    ).toBeVisible();
  }
});

for (const pageName of ['diagnostics.html', '?page=high-scores']) {
  test(`deployed ${pageName} returns to a quiz dialog`, async ({ page }) => {
    await page.goto(`${liveBase}/${pageName}`);
    await page.getByRole('button', { name: /Quizzes/ }).click();
    await page.getByRole('menuitem', { name: 'Asia' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Asia UN Countries' }),
    ).toBeVisible();
  });
}
