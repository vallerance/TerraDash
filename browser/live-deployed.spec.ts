import { expect, test, type Page } from '@playwright/test';

const liveBase = process.env.LIVE_BASE_URL;

test.skip(
  !liveBase,
  'Set LIVE_BASE_URL to run against the deployed Pages site',
);

type DiscoveredQuiz = {
  categoryLabel: string;
  quizLabel: string;
  href: string;
};

async function discoverQuizLinks(page: Page): Promise<DiscoveredQuiz[]> {
  await page.getByRole('button', { name: /Quizzes/ }).click();
  const menu = page.getByRole('menu').first();
  const categoryButtons = menu.locator('.quiz-submenu > button');
  const discovered: DiscoveredQuiz[] = [];
  for (let index = 0; index < (await categoryButtons.count()); index += 1) {
    const categoryButton = categoryButtons.nth(index);
    const categoryLabel = (await categoryButton.textContent())
      ?.replace('▸', '')
      .trim();
    if (!categoryLabel)
      throw new Error('Category button has no accessible label');
    await categoryButton.click();
    const submenu = page.getByRole('menu').last();
    const quizLinks = submenu.getByRole('menuitem');
    for (let quizIndex = 0; quizIndex < (await quizLinks.count()); quizIndex += 1) {
      const quizLink = quizLinks.nth(quizIndex);
      const quizLabel = (await quizLink.textContent())?.trim();
      const href = await quizLink.getAttribute('href');
      if (!quizLabel || !href)
        throw new Error('Quiz menuitem is missing label or href');
      discovered.push({ categoryLabel, quizLabel, href });
    }
    await categoryButton.click();
  }
  return discovered;
}

async function openQuizFromCategory(
  page: Page,
  categoryLabel: string,
  quizLabel: string,
): Promise<void> {
  await page.getByRole('button', { name: /Quizzes/ }).click();
  const menu = page.getByRole('menu').first();
  await menu
    .getByRole('menuitem', { name: categoryLabel, exact: true })
    .click();
  await page
    .getByRole('menu')
    .last()
    .getByRole('menuitem', { name: quizLabel, exact: true })
    .click();
}

test('deployed Pages dropdown opens every quiz details dialog', async ({
  page,
}) => {
  await page.goto(`${liveBase}/`);
  const quizzes = await discoverQuizLinks(page);
  for (const quiz of quizzes) {
    await page.goto(`${liveBase}/`);
    await openQuizFromCategory(page, quiz.categoryLabel, quiz.quizLabel);
    const quizId = new URL(quiz.href).searchParams.get('quiz');
    if (!quizId) throw new Error(`Missing quiz ID in href for ${quiz.quizLabel}`);
    await expect(page).toHaveURL(
      new RegExp(`[?&]quiz=${quizId}`),
    );
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: /Start .* Quiz/ }),
    ).toBeVisible();
  }
});

for (const pageName of ['diagnostics.html', '?page=high-scores']) {
  test(`deployed ${pageName} returns to a quiz dialog`, async ({ page }) => {
    await page.goto(`${liveBase}/${pageName}`);
    await openQuizFromCategory(page, 'Countries', 'Asia');
    await expect(
      page.getByRole('dialog', { name: 'Asia UN Countries' }),
    ).toBeVisible();
  });
}
