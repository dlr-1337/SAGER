import AxeBuilder from '@axe-core/playwright';
import { BrowserContext, expect, test } from '@playwright/test';

const residentId = '00000000-0000-0000-0000-000000000041';
const firstRoomId = '00000000-0000-0000-0000-000000000301';
const secondRoomId = '00000000-0000-0000-0000-000000000302';
const resident = {
  id: residentId,
  name: 'Estudante Sintético',
  enrollment: 'TESTE-01',
  birthDate: null,
  course: null,
  version: 0,
};
const accommodation = { id: 'a1', code: 'A1', name: 'Alojamento Sintético', version: 0 };
type Allocation = {
  id: string;
  residentId: string;
  roomId: string;
  startedAt: string;
  endedAt: string | null;
  endReason: 'TRANSFER' | 'END' | null;
  version: number;
};

async function mockLocal(context: BrowserContext, role: 'gestor' | 'supervisor' = 'gestor') {
  const allocations: Allocation[] = [];
  const writes: { path: string; csrf: string | undefined; body: Record<string, unknown> }[] = [];
  const rooms = [firstRoomId, secondRoomId].map((id, index) => ({
    id,
    code: `TESTE-Q0${index + 1}`,
    number: `0${index + 1}`,
    accommodationId: accommodation.id,
    unitId: null,
    floor: null,
    capacity: 1,
    situation: 'Disponível',
    cleaningScore: null,
    version: 0,
    get occupancy() {
      return allocations.filter((item) => item.roomId === id && item.endedAt === null).length;
    },
    get vacancies() {
      return Math.max(0, 1 - this.occupancy);
    },
  }));
  await context.route('**/api/v1/auth/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/me'))
      return route.fulfill({
        json: {
          id: 'user-1',
          nome: 'Gestor Sintético',
          email: 'teste@example.invalid',
          matricula: 'TESTE-LOGIN',
          fotoUrl: null,
          perfis: [role],
          residenteId: null,
          supervisorId: null,
        },
      });
    if (path.endsWith('/csrf'))
      return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-test' } });
    return route.fulfill({ status: 404 });
  });
  await context.route('**/api/v1/residentes**', (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path.endsWith('/residentes') ? [resident] : resident });
  });
  await context.route('**/api/v1/responsaveis**', (route) => route.fulfill({ json: [] }));
  await context.route('**/api/v1/quartos**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/mapa'))
      return route.fulfill({ json: { accommodations: [accommodation], units: [], rooms } });
    if (path.endsWith('/quartos')) return route.fulfill({ json: rooms });
    return route.fulfill({ json: rooms.find((room) => room.id === path.split('/').at(-1)) });
  });
  await context.route('**/api/v1/alocacoes**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET') {
      const resident = url.searchParams.get('residentId');
      const room = url.searchParams.get('roomId');
      const active = url.searchParams.get('active') === 'true';
      return route.fulfill({
        json: allocations.filter(
          (item) =>
            (!resident || item.residentId === resident) &&
            (!room || item.roomId === room) &&
            (!active || item.endedAt === null),
        ),
      });
    }
    const body = request.postDataJSON() as Record<string, unknown>;
    writes.push({ path: url.pathname, csrf: request.headers()['x-csrf-token'], body });
    if (url.pathname.endsWith('/transferir') || url.pathname.endsWith('/encerrar')) {
      const current = allocations.find((item) => item.id === url.pathname.split('/').at(-2));
      if (!current) return route.fulfill({ status: 404, json: { code: 'not_found' } });
      if (body['version'] !== current.version)
        return route.fulfill({ status: 409, json: { code: 'stale_version' } });
      current.endedAt = '2026-09-29T14:00:00Z';
      current.endReason = url.pathname.endsWith('/transferir') ? 'TRANSFER' : 'END';
      current.version++;
      if (current.endReason === 'END') return route.fulfill({ json: current });
    }
    const allocation: Allocation = {
      id: `allocation-${allocations.length + 1}`,
      residentId,
      roomId: body['roomId'] as string,
      startedAt: '2026-09-29T14:00:00Z',
      endedAt: null,
      endReason: null,
      version: 0,
    };
    allocations.unshift(allocation);
    return route.fulfill({ status: 201, json: allocation });
  });
  return { allocations, writes };
}

