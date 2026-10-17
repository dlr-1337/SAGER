import AxeBuilder from '@axe-core/playwright';
import { BrowserContext, expect, Page, test } from '@playwright/test';

interface RoomRecord {
  id: string;
  code: string;
  number: string;
  accommodationId: string;
  unitId: string | null;
  floor: string | null;
  capacity: number | null;
  situation: string;
  occupancy: number;
  vacancies: number | null;
  cleaningScore: null;
  version: number;
}

const accommodationId = '00000000-0000-0000-0000-000000000101';
const secondAccommodationId = '00000000-0000-0000-0000-000000000102';
const unitId = '00000000-0000-0000-0000-000000000201';
const accommodations = [
  { id: accommodationId, code: 'TESTE-A1', name: 'Alojamento Fictício Um', version: 0 },
  { id: secondAccommodationId, code: 'TESTE-A2', name: 'Alojamento Fictício Dois', version: 0 },
];
const units = [
  { id: unitId, accommodationId, code: 'TESTE-U1', name: 'Casa Fictícia', version: 0 },
];
const original: RoomRecord = {
  id: '00000000-0000-0000-0000-000000000301',
  code: 'TESTE-Q01',
  number: '01',
  accommodationId,
  unitId: null,
  floor: null,
  capacity: null,
  situation: 'Disponível',
  occupancy: 0,
  vacancies: null,
  cleaningScore: null,
  version: 0,
};

async function mockSession(context: BrowserContext, profile = 'gestor'): Promise<void> {
  await context.route('**/api/v1/auth/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/me'))
      return route.fulfill({
        json: {
          id: '00000000-0000-0000-0000-000000000001',
          nome: 'Pessoa Fictícia',
          email: 'teste@example.invalid',
          matricula: 'TESTE-LOGIN',
          fotoUrl: null,
          perfis: [profile],
          residenteId: null,
          supervisorId: null,
        },
      });
    if (path.endsWith('/csrf'))
      return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-test' } });
    return route.fulfill({ status: 404 });
  });
}

async function mockRooms(context: BrowserContext, records: RoomRecord[]) {
  const writes: { method: string; csrf: string | undefined; body: Record<string, unknown> }[] = [];
  await context.route('**/api/v1/alocacoes**', (route) => route.fulfill({ json: [] }));
  await context.route('**/api/v1/residentes**', (route) => route.fulfill({ json: [] }));
  await context.route('**/api/v1/quartos**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const id = path.split('/').at(-1);
    if (request.method() === 'GET' && path.endsWith('/mapa'))
      return route.fulfill({ json: { accommodations, units, rooms: records } });
    if (request.method() === 'GET' && path.endsWith('/quartos'))
      return route.fulfill({ json: records });
    const existing = records.find((item) => item.id === id);
    if (request.method() === 'GET')
      return route.fulfill(
        existing ? { json: existing } : { status: 404, json: { code: 'not_found' } },
      );
    const body = request.postDataJSON() as Record<string, unknown>;
    writes.push({ method: request.method(), csrf: request.headers()['x-csrf-token'], body });
    if (records.some((item) => item.id !== existing?.id && item.code === body['code']))
      return route.fulfill({ status: 409, json: { code: 'duplicate_code' } });
    if (
      records.some(
        (item) =>
          item.id !== existing?.id &&
          item.number === body['number'] &&
          item.accommodationId === body['accommodationId'] &&
          item.unitId === body['unitId'] &&
          item.floor === body['floor'],
      )
    )
      return route.fulfill({ status: 409, json: { code: 'duplicate_location' } });
    if (request.method() === 'PUT') {
      if (!existing) return route.fulfill({ status: 404, json: { code: 'not_found' } });
      if (body['version'] !== existing.version)
        return route.fulfill({ status: 409, json: { code: 'stale_version' } });
      Object.assign(existing, body, {
        version: existing.version + 1,
        vacancies:
          body['capacity'] === null
            ? null
            : Math.max(0, Number(body['capacity']) - existing.occupancy),
      });
      return route.fulfill({ json: existing });
    }
    const record = {
      ...body,
      id: `00000000-0000-0000-0000-${(records.length + 310).toString().padStart(12, '0')}`,
      occupancy: 0,
      vacancies: body['capacity'] === null ? null : body['capacity'],
      cleaningScore: null,
      version: 0,
    } as RoomRecord;
    records.push(record);
    return route.fulfill({ status: 201, json: record });
  });
  return writes;
}

