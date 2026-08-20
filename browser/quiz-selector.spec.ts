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

test('Quizzes menu exposes all destinations and enters the selected quiz', async ({
  page,
}) => {
  await page.goto('/TerraDash/');
  const navbar = page.getByRole('navigation', { name: 'Quizzes' });
  const trigger = navbar.getByRole('button', { name: /Quizzes/ });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  const menu = page.getByRole('menu');
  const links = menu.getByRole('menuitem');
  await expect(links).toHaveText(
    quizNames
      .map((name) => name.replace(' UN Countries', ''))
      .concat(nonUnTitle),
  );
  await expect(menu.getByRole('menuitem', { name: 'World' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.locator('.quiz-option')).toHaveCount(9);
  await expect(page.locator('.quiz-option-thumbnail')).toHaveCount(9);
  const descriptions = [
    'All UN Member and UN Observer states',
    'UN Member and UN Observer states in Africa',
    'UN Member and UN Observer states in Asia',
    'UN Member and UN Observer states in Europe',
    'UN Member and UN Observer states in North America',
    'UN Member and UN Observer states in South America',
    'UN Member and UN Observer states in Oceania',
    'UN Member and UN Observer states in Caribbean',
  ];
  for (const [index, description] of descriptions.entries()) {
    await expect(
      page.locator('.quiz-option-description').nth(index),
    ).toHaveText(description);
  }
  await expect(page.locator('.quiz-option-description').nth(8)).toHaveText(
    'Non-UN Countries and regions listed in ISO 3166-1, UN M49, the List of Economies published by the World Bank Group, or under select categories in ISO 3166-2.',
  );
  await expect(
    page.locator('.quiz-option-description').nth(8).locator('em'),
  ).toHaveText(
    'Countries and regions listed in ISO 3166-1, UN M49, the List of Economies published by the World Bank Group, or under select categories in ISO 3166-2.',
  );
  await expect(
    page.getByText(
      /Identify all .* locations with three attempts per location/,
    ),
  ).toHaveCount(0);
  await expect(page.locator('.home-page > .eyebrow')).toHaveCount(0);
  await expect(page.locator('.home-guidance li')).toHaveText([
    'Choose a quiz',
    'Identify every location with three attempts each',
    'Earn a score based on your time and accuracy',
    'Improve your next run',
  ]);
  await links.filter({ hasText: /^Asia$/ }).click();
  await expect(page).toHaveURL(/\?quiz=asia&select=1$/);
  const dialog = page.getByRole('dialog', { name: 'Asia UN Countries' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close quiz details' }).click();
  await trigger.click();
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(
    page.getByRole('menu').getByRole('menuitem', { name: 'Asia' }),
  ).toHaveAttribute('aria-current', 'page');
  await page.getByRole('menu').getByRole('menuitem', { name: 'Asia' }).click();
  await expect(page.getByRole('button', { name: 'Start quiz' })).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('48 locations')).toBeVisible();
  await dialog
    .getByRole('button', { name: 'Start Asia UN Countries Quiz' })
    .click();
  await expect(page.locator('.active-player .quiz-name')).toHaveText(
    'Asia UN Countries',
  );
});

test('Quizzes menu supports keyboard focus, Escape, and outside close', async ({
  page,
}) => {
  await page.goto('/TerraDash/');
  const trigger = page.getByRole('button', { name: /Quizzes/ });
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await trigger.click();
  await page.locator('#start-title').click();
  await expect(page.getByRole('menu')).toHaveCount(0);
});

for (const destination of [
  '/TerraDash/diagnostics.html',
  '/TerraDash/?page=high-scores',
]) {
  test(`Quizzes menu returns from ${destination} to the Asia dialog`, async ({
    page,
  }) => {
    await page.goto(destination);
    await page.getByRole('button', { name: /Quizzes/ }).click();
    await page.getByRole('menuitem', { name: 'Asia' }).click();
    const dialog = page.getByRole('dialog', { name: 'Asia UN Countries' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('48 locations')).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Start Asia UN Countries Quiz' }),
    ).toBeVisible();
  });
}

test('selects and starts the non-UN quiz', async ({ page }) => {
  await page.goto('/TerraDash/');
  const title = nonUnTitle;
  await page.getByRole('button', { name: title }).click();
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('84 locations')).toBeVisible();
  await expect(dialog.locator('em')).toHaveText(
    'Countries and regions listed in ISO 3166-1, UN M49, the List of Economies published by the World Bank Group, or under select categories in ISO 3166-2.',
  );
  await page.goto('/TerraDash/?quiz=non-un&start=1');
  await expect(page.locator('.active-player .quiz-name')).toHaveText(title);
});

test('colors custom geometry in the main map and magnified copy as attempts change', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
  await page.goto('/TerraDash/?quiz=non-un&start=1');
  await expect(page.locator('.callout-selected path')).not.toHaveCount(0);

  for (const selector of ['.active-fill path', '.callout-selected path']) {
    await expect
      .poll(() =>
        page
          .locator(selector)
          .evaluateAll(
            (paths) =>
              paths.length > 0 &&
              paths.every(
                (path) => getComputedStyle(path).fill === 'rgb(52, 211, 153)',
              ),
          ),
      )
      .toBe(true);
  }

  const input = page.getByRole('combobox', { name: 'Location name' });
  await input.fill('Adj');
  await page.getByRole('option', { name: 'Adjara' }).click();
  await page.getByRole('button', { name: 'Submit answer' }).click();

  for (const selector of ['.active-fill path', '.callout-selected path']) {
    await expect
      .poll(() =>
        page
          .locator(selector)
          .evaluateAll(
            (paths) =>
              paths.length > 0 &&
              paths.every(
                (path) => getComputedStyle(path).fill === 'rgb(250, 204, 21)',
              ),
          ),
      )
      .toBe(true);
  }
});

test('autocomplete only exposes locations in the active quiz', async ({
  page,
}) => {
  await page.goto('/TerraDash/?quiz=asia');
  await page.getByRole('button', { name: 'Asia UN Countries' }).click();
  await page
    .getByRole('button', { name: 'Start Asia UN Countries Quiz' })
    .click();

  const input = page.getByRole('combobox', { name: 'Location name' });
  await input.fill('Albania');
  await expect(page.getByRole('option', { name: 'Albania' })).toHaveCount(0);
  await input.fill('Afghan');
  await expect(page.getByRole('option', { name: 'Afghanistan' })).toBeVisible();
});

test('mobile Quizzes menu reaches and clicks the final quiz', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/TerraDash/');
  const mobileNav = page.getByRole('navigation', { name: 'Quizzes' });
  await mobileNav.getByRole('button', { name: /Quizzes/ }).click();
  await mobileNav.getByRole('menuitem', { name: nonUnTitle }).click();
  await expect(page).toHaveURL(/\/TerraDash\/\?quiz=non-un&select=1$/);
  await expect(page.getByRole('button', { name: /Quizzes/ })).toBeVisible();
});

