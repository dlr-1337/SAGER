import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test('captura telas centrais para revisão visual', async ({ page }) => {
  const output = resolve(process.cwd(), '..', '.impeccable', 'reviews');
  mkdirSync(output, { recursive: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/inicio');
  await expect(page.getByRole('heading', { name: /Olá, supervisora/ })).toBeVisible();
  await page.screenshot({ path: join(output, 'inicio-supervisor-desktop.png'), fullPage: true });

  await page.goto('/saidas/S-1048');
  await expect(page.getByRole('heading', { name: /Solicitação S-1048/ })).toBeVisible();
  await page.screenshot({ path: join(output, 'saida-longa-desktop.png'), fullPage: true });

  await page.getByLabel('Perfil', { exact: true }).selectOption('gestor');
  await page.goto('/relatorios');
  await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();
  await page.screenshot({ path: join(output, 'relatorios-desktop.png'), fullPage: true });

  await page.goto('/responsaveis');
  await expect(page.getByRole('heading', { name: 'Responsáveis legais' })).toBeVisible();
  await page.screenshot({ path: join(output, 'responsaveis-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/responsaveis/g-1');
  await page.screenshot({ path: join(output, 'responsavel-mobile.png'), fullPage: true });
  await page.goto('/relatorios');
  await page.screenshot({ path: join(output, 'relatorios-mobile-390.png'), fullPage: true });
  await page.setViewportSize({ width: 320, height: 740 });
  await expect(page.locator('.report-mobile-list')).toBeVisible();
  await expect(page.locator('.reports-page .results-panel > .table-scroll')).toBeHidden();
  await page.locator('.report-mobile-row summary').first().click();
  await expect(page.locator('.report-mobile-row').first()).toContainText('Chamada noturna · presente');
  await expect(page.locator('.skip-link')).not.toBeFocused();
  await page.screenshot({ path: join(output, 'relatorios-mobile-320.png'), fullPage: true });
  await page.getByRole('button', { name: 'Simular exportação PDF' }).click();
  await expect(page.getByRole('dialog', { name: 'Exportação de PDF simulada' })).toBeVisible();
  await page.screenshot({ path: join(output, 'exportacao-modal-mobile-320.png') });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });

  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.locator('#profile-select-mobile').selectOption('residente');
  await page.goto('/avisos');
  await page.getByRole('button', { name: /Orientação sobre a chamada noturna/ }).click();
  await expect(page.getByRole('heading', { name: 'Orientação sobre a chamada noturna' })).toBeFocused();
  await page.screenshot({ path: join(output, 'avisos-residente-mobile.png'), fullPage: true });

  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/inicio');
  await page.screenshot({ path: join(output, 'inicio-residente-320.png'), fullPage: true });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect.poll(() => page.locator('.sidebar').evaluate(element => Math.round(element.getBoundingClientRect().left))).toBe(0);
  await page.screenshot({ path: join(output, 'menu-mobile-320.png') });
});