async function fillNewRoom(page: Page, code = 'TESTE-Q01', number = '01'): Promise<void> {
  await page.getByRole('textbox', { name: 'Código global *' }).fill(code);
  await page.getByRole('textbox', { name: 'Número do quarto *' }).fill(number);
  await page.getByRole('combobox', { name: 'Alojamento *' }).selectOption(accommodationId);
  await page.getByRole('combobox', { name: 'Situação *' }).selectOption('Disponível');
}

test('mapa corrige a página restaurada após a edição reduzir 26 quartos filtrados a 25', async ({
  page,
  context,
}) => {
  await mockSession(context);
  const records = Array.from({ length: 26 }, (_, index) => ({
    ...original,
    id: `00000000-0000-0000-0000-${String(index + 301).padStart(12, '0')}`,
    code: `TESTE-Q${String(index + 1).padStart(2, '0')}`,
    number: String(index + 1).padStart(2, '0'),
  }));
  const writes = await mockRooms(context, records);
  await page.goto('/quartos');
  const search = page.getByRole('searchbox', {
    name: 'Buscar quarto, código ou bloco',
    exact: true,
  });
  const situation = page.getByRole('combobox', { name: 'Situação', exact: true });
  await search.fill('TESTE-Q');
  await situation.selectOption('Disponível');
  await expect(page.getByText('1–25 de 26', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Próxima', exact: true }).click();
  await expect(page.getByText('26–26 de 26', { exact: true })).toBeVisible();
  await expect(page.locator('.mg-room-tile')).toHaveCount(1);
  await page.locator('.mg-room-tile').click();
  await page.getByRole('link', { name: 'Editar quarto', exact: true }).click();
  await page.getByRole('combobox', { name: 'Situação *', exact: true }).selectOption('Manutenção');
  await page.getByRole('button', { name: 'Salvar quarto', exact: true }).click();
  await expect(page.locator('.mg-success')).toContainText('Quarto salvo');
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ method: 'PUT', body: { situation: 'Manutenção', version: 0 } });
  await page.getByRole('link', { name: 'Mapa de quartos', exact: true }).click();
  await expect(page.getByText('1–25 de 25', { exact: true })).toBeVisible();
  await expect(page.locator('.mg-room-tile')).toHaveCount(25);
  await expect(
    page.getByRole('heading', { name: 'Nenhum quarto encontrado', exact: true }),
  ).toHaveCount(0);
  await expect(search).toHaveValue('TESTE-Q');
  await expect(situation).toHaveValue('Disponível');
  await expect(page.getByText('25 de 26 quartos', { exact: true })).toBeVisible();
});

