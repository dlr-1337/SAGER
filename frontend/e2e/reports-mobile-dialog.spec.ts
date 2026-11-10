import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { enterDemo } from './demo-session';

test.beforeEach(async ({ page }) => enterDemo(page, 'Gestor'));

async function seriousViolations(page: import('@playwright/test').Page) {
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return audit.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? ''));
}

test('a 320 px gera, acompanha e informa que a demonstração não baixa arquivo', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/relatorios');

  await expect(page.getByLabel('Data inicial')).toBeHidden();
  await expect(page.getByRole('combobox', { name: 'Residente', exact: true })).toBeHidden();
  await page.getByRole('radio', { name: /Saídas e retornos/ }).check();
  const generate = page.getByRole('button', { name: 'Gerar relatório', exact: true });
  await expect(generate).toBeVisible();
  const box = await generate.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(48);
  await generate.click();

  const title = page.getByRole('heading', { name: 'Saídas e retornos', exact: true });
  await expect(title).toBeFocused();
  await expect(page.getByRole('status').filter({ hasText: 'Montando os arquivos' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Baixar PDF', exact: true })).toBeVisible({
    timeout: 8000,
  });
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Baixar planilha Excel', exact: true }).click();
  await expect(page.getByText('Na demonstração nenhum arquivo é baixado.')).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
});

test('sem registros orienta o usuário e os filtros ativos podem ser removidos', async ({
  page,
}) => {
  await page.goto('/relatorios');
  await page.getByRole('radio', { name: 'Mês passado', exact: true }).check();
  await page.getByRole('button', { name: 'Gerar relatório', exact: true }).click();
  await expect(
    page.getByText('Não encontramos registros nesse período. Tente outro período.'),
  ).toBeVisible();
  await expect(page.locator('sager-report-card')).toHaveCount(0);

  await page.getByText('Filtrar por alojamento', { exact: false }).click();
  await page.getByRole('combobox', { name: 'Situação', exact: true }).selectOption('PRESENTE');
  const chip = page.getByRole('button', { name: 'Remover filtro Presente', exact: true });
  await expect(chip).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await chip.click();
  await expect(chip).toHaveCount(0);
});

test('o cenário de erro da demonstração oferece nova tentativa', async ({ page }) => {
  await page.goto('/relatorios');
  await expect(page.getByRole('button', { name: 'Gerar relatório', exact: true })).toBeVisible();
  await page.locator('#scenario-select-desktop').selectOption('erro');
  await expect(page.getByRole('heading', { name: 'Registros indisponíveis' })).toBeVisible();
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Gerar relatório', exact: true })).toBeVisible();
});