test('home composition captures wide and mobile surfaces', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/TerraDash/');
  const wideBounds = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>('#start-title')!;
    const grid = document.querySelector<HTMLElement>('.quiz-options')!;
    const navigation = document.querySelector<HTMLElement>('.quiz-navigation')!;
    const menuButton = navigation.querySelector<HTMLElement>('button')!;
    return {
      heroLeft: hero.getBoundingClientRect().left,
      gridLeft: grid.getBoundingClientRect().left,
      gridWidth: grid.getBoundingClientRect().width,
      pageScrollWidth: document.documentElement.scrollWidth,
      pageClientWidth: document.documentElement.clientWidth,
      menuButtonRight: menuButton.getBoundingClientRect().right,
      navigationRight: navigation.getBoundingClientRect().right,
      disclaimerContained: (() => {
        const footer = document.querySelector<HTMLElement>('.app-footer')!;
        const disclaimer = footer.querySelector<HTMLElement>('.disclaimer')!;
        const footerBox = footer.getBoundingClientRect();
        const disclaimerBox = disclaimer.getBoundingClientRect();
        return (
          disclaimerBox.left >= footerBox.left &&
          disclaimerBox.right <= footerBox.right
        );
      })(),
      guidance: [
        ...document.querySelectorAll<HTMLElement>('.home-guidance li'),
      ].map((item) => {
        const box = item.getBoundingClientRect();
        return { left: box.left, top: box.top, width: box.width };
      }),
    };
  });
  expect(wideBounds.heroLeft).toBe(wideBounds.gridLeft);
  expect(wideBounds.gridWidth).toBeGreaterThan(900);
  expect(wideBounds.pageScrollWidth).toBeLessThanOrEqual(
    wideBounds.pageClientWidth,
  );
  expect(wideBounds.menuButtonRight).toBeLessThanOrEqual(
    wideBounds.navigationRight,
  );
  expect(wideBounds.disclaimerContained).toBe(true);
  expect(wideBounds.guidance).toHaveLength(4);
  expect(new Set(wideBounds.guidance.map(({ left }) => left)).size).toBe(1);
  expect(wideBounds.guidance.every(({ width }) => width <= 550)).toBe(true);
  await page.getByRole('button', { name: /Quizzes/ }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('home-wide-dropdown.png'),
    fullPage: true,
  });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('home-wide.png'),
    fullPage: true,
  });

  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/TerraDash/');
  await page.getByRole('button', { name: /Quizzes/ }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('home-mobile-dropdown.png'),
    fullPage: true,
  });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  const mobileBounds = await page.evaluate(() => ({
    gridWidth: document
      .querySelector<HTMLElement>('.quiz-options')!
      .getBoundingClientRect().width,
    viewport: innerWidth,
    minCardWidth: Math.min(
      ...[...document.querySelectorAll<HTMLElement>('.quiz-option')].map(
        (card) => card.getBoundingClientRect().width,
      ),
    ),
    pageScrollWidth: document.documentElement.scrollWidth,
    pageClientWidth: document.documentElement.clientWidth,
    guidance: [
      ...document.querySelectorAll<HTMLElement>('.home-guidance li'),
    ].map((item) => {
      const box = item.getBoundingClientRect();
      return { left: box.left, top: box.top };
    }),
  }));
  expect(mobileBounds.gridWidth).toBeLessThanOrEqual(mobileBounds.viewport);
  expect(mobileBounds.minCardWidth).toBeGreaterThanOrEqual(140);
  expect(mobileBounds.pageScrollWidth).toBeLessThanOrEqual(
    mobileBounds.pageClientWidth,
  );
  expect(mobileBounds.guidance).toHaveLength(4);
  expect(new Set(mobileBounds.guidance.map(({ left }) => left)).size).toBe(1);
  await page.screenshot({
    path: testInfo.outputPath('home-mobile.png'),
    fullPage: true,
  });
});