test('cadastro local preserva 01, nulos, capacidade editável e mapa após recarga', async ({
  page,
  context,
}) => {
  await mockSession(context);
  const records: RoomRecord[] = [];
  const writes = await mockRooms(context, records);
  await page.goto('/quartos');
  await expect(page.getByRole('heading', { name: 'Nenhum quarto cadastrado' })).toBeVisible();
  await expect(page.locator('.mg-room-tile')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Gerenciar alojamentos' })).toBeVisible();
  await page.getByRole('link', { name: 'Cadastrar quarto' }).click();
  await fillNewRoom(page);
  await expect(page.getByRole('option', { name: 'Bloco A', exact: true })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Casa ou bloco (opcional)' }).selectOption(unitId);
  await page.getByRole('combobox', { name: 'Alojamento *' }).selectOption(secondAccommodationId);
  await expect(page.getByRole('combobox', { name: 'Casa ou bloco (opcional)' })).toHaveValue('');
  await expect(page.getByRole('option', { name: 'Casa Fictícia' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Alojamento *' }).selectOption(accommodationId);
  await page.getByRole('spinbutton', { name: 'Capacidade (opcional)' }).fill('1.5');
  await page.getByRole('button', { name: 'Salvar quarto' }).click();
  await expect(
    page.getByText('Informe um número inteiro positivo ou deixe em branco.'),
  ).toBeVisible();
  expect(writes).toHaveLength(0);
  await page.getByRole('spinbutton', { name: 'Capacidade (opcional)' }).fill('');
  await page.getByRole('button', { name: 'Salvar quarto' }).click();
  await expect(page.locator('.mg-success')).toContainText(
    'Quarto salvo no ambiente local de teste.',
  );
  await expect(page.getByRole('heading', { name: 'Quarto 01' })).toBeVisible();
  await expect(page.getByText('Capacidade não definida', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Ana Luísa Ribeiro')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Quarto 01' })).toBeVisible();
  await page.getByRole('link', { name: 'Editar quarto' }).click();
  await expect(page.getByRole('textbox', { name: 'Número do quarto *' })).toHaveValue('01');
  await page.getByRole('combobox', { name: 'Casa ou bloco (opcional)' }).selectOption(unitId);
  await page.getByRole('textbox', { name: 'Piso (opcional)' }).fill('Térreo');
  await page.getByRole('spinbutton', { name: 'Capacidade (opcional)' }).fill('6');
  await page.getByRole('button', { name: 'Salvar quarto' }).click();
  await expect(page.getByText('6 vagas', { exact: true })).toBeVisible();
  expect(writes[0]).toEqual({
    method: 'POST',
    csrf: 'csrf-test',
    body: {
      code: 'TESTE-Q01',
      number: '01',
      accommodationId,
      unitId: null,
      floor: null,
      capacity: null,
      situation: 'Disponível',
    },
  });
  expect(writes[1].body).toMatchObject({ number: '01', capacity: 6, version: 0, unitId });
  expect(records[0].version).toBe(1);
  await page.getByRole('link', { name: 'Mapa de quartos' }).click();
  await expect(page.getByRole('heading', { name: /Alojamento Fictício Um/ })).toBeVisible();
  await expect(page.getByText('Capacidade: 6 vagas', { exact: false })).toBeVisible();
  await page.getByRole('combobox', { name: 'Casa ou bloco', exact: true }).selectOption(unitId);
  await expect(page.locator('.mg-room-tile')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Situação', exact: true }).selectOption('Manutenção');
  await expect(page.getByRole('heading', { name: 'Nenhum quarto encontrado' })).toBeVisible();
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(page.locator('.mg-room-tile')).toHaveCount(1);
});

test('duplicidade e conflito em duas abas não apagam a edição nem anunciam sucesso', async ({
  page,
  context,
}) => {
  await mockSession(context);
  const records: RoomRecord[] = [structuredClone(original)];
  await mockRooms(context, records);
  await page.goto('/quartos/novo');
  await fillNewRoom(page);
  await page.getByRole('button', { name: 'Salvar quarto' }).click();
  await expect(page.getByRole('alert')).toContainText('código global');
  await page.getByRole('textbox', { name: 'Código global *' }).fill('TESTE-OUTRO');
  await page.getByRole('button', { name: 'Salvar quarto' }).click();
  await expect(page.getByRole('alert')).toContainText('mesma localização');
  await expect(page).toHaveURL(/\/quartos\/novo$/);
  await page.getByRole('combobox', { name: 'Alojamento *' }).selectOption(secondAccommodationId);
  await page.getByRole('button', { name: 'Salvar quarto' }).click();
  await expect(page.locator('.mg-success')).toContainText('Quarto salvo');

  const secondPage = await context.newPage();
  await page.goto(`/quartos/${original.id}/editar`);
  await secondPage.goto(`/quartos/${original.id}/editar`);
  await expect(secondPage.getByRole('textbox', { name: 'Número do quarto *' })).toHaveValue('01');
  await page.getByRole('spinbutton', { name: 'Capacidade (opcional)' }).fill('4');
  await page.getByRole('button', { name: 'Salvar quarto' }).click();
  await expect(page.getByText('4 vagas', { exact: true })).toBeVisible();
  await secondPage.getByRole('spinbutton', { name: 'Capacidade (opcional)' }).fill('8');
  await secondPage.getByRole('button', { name: 'Salvar quarto' }).click();
  await expect(secondPage.getByRole('alert')).toContainText('alterado por outra sessão');
  await expect(secondPage.getByRole('spinbutton', { name: 'Capacidade (opcional)' })).toHaveValue(
    '8',
  );
  await expect(secondPage).toHaveURL(/\/editar$/);
  await secondPage.getByRole('button', { name: 'Carregar versão atual do quarto' }).click();
  await expect(secondPage.getByRole('spinbutton', { name: 'Capacidade (opcional)' })).toHaveValue(
    '4',
  );
  await secondPage.getByRole('spinbutton', { name: 'Capacidade (opcional)' }).fill('6');
  await secondPage.getByRole('button', { name: 'Salvar quarto' }).click();
  await expect(secondPage.getByText('6 vagas', { exact: true })).toBeVisible();
  await secondPage.close();
});

test('mapa local oferece recuperação sem fallback e supervisor cadastra quartos', async ({
  page,
  context,
}) => {
  await mockSession(context, 'supervisor');
  let offline = true;
  await context.route('**/api/v1/quartos**', (route) =>
    offline
      ? route.abort('failed')
      : route.fulfill({ json: { accommodations, units, rooms: [original] } }),
  );
  await page.goto('/quartos');
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar os quartos');
  await expect(page.locator('.mg-room-tile')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Cadastrar quarto' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Gerenciar alojamentos' })).toBeVisible();
  offline = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.locator('.mg-room-tile')).toHaveCount(1);
  await page.goto('/quartos/novo');
  await expect(page.getByRole('heading', { name: 'Cadastrar quarto' })).toBeVisible();
});

test('mapa e formulário locais são acessíveis no desktop e no celular, com teclado', async ({
  page,
  context,
}) => {
  await mockSession(context);
  await mockRooms(context, [
    structuredClone(original),
    {
      ...original,
      id: '00000000-0000-0000-0000-000000000302',
      code: 'TESTE-Q02',
      number: '02',
      capacity: 4,
      vacancies: 4,
      unitId,
    },
  ]);
  for (const viewport of [
    { width: 1366, height: 900 },
    { width: 320, height: 740 },
  ]) {
    await page.setViewportSize(viewport);
    for (const path of ['/quartos', '/quartos/novo', `/quartos/${original.id}`]) {
      await page.goto(path);
      await expect(page.locator('main').last()).toBeVisible();
      if (path === '/quartos') await expect(page.locator('.mg-room-tile')).toHaveCount(2);
      else if (path === '/quartos/novo')
        await expect(page.getByRole('textbox', { name: 'Código global *' })).toBeVisible();
      else await expect(page.getByRole('heading', { name: 'Quarto 01' })).toBeVisible();
      const result = await new AxeBuilder({ page })
        .include('main')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        result.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? '')),
        `a11y ${path} em ${viewport.width}`,
      ).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
        `overflow ${path}`,
      ).toBeLessThanOrEqual(1);
    }
  }
  await page.goto('/quartos');
  await expect(page.getByText('soma parcial', { exact: false })).toBeVisible();
  const firstRoom = page.locator('.mg-room-tile').first();
  await firstRoom.focus();
  await expect(firstRoom).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /Quarto 0/ })).toBeVisible();
});

