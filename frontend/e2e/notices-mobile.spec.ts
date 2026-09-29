import { expect, test } from '@playwright/test';
import { enterDemo } from './demo-session';

test.beforeEach(async ({ page }) => enterDemo(page, 'Residente'));

test('aviso abre uma vista móvel com retorno e ciência explícita', async ({ page }) => {
  await page.addInitScript(() => window.sessionStorage.setItem('sager.demo.role', 'residente'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/avisos');

  const row = page.locator('#notice-row-av-1');
  await row.click();

  const detail = page.locator('#notice-detail');
  const heading = detail.getByRole('heading', { name: 'Orientação sobre a chamada noturna' });
  await expect(page.locator('.notice-list')).toBeHidden();
  await expect(detail).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(detail.getByText('Leitura não é ciência')).toBeVisible();
  await expect(detail.getByRole('button', { name: 'Marcar como ciente' })).toBeVisible();

  const detailWidth = (await detail.boundingBox())?.width ?? 0;
  const actionWidth =
    (await detail.getByRole('button', { name: 'Marcar como ciente' }).boundingBox())?.width ?? 0;
  expect(actionWidth).toBeGreaterThan(detailWidth - 48);

  await detail.getByRole('button', { name: 'Voltar à lista' }).click();
  await expect(page.locator('.notice-list')).toBeVisible();
  await expect(detail).toBeHidden();
  await expect(row).toBeFocused();
  await expect(row).toContainText('Lido · ciência pendente');

  await row.click();
  await detail.getByRole('button', { name: 'Marcar como ciente' }).click();
  await detail.getByRole('button', { name: 'Cancelar' }).click();
  await expect(detail.getByRole('button', { name: 'Marcar como ciente' })).toBeVisible();
  await detail.getByRole('button', { name: 'Marcar como ciente' }).click();
  await detail.getByRole('button', { name: 'Confirmar ciência' }).click();
  await expect(detail.getByRole('status')).toContainText('Ciente');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('aviso conserva lista e detalhe lado a lado no desktop', async ({ page }) => {
  await page.addInitScript(() => window.sessionStorage.setItem('sager.demo.role', 'residente'));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/avisos');
  await page.locator('#notice-row-av-1').click();

  await expect(page.locator('.notice-list')).toBeVisible();
  await expect(page.locator('#notice-detail')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Voltar à lista' })).toBeHidden();
});