test('gestor aloca, transfere e encerra com histórico persistido na interface', async ({
  page,
  context,
}) => {
  const state = await mockLocal(context);
  await page.goto(`/residentes/${residentId}`);
  await expect(page.getByText('Nenhum quarto ativo vinculado')).toBeVisible();
  await page.getByRole('combobox', { name: 'Colocar no quarto' }).selectOption(firstRoomId);
  await page.getByRole('button', { name: 'Colocar no quarto' }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  await expect.poll(() => state.allocations.length).toBe(1);
  await expect(page.getByRole('link', { name: /Quarto 01/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tirar do quarto' })).toBeEnabled();
  await page.screenshot({ path: test.info().outputPath('allocation-desktop.png'), fullPage: true });
  expect(state.writes[0]).toMatchObject({
    path: '/api/v1/alocacoes',
    csrf: 'csrf-test',
    body: { residentId, roomId: firstRoomId },
  });
  await page.reload();
  await expect(page.getByRole('link', { name: /Quarto 01/ })).toBeVisible();
  await page.getByRole('combobox', { name: 'Mudar para' }).selectOption(secondRoomId);
  await page.getByRole('button', { name: 'Mudar de quarto' }).click();
  await expect(page.getByRole('link', { name: /Quarto 02/ })).toBeVisible();
  expect(state.writes[1].body).toMatchObject({ roomId: secondRoomId, version: 0 });
  await page.getByRole('button', { name: 'Tirar do quarto' }).click();
  await expect(page.getByText('A vaga fica livre')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar saída do quarto' }).click();
  await expect(page.getByText('Nenhum quarto ativo vinculado')).toBeVisible();
  await page.getByRole('button', { name: 'Histórico' }).click();
  await expect(page.getByRole('heading', { name: 'Histórico de quartos' })).toBeVisible();
  await expect(page.locator('.mg-timeline li')).toHaveCount(2);
  await page.goto('/quartos');
  await expect(page.getByText('0 moradores', { exact: false }).first()).toBeVisible();
});

test('supervisor em celular transfere alocação; navegação é acessível', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await mockLocal(context, 'supervisor');
  state.allocations.push({
    id: 'allocation-1',
    residentId,
    roomId: firstRoomId,
    startedAt: '2026-09-29T12:00:00Z',
    endedAt: null,
    endReason: null,
    version: 0,
  });
  await page.goto(`/residentes/${residentId}`);
  await expect(page.getByRole('link', { name: /Quarto 01/ })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('allocation-mobile.png'), fullPage: true });
  await page.getByRole('combobox', { name: 'Mudar para' }).selectOption(secondRoomId);
  await page.getByRole('button', { name: 'Mudar de quarto' }).click();
  await expect(page.getByRole('link', { name: /Quarto 02/ })).toBeVisible();
  expect(state.writes[0].body).toMatchObject({ roomId: secondRoomId, version: 0 });
  await page.keyboard.press('Tab');
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});

test('duas abas exibem conflito de versão e recarregam o vínculo atual', async ({
  page,
  context,
}) => {
  const state = await mockLocal(context);
  state.allocations.push({
    id: 'allocation-1',
    residentId,
    roomId: firstRoomId,
    startedAt: '2026-09-29T12:00:00Z',
    endedAt: null,
    endReason: null,
    version: 0,
  });
  await page.goto(`/residentes/${residentId}`);
  const second = await context.newPage();
  await second.goto(`/residentes/${residentId}`);
  await page.getByRole('combobox', { name: 'Mudar para' }).selectOption(secondRoomId);
  await second.getByRole('combobox', { name: 'Mudar para' }).selectOption(secondRoomId);
  await page.getByRole('button', { name: 'Mudar de quarto' }).click();
  await expect(page.getByRole('link', { name: /Quarto 02/ })).toBeVisible();
  await second.getByRole('button', { name: 'Mudar de quarto' }).click();
  await expect(second.getByRole('alert')).toContainText('Outra pessoa alterou');
  await expect(second.getByRole('link', { name: /Quarto 02/ })).toBeVisible();
  await second.close();
});
