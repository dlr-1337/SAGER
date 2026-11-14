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

test('guias da ajuda na demonstração não levam ao acesso negado', async ({ page }) => {
  for (const profile of ['Gestor', 'Supervisor', 'Residente'] as const) {
    await enterDemo(page, profile);
    await page.goto('/ajuda');
    const guides = page.locator('.guide-grid a');
    await expect(guides.first()).toBeVisible();
    const count = await guides.count();
    for (let index = 0; index < count; index++) {
      await page.goto('/ajuda');
      const guide = guides.nth(index);
      const href = await guide.getAttribute('href');
      await guide.click();
      await expect(page, `${profile} ${href}`).toHaveURL(new RegExp(`${href}$`));
      await expect(page.locator('main h1').first(), `${profile} ${href}`).not.toHaveText(
        /acesso não disponível|página não encontrada/i,
      );
      await expect(page.getByText('Esta tela não faz parte da demonstração')).toHaveCount(0);
    }
  }
});

test('supervisor não entra nas rotas de supervisores nem as vê no menu', async ({ page }) => {
  await enterDemo(page, 'Supervisor');
  await expect(page.getByRole('link', { name: 'Residentes', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Supervisores', exact: true })).toHaveCount(0);
  for (const path of [
    '/supervisores',
    '/supervisores/novo',
    '/supervisores/s-1',
    '/supervisores/s-1/editar',
  ]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/acesso-negado$/);
  }
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
