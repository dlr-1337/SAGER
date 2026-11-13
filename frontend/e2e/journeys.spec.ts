import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './local-session';

test.beforeEach(async ({ page }) => signIn(page, 'supervisor'));

test('endereço antigo de convite mostra página não encontrada', async ({ page }) => {
  await page.goto('/assinatura/S-1048');
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible();
});

test('telas no celular de 320 px sem rolagem horizontal da página', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await signIn(page, 'residente');
  for (const path of ['/inicio', '/saidas', '/saidas/nova', '/avisos', '/ranking']) {
    await page.goto(path);
    await expect(page.locator('main').last()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `overflow em ${path}`).toBeLessThanOrEqual(1);
  }
});

test('acesso, painel e avisos sem violações axe graves', async ({ page }) => {
  await page.goto('/acesso');
  let result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    result.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? '')),
  ).toEqual([]);
  await signIn(page, 'residente');
  await page.goto('/inicio');
  await expect(page.locator('main h1').first()).toBeVisible();
  result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    result.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? '')),
  ).toEqual([]);
  await page.goto('/avisos');
  result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    result.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? '')),
  ).toEqual([]);
});

test('foco por teclado usa anel duplo: amarelo por fora e verde-escuro por dentro', async ({
  page,
}) => {
  await page.goto('/residentes');
  await page.keyboard.press('Tab');
  // O atalho não anima box-shadow; um .btn teria transição e leitura instável do estilo.
  await expect(page.locator('.skip-link')).toBeFocused();
  const ring = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement as Element);
    return { outline: style.outlineColor, shadow: style.boxShadow };
  });
  // O amarelo sozinho fica abaixo de 3:1 sobre fundos claros; o anel interno garante o contraste.
  expect(ring.outline).toBe('rgb(244, 186, 53)');
  expect(ring.shadow).toContain('rgb(7, 59, 45)');
});

test('atalho de conteúdo e menu móvel funcionam pelo teclado', async ({ page }) => {
  await page.goto('/inicio');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#conteudo-principal')).toBeFocused();
  await expect(page).toHaveURL(/\/inicio$/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Menu', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});
