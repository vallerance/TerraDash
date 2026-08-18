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

test('header selector exposes all quizzes and enters the selected quiz', async ({
  page,
}) => {
  await page.goto('/TerraDash/');
  const selector = page.getByRole('combobox', { name: 'Choose quiz' });
  await expect(selector.locator('option')).toHaveText(quizNames);
  await selector.selectOption({ label: 'Asia UN Countries' });
  await expect(selector).toHaveValue('asia');
  await page.getByRole('button', { name: 'Start quiz' }).click();
  await expect(page.locator('.active-player .quiz-name')).toHaveText(
    'Asia UN Countries',
  );
});
