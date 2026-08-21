import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const quizDefinitions = JSON.parse(
  readFileSync(new URL('../data/quizzes.json', import.meta.url), 'utf8'),
);

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

for (const fixture of [
  { name: 'wide', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 667 },
]) {
  test(`home centered-content ${fixture.name} screenshot`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({
      width: fixture.width,
      height: fixture.height,
    });
    await page.goto('/TerraDash/');

    const home = page.locator('.home-page');
    await expect(home).toBeVisible();
    await expect(page.locator('.active-player')).toHaveCount(0);
    await expect(page.locator('#start-title')).toHaveText(
      'Name every place on the map',
    );
    await expect(page.locator('#start-title')).not.toContainText('.');
    await expect(page.locator('.home-graphic')).toBeVisible();
    await expect(page.locator('.home-guidance')).toBeVisible();

    const layout = await page.evaluate(() => {
      const home = document.querySelector<HTMLElement>('.home-page')!;
      const heading = document.querySelector<HTMLElement>('#start-title')!;
      const graphic = document.querySelector<HTMLElement>('.home-graphic')!;
      const guidance = document.querySelector<HTMLElement>('.home-guidance')!;
      const center = (element: Element) => {
        const rect = element.getBoundingClientRect();
        return (rect.left + rect.right) / 2;
      };
      return {
        homeCenter: center(home),
        headingCenter: center(heading),
        graphicCenter: center(graphic),
        guidanceCenter: center(guidance),
        headingAlignment: getComputedStyle(heading).textAlign,
        guidanceAlignment: getComputedStyle(guidance).textAlign,
      };
    });

    expect(Math.abs(layout.headingCenter - layout.homeCenter)).toBeLessThan(1);
    expect(Math.abs(layout.graphicCenter - layout.homeCenter)).toBeLessThan(1);
    expect(Math.abs(layout.guidanceCenter - layout.homeCenter)).toBeLessThan(1);
    expect(layout.headingAlignment).toBe('center');
    expect(layout.guidanceAlignment).toBe('left');

    await page.screenshot({
      path: testInfo.outputPath(`home-centered-${fixture.name}.png`),
      fullPage: true,
    });
  });
}

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
      .concat(nonUnTitle, 'Regional quizzes'),
  );
  await expect(menu.getByRole('menuitem', { name: 'World' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const globalQuizCount = quizDefinitions.filter(
    (quiz: { category?: string }) => !quiz.category,
  ).length;
  const regionalQuizCount = quizDefinitions.filter(
    (quiz: { category?: string }) => quiz.category === 'regional',
  ).length;
  const globalSection = page.getByRole('region', { name: 'Global quizzes' });
  const regionalSection = page.getByRole('region', {
    name: 'Regional quizzes',
  });
  await expect(globalSection.locator('.quiz-option')).toHaveCount(
    globalQuizCount,
  );
  await expect(globalSection.locator('.quiz-option-thumbnail')).toHaveCount(
    globalQuizCount,
  );
  await expect(regionalSection.locator('.quiz-option')).toHaveCount(
    regionalQuizCount,
  );
  await expect(regionalSection.locator('.quiz-option-thumbnail')).toHaveCount(
    regionalQuizCount,
  );
  await expect(globalSection.getByText('US States')).toHaveCount(0);
  await expect(regionalSection.getByText('US States')).toBeVisible();
  const globalDefinitions = quizDefinitions.filter(
    (quiz: { category?: string }) => !quiz.category,
  );
  const descriptions = globalDefinitions.map(
    (quiz: { id: string; name: string }) => {
      if (quiz.id === 'world') return 'All UN Member and UN Observer states';
      if (quiz.id === 'non-un')
        return 'Non-UN Countries and regions listed in ISO 3166-1, UN M49, the List of Economies published by the World Bank Group, or under select categories in ISO 3166-2.';
      return `UN Member and UN Observer states in ${quiz.name.replace(/ UN Countries$/, '')}`;
    },
  );
  for (const [index, description] of descriptions.entries()) {
    await expect(
      globalSection.locator('.quiz-option-description').nth(index),
    ).toHaveText(description);
  }
  const regionalDescriptions = quizDefinitions
    .filter((quiz: { category?: string }) => quiz.category)
    .map(
      (quiz: { id: string; name: string; description?: string }) =>
        quiz.description ??
        `UN Member and UN Observer states in ${quiz.name.replace(/ UN Countries$/, '')}`,
    );
  await expect(regionalSection.locator('.quiz-option-description')).toHaveText(
    regionalDescriptions,
  );
  const nonUnIndex = globalDefinitions.findIndex(
    (quiz: { id: string }) => quiz.id === 'non-un',
  );
  await expect(
    globalSection.locator('.quiz-option-description').nth(nonUnIndex),
  ).toHaveText(
    'Non-UN Countries and regions listed in ISO 3166-1, UN M49, the List of Economies published by the World Bank Group, or under select categories in ISO 3166-2.',
  );
  await expect(
    globalSection
      .locator('.quiz-option-description')
      .nth(nonUnIndex)
      .locator('em'),
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
  const asiaDialog = page.getByRole('dialog', { name: 'Asia UN Countries' });
  await expect(asiaDialog).toBeVisible();
  await expect(asiaDialog.getByText('48 locations')).toBeVisible();
  await asiaDialog
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
  await expect(dialog.getByText('82 locations')).toBeVisible();
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
  const mobileMenu = page.getByRole('menu');
  await expect(mobileMenu).toBeVisible();
  await expect(
    mobileMenu.getByRole('menuitem', { name: nonUnTitle }),
  ).toHaveText(nonUnTitle);
  const menuBounds = await mobileMenu.evaluate((element) => {
    const menuBox = element.getBoundingClientRect();
    const items = [
      ...element.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ];
    return {
      menu: { left: menuBox.left, right: menuBox.right },
      items: items.map((item) => {
        const box = item.getBoundingClientRect();
        return { left: box.left, right: box.right };
      }),
      viewport: innerWidth,
    };
  });
  expect(menuBounds.menu.left).toBeGreaterThanOrEqual(0);
  expect(menuBounds.menu.right).toBeLessThanOrEqual(menuBounds.viewport);
  expect(
    menuBounds.items.every(
      ({ left, right }) => left >= 0 && right <= menuBounds.viewport,
    ),
  ).toBe(true);
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

test('quiz cards keep a non-black surface in interactive states', async ({
  page,
}, testInfo) => {
  for (const viewport of [
    { width: 1440, height: 900, name: 'wide' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 375, height: 667, name: 'mobile' },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/TerraDash/');
    const cards = page.locator('.quiz-option');
    await expect(cards.first()).toBeVisible();

    const normalBackgrounds = await cards.evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).backgroundColor),
    );
    expect(normalBackgrounds.length).toBeGreaterThan(0);
    expect(normalBackgrounds.every((color) => color !== 'rgb(0, 0, 0)')).toBe(
      true,
    );

    await cards.first().hover();
    await cards.first().focus();
    const interactiveBackground = await cards
      .first()
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(interactiveBackground).not.toBe('rgb(0, 0, 0)');
    const thumbnailFills = await page
      .locator('.quiz-option-thumbnail svg')
      .evaluateAll((elements) =>
        elements.map((element) => getComputedStyle(element).fill),
      );
    expect(thumbnailFills.length).toBeGreaterThan(0);
    expect(thumbnailFills.every((color) => color !== 'rgb(0, 0, 0)')).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath(`quiz-cards-${viewport.name}.png`),
      fullPage: true,
    });
  }
});
