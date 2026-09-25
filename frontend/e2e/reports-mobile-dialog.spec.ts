import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('filtros e resultados ficam legíveis a 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/relatorios');

  await expect(page.getByRole('button', { name: 'Mais filtros' })).toBeVisible();
  await expect(page.getByLabel('Data inicial')).toBeHidden();
  await page.getByLabel('Tipo de relatório').selectOption('saidas');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByRole('button', { name: /Remover filtro Relatório: Saídas e retornos/ })).toBeVisible();
  await expect(page.locator('.filter-count')).toHaveText('3 registros na seleção');
  await page.getByRole('button', { name: 'Mais filtros' }).click();
  await expect(page.getByLabel('Data inicial')).toBeVisible();

  const firstCard = page.locator('.report-mobile-row').first();
  await expect(firstCard.getByText('Ver detalhes')).toBeVisible();
  await firstCard.locator('summary').click();
  await expect(firstCard.getByText('Ocultar detalhes')).toBeVisible();
  await page.getByLabel('Data inicial').fill('2026-09-30');
  await page.getByLabel('Data final').fill('2026-09-01');
  await page.getByRole('button', { name: 'Mais filtros' }).click();
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByLabel('Data inicial')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('A data inicial não pode ser posterior');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
});

test('diálogo de exportação contém o foco, bloqueia o fundo e restaura o botão', async ({ page }) => {
  await page.goto('/relatorios');
  const trigger = page.getByRole('button', { name: 'Simular exportação PDF' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Exportação de PDF simulada' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Entendi' })).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('dialog') !== null)).toBe(true);
  await page.keyboard.press('Shift+Tab');
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('dialog') !== null)).toBe(true);
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(audit.violations.filter(item => ['critical', 'serious'].includes(item.impact ?? ''))).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');

  await page.getByRole('button', { name: 'Simular exportação Excel' }).click();
  await page.getByRole('dialog', { name: 'Exportação de Excel simulada' }).getByRole('button', { name: 'Entendi' }).click();
  await expect(page.getByRole('button', { name: 'Simular exportação Excel' })).toBeFocused();
});
