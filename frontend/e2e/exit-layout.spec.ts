import { expect, test } from '@playwright/test';
import { enterDemo } from './demo-session';

test.beforeEach(async ({ page }) => enterDemo(page));

test('detalhe de saída mantém próxima etapa visível e reordena sem rolagem horizontal', async ({
  page,
}) => {
  for (const width of [1440, 800, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/saidas/S-1048');

    await expect(page.getByRole('heading', { name: 'Solicitação S-1048' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dados da solicitação' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Linha do tempo' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Autorização pendente' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ações do supervisor' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aprovar' })).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Registrar providência e reenviar' }),
    ).toHaveCount(0);

    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(width + 1);

    const overview = await page.locator('.op-exit-overview').boundingBox();
    const timeline = await page.locator('.op-exit-timeline').boundingBox();
    const nextStep = await page.locator('.op-exit-side').boundingBox();
    expect(overview && timeline && nextStep).toBeTruthy();
    if (!overview || !timeline || !nextStep) continue;

    if (width === 1440) {
      expect(overview.x).toBeLessThan(timeline.x);
      expect(timeline.x).toBeLessThan(nextStep.x);
      await expect(page.getByRole('heading', { name: 'Autorização pendente' })).toBeInViewport();
    } else if (width === 800) {
      expect(overview.x).toBeLessThan(timeline.x);
      expect(nextStep.y).toBeGreaterThan(overview.y);
    } else {
      expect(overview.y).toBeLessThan(timeline.y);
      expect(timeline.y).toBeLessThan(nextStep.y);
    }
  }
});

test('reenvio só é oferecido após falha demonstrativa', async ({ page }) => {
  await page.goto('/saidas/S-1046');
  await expect(page.getByText('O envio simulado falhou.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Registrar providência e reenviar' }),
  ).toBeVisible();
});
