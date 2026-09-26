import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { enterDemo } from './demo-session';

test.beforeEach(async ({ page }) => enterDemo(page));

test('menu móvel contém foco, bloqueia o fundo e mantém a marca no drawer', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/inicio');

  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  const drawer = page.locator('#app-navigation');
  await expect(page.locator('.brand-organization img')).toBeHidden();
  await expect(drawer).toHaveAttribute('inert', '');
  await expect(drawer).toHaveAttribute('aria-hidden', 'true');
  expect((await page.locator('.masthead').boundingBox())?.height).toBeLessThanOrEqual(90);

  await menu.click();
  await expect(drawer).toHaveAttribute('role', 'dialog');
  await expect(drawer).toHaveAttribute('aria-modal', 'true');
  await expect(drawer.locator('img[alt*="Instituto Federal Goiano"]')).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Fechar menu' })).toBeFocused();
  await expect(page.locator('.work-area')).toHaveAttribute('inert', '');
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await expect(page.locator('#profile-select-mobile')).toBeVisible();

  for (let index = 0; index < 12; index++) {
    await page.keyboard.press(index === 0 ? 'Shift+Tab' : 'Tab');
    const focusInside = await page.evaluate(() =>
      document.getElementById('app-navigation')?.contains(document.activeElement),
    );
    expect(focusInside, `foco fora do menu no passo ${index}`).toBe(true);
  }

  const scrollWhileOpen = await page.evaluate(() => window.scrollY);
  await page.mouse.move(310, 400);
  await page.mouse.wheel(0, 550);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollWhileOpen);

  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    axe.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? '')),
  ).toEqual([]);

  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(drawer).toHaveAttribute('inert', '');
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await page.keyboard.press('Tab');
  expect(
    await page.evaluate(() =>
      document.getElementById('app-navigation')?.contains(document.activeElement),
    ),
  ).toBe(false);

  await menu.click();
  await page.locator('.nav-scrim').click({ position: { x: 311, y: 400 }, force: true });
  await expect(menu).toBeFocused();
});

test('menu fecha ao navegar e ao voltar ao desktop', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/inicio');
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  await menu.click();
  await page.locator('#app-navigation').getByRole('link', { name: 'Saídas e retornos' }).click();
  await expect(page).toHaveURL(/\/saidas$/);
  await expect(page.locator('#conteudo-principal')).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');

  await menu.click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('#app-navigation')).not.toHaveAttribute('role', 'dialog');
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await expect(page.locator('.brand-organization img')).toBeVisible();
});
