import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { enterDemo } from './demo-session';

test.beforeEach(async ({ page }) => enterDemo(page));

const routes = {
  gestor: [
    '/inicio',
    '/residentes',
    '/residentes/novo',
    '/residentes/r-ana',
    '/residentes/r-ana/editar',
    '/responsaveis',
    '/responsaveis/novo',
    '/responsaveis/g-1',
    '/responsaveis/g-1/editar',
    '/supervisores',
    '/supervisores/novo',
    '/supervisores/s-1',
    '/supervisores/s-1/editar',
    '/quartos',
    '/quartos/novo',
    '/quartos/q-102',
    '/quartos/q-102/editar',
    '/relatorios',
    '/relatorios/individual/ana',
    '/ajuda',
    '/perfil',
  ],
  supervisor: [
    '/inicio',
    '/alojamentos',
    '/alojamentos/novo',
    '/residentes',
    '/residentes/novo',
    '/residentes/r-ana',
    '/residentes/r-ana/editar',
    '/responsaveis',
    '/responsaveis/novo',
    '/responsaveis/g-1',
    '/responsaveis/g-1/editar',
    '/supervisores',
    '/supervisores/novo',
    '/supervisores/s-1',
    '/supervisores/s-1/editar',
    '/quartos',
    '/quartos/novo',
    '/quartos/q-102',
    '/quartos/q-102/editar',
    '/chamada',
    '/saidas',
    '/saidas/S-1048',
    '/notificacoes',
    '/notificacoes/N-201',
    '/limpeza',
    '/ranking',
    '/relatorios',
    '/relatorios/individual/ana',
    '/ajuda',
  ],
  residente: [
    '/inicio',
    '/saidas',
    '/saidas/nova',
    '/saidas/S-1048',
    '/saidas/S-1048/editar',
    '/avisos',
    '/ranking',
    '/perfil',
    '/ajuda',
  ],
};

test('rotas dos três perfis renderizam sem erro e sem violações axe', async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  const violations: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  for (const [role, paths] of Object.entries(routes)) {
    await enterDemo(
      page,
      role === 'gestor' ? 'Gestor' : role === 'supervisor' ? 'Supervisor' : 'Residente',
    );
    for (const path of paths) {
      await page.goto(path);
      await expect(page.locator('main h1').first(), `${role} ${path}`).toBeVisible();
      const heading = await page.locator('main h1').first().innerText();
      expect(heading, `${role} ${path}`).not.toMatch(
        /acesso não disponível|página não encontrada/i,
      );
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      for (const item of result.violations)
        violations.push(`${role} ${path}: ${item.id} (${item.impact}, ${item.nodes.length})`);
    }
  }
  expect(pageErrors).toEqual([]);
  expect(violations).toEqual([]);
});

test('largura de 320 px e equivalência a zoom de 200% em telas principais', async ({ page }) => {
  test.setTimeout(60_000);
  for (const width of [320, 640]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/inicio');
    for (const path of [
      '/inicio',
      '/saidas',
      '/saidas/S-1048',
      '/chamada',
      '/notificacoes',
      '/limpeza',
      '/relatorios',
    ]) {
      await page.goto(path);
      await expect(page.locator('main h1').first()).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `${path} em ${width}px`).toBeLessThanOrEqual(1);
    }
  }
});
