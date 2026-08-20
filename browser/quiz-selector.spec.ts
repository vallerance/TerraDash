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
const nonUnTitle =
  'Non-UN Countries, Independent Territories, and Autonomous Regions';

test('header navbar exposes all quizzes and enters the selected quiz', async ({
  page,
}) => {
  await page.goto('/TerraDash/');
  const navbar = page.getByRole('navigation', { name: 'Quizzes' });
  const links = navbar.getByRole('link');
  await expect(links).toHaveText(
    quizNames
      .map((name) => name.replace(' UN Countries', ''))
      .concat(nonUnTitle),
  );
  await expect(page.locator('.quiz-option')).toHaveCount(9);
  await expect(page.locator('.quiz-option-thumbnail')).toHaveCount(9);
  await expect(
    page.getByText(
      /Identify all .* locations with three attempts per location/,
    ),
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

test('selects and starts the non-UN quiz', async ({ page }) => {
  await page.goto('/TerraDash/');
  const title = nonUnTitle;
  await page.getByRole('button', { name: title }).click();
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('101 locations')).toBeVisible();
  await page.goto('/TerraDash/?quiz=non-un&start=1');
  await expect(page.locator('.active-player .quiz-name')).toHaveText(title);
});
