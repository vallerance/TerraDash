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
  await dialog.getByRole('button', { name: 'Start Asia UN Countries' }).click();
  await expect(page.locator('.active-player .quiz-name')).toHaveText(
    'Asia UN Countries',
  );
});
