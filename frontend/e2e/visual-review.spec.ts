import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { signIn, SYNTHETIC } from './local-session';

test('captura telas centrais para revisão visual', async ({ page }) => {
  const output = resolve(process.cwd(), '..', '.impeccable', 'reviews');
  mkdirSync(output, { recursive: true });

  await signIn(page, 'supervisor');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/inicio');
  await expect(page.getByRole('heading', { name: 'Atividades do SAGER' })).toBeVisible();
  await page.screenshot({ path: join(output, 'inicio-supervisor-desktop.png'), fullPage: true });

  await signIn(page, 'gestor');
  await page.goto('/relatorios');
  await expect(page.getByRole('heading', { name: 'Relatórios', exact: true })).toBeVisible();
  await page.screenshot({ path: join(output, 'relatorios-desktop.png'), fullPage: true });

  await page.goto('/responsaveis');
  await expect(page.getByRole('heading', { name: 'Responsáveis legais' })).toBeVisible();
  await page.screenshot({ path: join(output, 'responsaveis-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/responsaveis/${SYNTHETIC.guardianId}`);
  await page.screenshot({ path: join(output, 'responsavel-mobile.png'), fullPage: true });
  await page.goto('/relatorios');
  await page.screenshot({ path: join(output, 'relatorios-mobile-390.png'), fullPage: true });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.screenshot({ path: join(output, 'relatorios-mobile-320.png'), fullPage: true });

  await signIn(page, 'residente');
  await page.goto('/inicio');
  await expect(page.getByRole('heading', { name: 'Meu espaço' })).toBeVisible();
  await page.screenshot({ path: join(output, 'inicio-residente-320.png'), fullPage: true });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator('.sidebar')
        .evaluate((element) => Math.round(element.getBoundingClientRect().left)),
    )
    .toBe(0);
  await page.screenshot({ path: join(output, 'menu-mobile-320.png') });
});
