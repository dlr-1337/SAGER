import { expect, type Page, test } from '@playwright/test';
import { enterDemo } from './demo-session';

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const course = { id: uuid(202), name: 'Curso Sintético', active: true, version: 0 };
const principal = {
  id: uuid(1),
  nome: 'Gestor Sintético',
  email: null,
  matricula: 'TESTE-LOGIN',
  fotoUrl: null,
  perfis: ['gestor'],
  residenteId: null,
  supervisorId: null,
};

interface Seen {
  method: string;
  path: string;
  search: string;
}

async function mockApi(page: Page) {
  const residents = Array.from({ length: 26 }, (_, index) => ({
    id: uuid(101 + index),
    // Nome sem algarismos, como o formulário exige.
    name: `Residente Sintético ${String.fromCharCode(65 + index)}`,
    enrollment: `TESTE-${index + 1}`,
    birthDate: '2009-05-14',
    course: course.name,
    courseId: course.id,
    institutionalEmail: null,
    version: 0,
  }));
  const guardians = Array.from({ length: 80 }, (_, index) => ({
    id: uuid(1001 + index),
    residentId: residents[index % residents.length].id,
    name: `Responsável Sintético ${index + 1}`,
    relationship: 'Mãe',
    phone: null,
    active: true,
    version: 0,
  }));
  const state = {
    requests: [] as Seen[],
    loggedIn: false,
    wrongPassword: false,
    expired: false,
    residents,
  };
  page.on('dialog', (dialog) => dialog.accept());
  await page.route('**/api/v1/**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    state.requests.push({ method: request.method(), path, search: url.search });
    if (path === '/auth/csrf')
      return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-synthetic' } });
    if (path === '/auth/login') {
      if (state.wrongPassword) return route.fulfill({ status: 401 });
      state.loggedIn = true;
      return route.fulfill({ status: 204 });
    }
    if (!state.loggedIn || state.expired) return route.fulfill({ status: 401 });
    if (path === '/auth/me') return route.fulfill({ json: principal });
    if (path === '/residentes') {
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? state.residents.length);
      return route.fulfill({
        headers: { 'X-Total-Count': String(state.residents.length) },
        json: state.residents.slice(offset, offset + limit),
      });
    }
    if (path.startsWith('/residentes/')) {
      const item = state.residents.find((resident) => resident.id === path.split('/')[2]);
      if (!item) return route.fulfill({ status: 404 });
      if (request.method() === 'PUT') {
        expect(request.headers()['x-csrf-token']).toBe('csrf-synthetic');
        Object.assign(item, request.postDataJSON(), { version: item.version + 1 });
      }
      return route.fulfill({ json: item });
    }
    if (path === '/responsaveis') {
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? guardians.length);
      return route.fulfill({
        headers: { 'X-Total-Count': String(guardians.length) },
        json: guardians.slice(offset, offset + limit),
      });
    }
    if (path === '/cursos') return route.fulfill({ json: [course] });
    if (path === '/quartos/mapa')
      return route.fulfill({ json: { accommodations: [], units: [], rooms: [] } });
    if (path === '/limpeza/politica')
      return route.fulfill({
        json: {
          version: 1,
          weights: { PISO: 0.25, SUPERFICIES: 0.25, RESIDUOS: 0.25, ORGANIZACAO: 0.25 },
          lowScoreThreshold: 6,
          zone: 'America/Sao_Paulo',
          now: '2026-09-30T16:00:00Z',
          currentDate: '2026-09-30',
        },
      });
    if (path === '/limpeza/indicadores')
      return route.fulfill({
        json: [
          { month: '2026-08', unjustifiedAbsences: 0, confirmedLateReturns: 2, activeWarnings: 1 },
          { month: '2026-09', unjustifiedAbsences: 3, confirmedLateReturns: 0, activeWarnings: 1 },
        ],
      });
    return route.fulfill({ json: [] });
  });
  return state;
}

