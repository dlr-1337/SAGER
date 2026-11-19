import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { enterDemo } from './demo-session';

// Contadores de pendências (pending-badges) na demonstração: números dos dados fictícios em memória.

function apiCalls(page: Page): string[] {
  const calls: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) calls.push(request.url());
  });
  return calls;
}

/** Nome do item com o contador: o leitor de tela lê "Nome, N pendentes". */
const withCount = (name: string, count: number) =>
  new RegExp(`^${name}\\s*,\\s*${count} ${count === 1 ? 'pendente' : 'pendentes'}$`);

async function expectNoAxeViolations(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(result.violations).toEqual([]);
}

test('supervisor da demonstração vê no menu o que espera por ele, sem consultar a API', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const calls = apiCalls(page);
  await enterDemo(page, 'Supervisor');
  const menu = page.getByRole('complementary', { name: 'Navegação principal' });

  const exits = menu.getByRole('link', { name: withCount('Saídas e retornos', 3) });
  await expect(exits).toBeVisible();
  await expect(exits.locator('.pending-badge')).toHaveText('3');
  await expect(
    menu.getByRole('link', { name: withCount('Notificações de ocorrência', 2) }),
  ).toBeVisible();
  await expect(menu.getByRole('link', { name: withCount('Chamada noturna', 1) })).toBeVisible();
  // Itens sem nada à espera, ou sem regra de contagem, ficam só com o nome.
  for (const name of ['Início', 'Residentes', 'Limpeza', 'Relatórios'])
    await expect(menu.getByRole('link', { name, exact: true })).toBeVisible();
  await expectNoAxeViolations(page);

  // Cenário sem dados: nada espera ninguém.
  await page.locator('#scenario-select-desktop').selectOption('vazio');
  await expect(menu.locator('.pending-badge')).toHaveCount(0);
  await expect(menu.getByRole('link', { name: 'Saídas e retornos', exact: true })).toBeVisible();

  await page.waitForLoadState('networkidle');
  expect(calls).toEqual([]);
});

test('no celular, o botão Menu mostra a soma e mantém o nome', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const calls = apiCalls(page);
  await enterDemo(page, 'Supervisor');
  const toggle = page.getByRole('button', { name: 'Menu', exact: true });
  await expect(toggle).toBeVisible();
  await expect(toggle.locator('.pending-badge')).toHaveText('6');
  await expect(toggle).toHaveAccessibleDescription('6 pendentes no menu');
  await toggle.click();
  const drawer = page.getByRole('dialog', { name: 'SAGER' });
  await expect(drawer.getByRole('link', { name: withCount('Saídas e retornos', 3) })).toBeVisible();
  await expectNoAxeViolations(page);
  expect(calls).toEqual([]);
});

test('residente da demonstração vê as comunicações sem ciência no menu e nas abas', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const calls = apiCalls(page);
  await enterDemo(page, 'Residente');
  const menu = page.getByRole('complementary', { name: 'Navegação principal' });
  await menu.getByRole('link', { name: withCount('Avisos e advertências', 2) }).click();

  const tabs = page.getByRole('tablist', { name: 'Categorias de comunicação' });
  await expect(tabs.getByRole('tab', { name: withCount('Avisos', 1) })).toBeVisible();
  await expect(tabs.getByRole('tab', { name: withCount('Advertências', 1) })).toBeVisible();
  await expectNoAxeViolations(page);

  // Abrir o aviso não tira o número; só a ciência tira.
  await page.locator('.notice-row').first().click();
  await expect(
    menu.getByRole('link', { name: withCount('Avisos e advertências', 2) }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Marcar como ciente' }).click();
  await page.getByRole('button', { name: 'Confirmar ciência' }).click();
  await expect(
    menu.getByRole('link', { name: withCount('Avisos e advertências', 1) }),
  ).toBeVisible();
  await expect(tabs.getByRole('tab', { name: 'Avisos', exact: true })).toBeVisible();
  await expect(tabs.getByRole('tab', { name: withCount('Advertências', 1) })).toBeVisible();

  await page.waitForLoadState('networkidle');
  expect(calls).toEqual([]);
});
