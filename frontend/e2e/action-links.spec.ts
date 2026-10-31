import { expect, test, type Locator } from '@playwright/test';
import { enterDemo } from './demo-session';

const underline = (link: Locator) =>
  link.evaluate((element) => getComputedStyle(element).textDecorationLine);
const color = (link: Locator) => link.evaluate((element) => getComputedStyle(element).color);

async function expectUnderlineOnlyOnHover(link: Locator): Promise<void> {
  await link.scrollIntoViewIfNeeded();
  await link.page().mouse.move(0, 0);
  expect(await underline(link)).toBe('none');
  const restColor = await color(link);

  await link.hover();
  expect(await underline(link)).toBe('underline');
  expect(await color(link)).not.toBe(restColor);
}

test('link de ação com ícone sublinha só no hover', async ({ page }) => {
  await enterDemo(page);
  await expectUnderlineOnlyOnHover(
    page.getByRole('link', { name: 'Abrir ajuda', exact: true }).first(),
  );

  await page.goto('/saidas');
  await expectUnderlineOnlyOnHover(page.locator('a.op-row-link').first());
});

test('link de texto, sem ícone, continua sublinhado em repouso', async ({ page }) => {
  await page.goto('/acesso');
  const link = page.getByRole('link', { name: 'Esqueci minha senha' });
  await expect(link).toBeVisible();
  expect(await underline(link)).toBe('underline');
});
