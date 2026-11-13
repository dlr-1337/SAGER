import { expect, type Locator, type Page, test } from '@playwright/test';
import type { ShortExit } from '../src/app/features/operations/operations-local.models';

const uuid = (number: number) => `00000000-0000-0000-0000-${String(number).padStart(12, '0')}`;
const now = '2026-09-30T16:00:00Z';

test.use({ viewport: { width: 1920, height: 855 } });

const scrollY = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(window.scrollY))),
      ),
  );

// Rola até as abas, ou até onde a página deixar: é daí que o navegador corta a rolagem.
async function scrollToTabs(page: Page, tabs: Locator): Promise<number> {
  await tabs.evaluate((element) =>
    window.scrollTo({
      top: element.getBoundingClientRect().top + window.scrollY,
      behavior: 'instant',
    }),
  );
  const position = await scrollY(page);
  expect(position).toBeGreaterThan(0);
  return position;
}

async function expectTabKeepsPosition(page: Page, tab: Locator, position: number): Promise<void> {
  await tab.click();
  expect(await scrollY(page)).toBe(position);
  await expect(tab).toBeFocused();
}

function mockSession(page: Page, profile: 'gestor' | 'supervisor' | 'residente') {
  return page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/auth/me')
      return route.fulfill({
        json: {
          id: uuid(1),
          nome: 'Conta Sintética',
          email: 'conta@example.invalid',
          matricula: 'TESTE-LOGIN',
          fotoUrl: null,
          perfis: [profile],
          residenteId: profile === 'residente' ? uuid(41) : null,
          supervisorId: profile === 'supervisor' ? uuid(101) : null,
        },
      });
    if (path === '/api/v1/auth/csrf')
      return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-synthetic' } });
    return route.fulfill({ status: 404 });
  });
}

// Mantém a resposta presa para o teste medir a página enquanto a lista carrega.
function heldResponse(): { wait: Promise<void>; release: () => void } {
  let release = () => {};
  const wait = new Promise<void>((resolve) => (release = resolve));
  return { wait, release };
}

test('residente do ambiente local mantém a posição em cada aba', async ({ page }) => {
  await mockSession(page, 'gestor');
  await page.route('**/api/v1/residentes/**', (route) =>
    route.fulfill({
      json: {
        id: uuid(41),
        name: 'Estudante Sintético',
        enrollment: 'TESTE-001',
        birthDate: '2010-05-14',
        course: null,
        version: 0,
      },
    }),
  );
  await page.route('**/api/v1/alocacoes**', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/responsaveis**', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/quartos/mapa', (route) =>
    route.fulfill({ json: { accommodations: [], units: [], rooms: [] } }),
  );
  await page.goto(`/residentes/${uuid(41)}`);
  await expect(page.getByRole('heading', { name: 'Identificação' })).toBeVisible();
  await expect(page.getByText('Nenhum quarto ativo vinculado')).toBeVisible();
  const tabs = page.getByRole('navigation', { name: 'Seções do residente' });
  const position = await scrollToTabs(page, tabs);

  for (const name of ['Histórico', 'Termos', 'Responsáveis', 'Dados'])
    await expectTabKeepsPosition(page, tabs.getByRole('button', { name }), position);
});

test('comunicações próprias mantêm a posição enquanto a aba carrega', async ({ page }) => {
  await mockSession(page, 'residente');
  const items = Array.from({ length: 12 }, (_, index) => ({
    id: uuid(600 + index),
    kind: 'AVISO',
    sourceId: uuid(800 + index),
    contentVersion: 1,
    title: `Aviso sintético ${index + 1}`,
    body: 'Conteúdo sintético.',
    publishedAt: now,
    status: 'PUBLICADO',
    stateReason: null,
    requiresReview: false,
    readAt: null,
    acknowledgedAt: null,
    document: null,
  }));
  const warnings = heldResponse();
  await page.route('**/api/v1/me/avisos**', (route) =>
    route.fulfill({ json: { items, nextCursor: null } }),
  );
  await page.route('**/api/v1/me/advertencias**', async (route) => {
    await warnings.wait;
    await route.fulfill({ json: { items: [], nextCursor: null } });
  });
  await page.goto('/avisos');
  await expect(page.getByRole('heading', { name: 'Aviso sintético 12' })).toBeVisible();
  const tabs = page.getByRole('navigation', { name: 'Tipo de comunicação' });
  const position = await scrollToTabs(page, tabs);
  const top = (await tabs.boundingBox())?.y;

  await expectTabKeepsPosition(page, tabs.getByRole('button', { name: 'Advertências' }), position);
  await expect(page.getByRole('heading', { name: 'Carregando registros' })).toBeVisible();
  expect(await scrollY(page)).toBe(position);
  expect((await tabs.boundingBox())?.y).toBe(top);

  warnings.release();
  await expect(page.getByRole('heading', { name: 'Nenhuma comunicação disponível' })).toBeVisible();
  expect(await scrollY(page)).toBe(position);
  expect((await tabs.boundingBox())?.y).toBe(top);
});