async function login(page: Page) {
  await page.goto('/acesso');
  await page.getByRole('textbox', { name: 'Matrícula' }).fill('TESTE-LOGIN');
  await page.getByLabel('Senha', { exact: true }).fill('senha de teste');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

const menu = (page: Page, name: string) =>
  page.locator('.sidebar nav').getByRole('link', { name, exact: true });

function chunks(page: Page): Set<string> {
  const names = new Set<string>();
  page.on('request', (request) => {
    const name = new URL(request.url()).pathname.split('/').at(-1) ?? '';
    if (/^chunk-.*\.js$/.test(name)) names.add(name);
  });
  return names;
}

test('a conta pergunta /auth/me uma vez e as telas vêm do pré-carregamento', async ({ page }) => {
  const state = await mockApi(page);
  const requested = chunks(page);
  await login(page);
  const afterLogin = state.requests.length;
  await expect(page).toHaveURL(/\/inicio$/);
  for (const [name, path] of [
    ['Residentes', /\/residentes$/],
    ['Quartos', /\/quartos$/],
    ['Limpeza', /\/limpeza$/],
    ['Início', /\/inicio$/],
  ] as const) {
    await menu(page, name).click();
    await expect(page).toHaveURL(path);
  }
  const me = state.requests.slice(afterLogin).filter((seen) => seen.path === '/auth/me');
  expect(me).toHaveLength(1);

  await page.waitForLoadState('networkidle');
  const preloaded = new Set(requested);
  await menu(page, 'Quartos').click();
  await expect(page).toHaveURL(/\/quartos$/);
  await page.waitForLoadState('networkidle');
  expect([...requested].filter((name) => !preloaded.has(name))).toEqual([]);

  await page.goto('/relatorios/individual/' + state.residents[0].id);
  await expect(
    page.getByRole('heading', { name: 'Evolução do residente', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('table', { name: 'Números de cada mês', exact: true })).toBeVisible();
  expect([...requested].filter((name) => !preloaded.has(name)).length).toBeGreaterThan(0);
});

test('duas gravações usam o mesmo token CSRF', async ({ page }) => {
  const state = await mockApi(page);
  await login(page);
  await expect(page).toHaveURL(/\/inicio$/);
  // O login troca o token; daqui em diante as duas gravações usam um só.
  const afterLogin = state.requests.length;
  for (const resident of state.residents.slice(0, 2)) {
    await menu(page, 'Residentes').click();
    await page
      .locator('article.mg-row')
      .filter({ has: page.getByRole('heading', { name: resident.name, exact: true }) })
      .getByRole('link', { name: 'Ver cadastro' })
      .click();
    await page
      .getByRole('link', { name: /^Editar/ })
      .first()
      .click();
    const name = page.getByRole('textbox', { name: 'Nome completo *' });
    await expect(name).toHaveValue(resident.name);
    const edited = resident.name + ' Editado';
    await name.fill(edited);
    await page.getByRole('button', { name: 'Salvar residente', exact: true }).click();
    await expect(page.getByRole('heading', { name: edited, exact: true })).toBeVisible();
  }
  expect(state.requests.filter((seen) => seen.method === 'PUT')).toHaveLength(2);
  expect(
    state.requests.slice(afterLogin).filter((seen) => seen.path === '/auth/csrf'),
  ).toHaveLength(1);
});

test('sessão vencida leva ao acesso sem o menu anterior', async ({ page }) => {
  const state = await mockApi(page);
  await login(page);
  await menu(page, 'Residentes').click();
  await expect(page.getByText('1–25 de 26', { exact: true })).toBeVisible();
  state.expired = true;
  await page.getByRole('button', { name: 'Próxima', exact: true }).click();
  await expect(page).toHaveURL(/\/acesso$/);
  await expect(page.locator('.sidebar')).toHaveCount(0);
  await expect(menu(page, 'Quartos')).toHaveCount(0);
});

test('senha errada continua no acesso com a mensagem de credenciais', async ({ page }) => {
  const state = await mockApi(page);
  state.wrongPassword = true;
  await login(page);
  await expect(page.getByText(/Matrícula ou senha errada/)).toBeVisible();
  await expect(page).toHaveURL(/\/acesso$/);
});

test('a demonstração navega pelo menu sem pedir nada à API', async ({ page }) => {
  await enterDemo(page, 'Gestor');
  const api: string[] = [];
  const urls: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) api.push(request.url());
  });
  page.on('framenavigated', (frame) => urls.push(frame.url()));
  for (const [name, path] of [
    ['Residentes', /\/residentes$/],
    ['Quartos', /\/quartos$/],
    ['Início', /\/inicio$/],
  ] as const) {
    await menu(page, name).click();
    await expect(page).toHaveURL(path);
  }
  await page.waitForLoadState('networkidle');
  expect(api).toEqual([]);
  expect(urls.filter((url) => url.includes('/acesso'))).toEqual([]);
});

test('a lista de residentes vem da cópia de 60 s até uma gravação', async ({ page }) => {
  const state = await mockApi(page);
  await login(page);
  await expect(page).toHaveURL(/\/inicio$/);
  const fullLists = () =>
    state.requests.filter((seen) => seen.path === '/residentes' && seen.search === '').length;
  await menu(page, 'Responsáveis').click();
  await expect(page.getByText('1–25 de 80', { exact: true })).toBeVisible();
  for (const range of ['26–50 de 80', '51–75 de 80', '76–80 de 80']) {
    await page.getByRole('button', { name: 'Próxima', exact: true }).click();
    await expect(page.getByText(range, { exact: true })).toBeVisible();
  }
  expect(fullLists()).toBe(1);

  const resident = state.residents[0];
  await menu(page, 'Residentes').click();
  await page
    .locator('article.mg-row')
    .filter({ has: page.getByRole('heading', { name: resident.name, exact: true }) })
    .getByRole('link', { name: 'Ver cadastro' })
    .click();
  await page
    .getByRole('link', { name: /^Editar/ })
    .first()
    .click();
  const edited = resident.name + ' Editado';
  await page.getByRole('textbox', { name: 'Nome completo *' }).fill(edited);
  await page.getByRole('button', { name: 'Salvar residente', exact: true }).click();
  await expect(page.getByRole('heading', { name: edited, exact: true })).toBeVisible();
  const before = fullLists();
  await menu(page, 'Responsáveis').click();
  // A tela volta à página em que estava (76–80).
  await expect(page.getByText('76–80 de 80', { exact: true })).toBeVisible();
  await expect.poll(fullLists).toBe(before + 1);
});
