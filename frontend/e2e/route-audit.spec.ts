import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn, SYNTHETIC, type SessionRole } from './local-session';

const { residentId, guardianId, supervisorId, exitId } = SYNTHETIC;

test.beforeEach(async ({ page }) => signIn(page, 'supervisor'));

const routes: Record<SessionRole, string[]> = {
  gestor: [
    '/inicio',
    '/residentes',
    '/residentes/novo',
    `/residentes/${residentId}`,
    `/residentes/${residentId}/editar`,
    '/responsaveis',
    '/responsaveis/novo',
    `/responsaveis/${guardianId}`,
    `/responsaveis/${guardianId}/editar`,
    '/supervisores',
    '/supervisores/novo',
    `/supervisores/${supervisorId}`,
    `/supervisores/${supervisorId}/editar`,
    '/quartos',
    '/quartos/novo',
    '/relatorios',
    `/relatorios/individual/${residentId}`,
    '/ajuda',
    '/perfil',
  ],
  supervisor: [
    '/inicio',
    '/alojamentos',
    '/alojamentos/novo',
    '/residentes',
    '/residentes/novo',
    `/residentes/${residentId}`,
    `/residentes/${residentId}/editar`,
    '/responsaveis',
    '/responsaveis/novo',
    `/responsaveis/${guardianId}`,
    `/responsaveis/${guardianId}/editar`,
    '/quartos',
    '/quartos/novo',
    '/chamada',
    '/saidas',
    `/saidas/${exitId}`,
    '/notificacoes',
    '/limpeza',
    '/ranking',
    '/relatorios',
    `/relatorios/individual/${residentId}`,
    '/ajuda',
  ],
  residente: [
    '/inicio',
    '/saidas',
    '/saidas/nova',
    `/saidas/${exitId}`,
    `/saidas/${exitId}/editar`,
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
    await signIn(page, role as SessionRole);
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

test('supervisor não entra nas rotas de supervisores nem as vê no menu', async ({ page }) => {
  await page.goto('/inicio');
  await expect(page.getByRole('link', { name: 'Residentes', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Supervisores', exact: true })).toHaveCount(0);
  for (const path of [
    '/supervisores',
    '/supervisores/novo',
    `/supervisores/${supervisorId}`,
    `/supervisores/${supervisorId}/editar`,
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
      `/saidas/${exitId}`,
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