test('saídas mantêm a posição enquanto a lista carrega e o filtro só muda a consulta', async ({
  page,
}) => {
  // Com menos altura, os filtros já sustentam a rolagem e o corte não aparece.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await mockSession(page, 'residente');
  const exits = Array.from({ length: 12 }, (_, index): Partial<ShortExit> => ({
    id: uuid(800 + index),
    residentId: uuid(41),
    residentName: `Estudante Sintético ${index + 1}`,
    enrollment: `TESTE-${index + 1}`,
    departureMode: 'NOW',
    requestedDepartureAt: now,
    expectedReturnAt: '2026-09-30T19:00:00Z',
    reason: 'Buscar material escolar',
    status: 'AGUARDANDO_ANALISE',
    zone: 'America/Sao_Paulo',
    now,
    version: 0,
    capabilities: {
      canEdit: false,
      canDecide: false,
      canCancel: true,
      canDepart: false,
      canReturn: false,
    },
    history: [],
  }));
  const longExits = heldResponse();
  await page.route('**/api/v1/quartos/mapa', (route) =>
    route.fulfill({ json: { accommodations: [], units: [], rooms: [] } }),
  );
  await page.route('**/api/v1/saidas-curtas?*', (route) => route.fulfill({ json: exits }));
  await page.route('**/api/v1/saidas-longas?*', async (route) => {
    await longExits.wait;
    await route.fulfill({ json: [] });
  });
  await page.goto('/saidas');
  await expect(page.getByRole('heading', { name: 'Estudante Sintético 12' })).toBeVisible();
  const tabs = page.getByRole('navigation', { name: 'Tipo de saída' });
  const position = await scrollToTabs(page, tabs);

  await expectTabKeepsPosition(page, tabs.getByRole('link', { name: 'Longas' }), position);
  await expect(page).toHaveURL(/\/saidas\?tipo=longa$/);
  await expect(page.getByRole('heading', { name: 'Carregando pedidos' })).toBeVisible();
  expect(await scrollY(page)).toBe(position);

  longExits.release();
  await expect(page.getByRole('heading', { name: 'Nenhum pedido ainda.' })).toBeVisible();
  expect(await scrollY(page)).toBe(position);

  await expectTabKeepsPosition(page, tabs.getByRole('link', { name: 'Curtas' }), position);
  await expect(page.getByRole('heading', { name: 'Estudante Sintético 12' })).toBeVisible();
  expect(await scrollY(page)).toBe(position);
});

test('abrir um registro de uma lista rolada começa no topo', async ({ page }) => {
  await mockSession(page, 'gestor');
  const residents = Array.from({ length: 30 }, (_, index) => ({
    id: uuid(41 + index),
    name: `Estudante Sintético ${index + 1}`,
    enrollment: `TESTE-${String(index + 1).padStart(3, '0')}`,
    birthDate: '2010-05-14',
    course: null,
    version: 0,
  }));
  await page.route('**/api/v1/residentes**', (route) => {
    const url = new URL(route.request().url());
    const id = url.pathname.split('/').at(-1);
    if (id !== 'residentes')
      return route.fulfill({ json: residents.find((item) => item.id === id) });
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? 25);
    return route.fulfill({
      headers: { 'X-Total-Count': String(residents.length) },
      json: residents.slice(offset, offset + limit),
    });
  });
  await page.route('**/api/v1/alocacoes**', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/responsaveis**', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/cursos**', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/quartos/mapa', (route) =>
    route.fulfill({ json: { accommodations: [], units: [], rooms: [] } }),
  );
  await page.goto('/residentes');
  const link = page.locator('a.mg-row-link').last();
  await link.scrollIntoViewIfNeeded();
  await page.evaluate(() =>
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
  );
  const position = await scrollY(page);
  expect(position).toBeGreaterThan(0);

  await link.click();
  await expect(page.getByRole('heading', { name: 'Identificação' })).toBeVisible();
  expect(await scrollY(page)).toBe(0);

  await page.goBack();
  await expect(link).toBeVisible();
  // A lista volta da API depois do popstate: o navegador restaura até onde a página deixa,
  // e o app não a leva ao topo.
  expect(await scrollY(page)).toBeGreaterThan(0);
});
