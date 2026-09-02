import { expect, test, type Page } from '@playwright/test';
import { quizCategoriesFor, quizOptions } from '../src/contracts/quiz';

const liveBase = process.env.LIVE_BASE_URL;
const categories = quizCategoriesFor(quizOptions);

test.skip(
  !liveBase,
  'Set LIVE_BASE_URL to run against the deployed Pages site',
);

async function openQuizFromCategory(
  page: Page,
  quiz: (typeof quizOptions)[number],
) {
  const category = categories.find(({ options }) =>
    options.some(({ id }) => id === quiz.id),
  );
  if (!category) throw new Error(`Missing category for quiz ${quiz.id}`);

  await page.getByRole('button', { name: /Quizzes/ }).click();
  const menu = page.getByRole('menu').first();
  await menu
    .getByRole('menuitem', { name: category.label, exact: true })
    .click();
  await page
    .getByRole('menu')
    .last()
    .getByRole('menuitem', { name: quiz.menuLabel, exact: true })
    .click();
}

test('deployed Pages dropdown opens every quiz details dialog', async ({
  page,
}) => {
  for (const quiz of quizOptions) {
    await page.goto(`${liveBase}/`);
    await openQuizFromCategory(page, quiz);
    await expect(page).toHaveURL(/[?&]quiz=[^&]+/);
    const dialog = page.getByRole('dialog', { name: quiz.name });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: `Start ${quiz.name} Quiz` }),
    ).toBeVisible();
  }
});

for (const pageName of ['diagnostics.html', '?page=high-scores']) {
  test(`deployed ${pageName} returns to a quiz dialog`, async ({ page }) => {
    await page.goto(`${liveBase}/${pageName}`);
    await openQuizFromCategory(
      page,
      quizOptions.find(({ id }) => id === 'asia')!,
    );
    await expect(
      page.getByRole('dialog', { name: 'Asia UN Countries' }),
    ).toBeVisible();
  });
}