test('demonstração de quartos funciona e mantém seus vínculos sem backend', async ({ page }) => {
  let roomCalls = 0;
  await page.route('**/api/**', (route) => {
    if (route.request().url().includes('/quartos')) roomCalls++;
    return route.abort('failed');
  });
  await page.goto('/demonstracao');
  await page.getByRole('button', { name: /Entrar como gestor/i }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  await page.goto('/quartos/q-102');
  await expect(page.getByText('Ana Luísa Ribeiro')).toBeVisible();
  await page.getByRole('link', { name: 'Editar quarto' }).click();
  await page.getByRole('combobox', { name: 'Situação *' }).selectOption('Manutenção');
  await page.getByRole('button', { name: 'Salvar quarto' }).click();
  await expect(page.getByRole('status')).toContainText('Quarto salvo nesta demonstração.');
  await expect(page.getByText('Ana Luísa Ribeiro')).toBeVisible();
  expect(roomCalls).toBe(0);
});

test('nomes e códigos no limite cadastrado não causam rolagem horizontal no celular', async ({
  page,
  context,
}) => {
  await mockSession(context);
  const accommodation = { ...accommodations[0], name: 'A'.repeat(200) };
  const unit = { ...units[0], name: 'U'.repeat(200) };
  const room = { ...original, code: 'Q'.repeat(64), unitId, floor: 'P'.repeat(64) };
  await mockRooms(context, [room]);
  await context.route('**/api/v1/quartos/mapa', (route) =>
    route.fulfill({
      json: {
        accommodations: [accommodation],
        units: [unit],
        rooms: [room],
      },
    }),
  );
  await context.route('**/api/v1/alojamentos**', (route) =>
    route.fulfill({
      json: route.request().url().includes('/unidades') ? [unit] : accommodation,
    }),
  );
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ['/quartos', `/quartos/${room.id}`, `/alojamentos/${accommodation.id}`]) {
      await page.goto(path);
      if (path === '/quartos') await expect(page.locator('.mg-room-tile')).toHaveCount(1);
      else if (path.startsWith('/alojamentos'))
        await expect(
          page.getByRole('heading', { name: accommodation.name, exact: true }),
        ).toBeVisible();
      else
        await expect(page.getByRole('heading', { name: 'Quarto 01', exact: true })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
  }
});
