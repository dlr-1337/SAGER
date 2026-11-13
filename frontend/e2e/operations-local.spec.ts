import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';
import type {
  CallContext,
  ExitEligibility,
  NightCall,
  ShortExit,
  ShortExitStatus,
} from '../src/app/features/operations/operations-local.models';

const residentId = '00000000-0000-0000-0000-000000000041';
const accommodationId = '00000000-0000-0000-0000-000000000011';
const roomAId = '00000000-0000-0000-0000-000000000111';
const roomBId = '00000000-0000-0000-0000-000000000112';
const callId = '00000000-0000-0000-0000-000000000901';
const exitId = '00000000-0000-0000-0000-000000000801';
const initialNow = '2026-09-30T16:00:00Z';

function exitFixture(): ShortExit {
  return {
    id: exitId,
    residentId,
    residentName: 'Estudante Sintético',
    enrollment: 'TESTE-001',
    departureMode: 'NOW',
    requestedDepartureAt: initialNow,
    expectedReturnAt: '2026-09-30T19:00:00Z',
    reason: 'Buscar material escolar',
    notes: null,
    status: 'AGUARDANDO_ANALISE',
    decision: null,
    decisionComment: null,
    decidedAt: null,
    actualDepartureAt: null,
    actualReturnAt: null,
    lateObservation: null,
    cancellationReason: null,
    expiryReason: null,
    createdAt: initialNow,
    updatedAt: initialNow,
    version: 0,
    departureRecordedAt: null,
    returnRecordedAt: null,
    deadlineAt: '2026-09-30T19:00:00Z',
    deadlinePassed: false,
    now: initialNow,
    zone: 'America/Sao_Paulo',
    capabilities: {
      canEdit: false,
      canDecide: true,
      canCancel: true,
      canDepart: false,
      canReturn: false,
    },
    history: [],
  };
}
function callFixture(): NightCall {
  return {
    id: callId,
    accommodationId,
    accommodationName: 'Alojamento Teste',
    referenceDate: '2026-09-30',
    status: 'ABERTA',
    version: 0,
    openedAt: '2026-10-01T01:30:00Z',
    closedAt: null,
    outsideWindowConfirmed: false,
    justification: null,
    closeOutsideWindowConfirmed: false,
    closeJustification: null,
    summary: { total: 2, present: 0, absent: 0, justified: 1, unmarked: 1 },
    records: [0, 1].map((index) => ({
      id: `registro-${index}`,
      residentId: index === 0 ? residentId : '00000000-0000-0000-0000-000000000042',
      residentName: index === 0 ? 'Estudante Sintético' : 'Residente de Teste',
      enrollment: `TESTE-00${index + 1}`,
      birthDate: '2010-05-14',
      roomId: index === 0 ? roomAId : roomBId,
      roomNumber: '101',
      mark: index === 1 ? ('AUSENCIA_JUSTIFICADA' as const) : null,
      authorizedExitId: index === 1 ? exitId : null,
      authorizedExitType: index === 1 ? 'SHORT' : null,
      version: index,
      history:
        index === 1
          ? [
              {
                id: 'historico-sistema',
                mark: 'AUSENCIA_JUSTIFICADA' as const,
                authorizedExitId: exitId,
                authorizedExitType: 'SHORT',
                justification: null,
                recordedAt: '2026-10-01T01:30:00Z',
                actorId: '00000000-0000-0000-0000-000000000001',
                actorProfile: 'sistema',
                version: 1,
                callVersion: 0,
              },
            ]
          : [],
      authorizedExits: index === 1 ? [{ id: exitId, type: 'SHORT' as const }] : [],
    })),
  };
}
interface MockState {
  role: 'supervisor' | 'residente' | 'gestor';
  now: string;
  outsideWindow: boolean;
  missingBirthDates: boolean;
  eligible: boolean;
  failReads: boolean;
  conflictOnce: boolean;
  calls: NightCall[];
  exits: ShortExit[];
  writes: { path: string; body: Record<string, any> }[];
}
async function mockApi(page: Page, options: Partial<MockState> = {}): Promise<MockState> {
  const state: MockState = {
    role: 'supervisor',
    now: initialNow,
    outsideWindow: false,
    missingBirthDates: false,
    eligible: true,
    failReads: false,
    conflictOnce: false,
    calls: [],
    exits: [],
    writes: [],
    ...options,
  };
  const capabilities = (exit: ShortExit) => ({
    canEdit: state.role === 'residente' && exit.status === 'AGUARDANDO_ANALISE',
    canDecide: state.role === 'supervisor' && exit.status === 'AGUARDANDO_ANALISE',
    canCancel:
      exit.status === 'AGUARDANDO_ANALISE' ||
      (state.role === 'supervisor' && exit.status === 'APROVADA'),
    canDepart: state.role === 'supervisor' && exit.status === 'APROVADA',
    canReturn: state.role === 'supervisor' && exit.status === 'EM_ANDAMENTO',
  });
  const view = (exit: ShortExit) => ({ ...exit, now: state.now, capabilities: capabilities(exit) });
  const event = (exit: ShortExit, kind: string, body: Record<string, any>) => {
    exit.version++;
    exit.updatedAt = state.now;
    const { history: previousHistory, capabilities: previousCapabilities, ...snapshot } = exit;
    void previousHistory;
    void previousCapabilities;
    exit.history.push({
      ...snapshot,
      id: `evento-${exit.version}`,
      event: kind,
      recordedAt: state.now,
      effectiveAt:
        body.occurredAt ?? (kind === 'DEPARTURE' || kind === 'RETURN' ? state.now : null),
      actorId: '00000000-0000-0000-0000-000000000001',
      actorProfile: state.role,
      origin: 'LOCAL_API',
      justification: body.justification ?? body.comment ?? null,
    });
  };
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const ok = (value: unknown) => route.fulfill({ json: value });
    if (path === '/api/v1/auth/me')
      return ok({
        id: '00000000-0000-0000-0000-000000000001',
        nome: state.role === 'residente' ? 'Estudante Sintético' : 'Supervisora Sintética',
        email: 'sessao@example.test',
        matricula: 'TESTE-LOGIN',
        fotoUrl: null,
        perfis: [state.role],
        residenteId: state.role === 'residente' ? residentId : null,
        supervisorId: state.role === 'supervisor' ? '00000000-0000-0000-0000-000000000101' : null,
      });
    if (path === '/api/v1/auth/csrf')
      return ok({ headerName: 'X-CSRF-TOKEN', token: 'synthetic-token' });
    if (method === 'GET') {
      if (state.failReads)
        return route.fulfill({
          status: 503,
          json: { message: 'Serviço temporariamente indisponível.' },
        });
      if (path === '/api/v1/quartos/mapa') {
        const unit = (id: string, name: string) => ({
          id,
          accommodationId,
          code: id,
          name,
          version: 0,
        });
        const room = (id: string, code: string, unitId: string) => ({
          id,
          code,
          number: '101',
          accommodationId,
          unitId,
          floor: null,
          capacity: 4,
          situation: 'Ocupado',
          occupancy: 1,
          vacancies: 3,
          cleaningScore: null,
          version: 0,
        });
        return ok({
          accommodations: [
            { id: accommodationId, code: 'T', name: 'Alojamento Teste', version: 0 },
          ],
          units: [unit('bloco-a', 'Bloco A'), unit('bloco-b', 'Bloco B')],
          rooms: [room(roomAId, 'A-101', 'bloco-a'), room(roomBId, 'B-101', 'bloco-b')],
        });
      }
      if (path === '/api/v1/chamadas/contexto') {
        const ctx: CallContext = {
          accommodationId: url.searchParams.get('accommodationId'),
          referenceDate: '2026-09-30',
          now: state.now,
          zone: 'America/Sao_Paulo',
          windowStart: '22:00:00',
          windowEnd: '23:30:00',
          outsideWindow: state.outsideWindow,
          existingCallId: state.calls[0]?.id ?? null,
          eligibleResidents: 2,
          accommodations: [{ id: accommodationId, code: 'T', name: 'Alojamento Teste' }],
          missingBirthDates: state.missingBirthDates
            ? [
                {
                  residentId,
                  residentName: 'Estudante Sintético',
                  enrollment: 'TESTE-001',
                  roomNumber: '101',
                },
              ]
            : [],
        };
        return ok(ctx);
      }
      if (path === '/api/v1/chamadas')
        return ok(
          state.calls.filter((call) => call.referenceDate === url.searchParams.get('date')),
        );
      if (path === `/api/v1/chamadas/${callId}`)
        return state.calls[0] ? ok(state.calls[0]) : route.fulfill({ status: 404 });
      if (path === '/api/v1/saidas-curtas/elegibilidade') {
        const eligibility: ExitEligibility = {
          residentId,
          residentName: 'Estudante Sintético',
          enrollment: 'TESTE-001',
          birthDate: '2010-05-14',
          roomId: state.eligible ? '00000000-0000-0000-0000-000000000111' : null,
          roomNumber: state.eligible ? '101' : null,
          accommodationId: state.eligible ? accommodationId : null,
          eligible: state.eligible,
          blockers: state.eligible ? [] : ['active_allocation_required'],
          currentDate: '2026-09-30',
          now: state.now,
          zone: 'America/Sao_Paulo',
        };
        return ok(eligibility);
      }
      if (path === '/api/v1/saidas-curtas')
        return ok(
          state.exits
            .filter(
              (exit) =>
                (!url.searchParams.get('status') ||
                  exit.status === url.searchParams.get('status')) &&
                (!url.searchParams.get('search') ||
                  `${exit.residentName} ${exit.enrollment}`.includes(
                    url.searchParams.get('search')!,
                  )),
            )
            .map(view),
        );
      if (path === `/api/v1/saidas-curtas/${exitId}`)
        return state.exits[0] ? ok(view(state.exits[0])) : route.fulfill({ status: 404 });
      return route.fulfill({ status: 404 });
    }
    expect(request.headers()['x-csrf-token']).toBe('synthetic-token');
    const body = request.postDataJSON() as Record<string, any>;
    state.writes.push({ path, body });
    if (state.conflictOnce) {
      state.conflictOnce = false;
      return route.fulfill({ status: 409, json: { code: 'version_conflict' } });
    }
    if (path === '/api/v1/chamadas' && method === 'POST') {
      const call = callFixture();
      call.openedAt = state.now;
      call.outsideWindowConfirmed = body.outsideWindowConfirmed ?? false;
      call.justification = body.justification ?? null;
      state.calls = [call];
      return ok(call);
    }
    if (path.startsWith(`/api/v1/chamadas/${callId}/`)) {
      const call = state.calls[0];
      expect(body.version).toBe(call.version);
      call.version++;
      if (path.endsWith('/fechamento')) {
        call.status = 'FECHADA';
        call.closedAt = state.now;
        call.closeOutsideWindowConfirmed = body.outsideWindowConfirmed ?? false;
        call.closeJustification = body.justification ?? null;
      } else {
        const row = call.records.find((row) => row.residentId === path.split('/').at(-1))!;
        row.mark = body.mark;
        row.version++;
        row.authorizedExitId = body.authorizedExitId ?? null;
        row.authorizedExitType = body.authorizedExitType ?? null;
        row.history.push({
          id: `historico-${call.version}`,
          mark: body.mark,
          authorizedExitId: row.authorizedExitId,
          authorizedExitType: row.authorizedExitType,
          justification: body.justification ?? null,
          recordedAt: state.now,
          actorId: '00000000-0000-0000-0000-000000000001',
          actorProfile: state.role,
          version: row.version,
          callVersion: call.version,
        });
        call.summary = {
          total: call.records.length,
          present: call.records.filter((r) => r.mark === 'PRESENTE').length,
          absent: call.records.filter((r) => r.mark === 'AUSENTE').length,
          justified: call.records.filter((r) => r.mark === 'AUSENCIA_JUSTIFICADA').length,
          unmarked: call.records.filter((r) => !r.mark).length,
        };
      }
      return ok(call);
    }
    if (
      path === '/api/v1/saidas-curtas' ||
      (path === `/api/v1/saidas-curtas/${exitId}` && method === 'PUT')
    ) {
      const editing = method === 'PUT';
      const exit = editing ? state.exits[0] : exitFixture();
      if (editing) expect(body.version).toBe(exit.version);
      if (body.departureMode === 'NOW') expect(body).not.toHaveProperty('requestedDepartureAt');
      Object.assign(exit, body, {
        requestedDepartureAt: body.departureMode === 'NOW' ? state.now : body.requestedDepartureAt,
      });
      event(exit, editing ? 'EDIT' : 'CREATE', body);
      state.exits = [exit];
      return ok(view(exit));
    }
    if (path.startsWith(`/api/v1/saidas-curtas/${exitId}/`)) {
      const exit = state.exits[0];
      expect(body.version).toBe(exit.version);
      let kind = '';
      if (path.endsWith('/decisao')) {
        kind = body.decision;
        exit.status = body.decision === 'APPROVE' ? 'APROVADA' : 'REJEITADA';
        exit.decision = body.decision;
        exit.decisionComment = body.comment ?? null;
        exit.decidedAt = state.now;
      }
      if (path.endsWith('/cancelamento')) {
        kind = 'CANCEL';
        exit.status = 'CANCELADA';
        exit.cancellationReason = body.comment;
      }
      if (path.endsWith('/partida') || path.endsWith('/retorno')) {
        if (body.timeMode === 'NOW') {
          expect(body).not.toHaveProperty('occurredAt');
          expect(body).not.toHaveProperty('justification');
        }
        const actual = body.timeMode === 'NOW' ? state.now : body.occurredAt;
        if (path.endsWith('/partida')) {
          kind = 'DEPARTURE';
          exit.actualDepartureAt = actual;
          exit.departureRecordedAt = state.now;
          exit.status = 'EM_ANDAMENTO';
          exit.deadlineAt = null;
        } else {
          kind = 'RETURN';
          exit.actualReturnAt = actual;
          exit.returnRecordedAt = state.now;
          exit.status =
            Date.parse(actual) > Date.parse(exit.expectedReturnAt)
              ? 'RETORNO_CONFIRMADO_COM_ATRASO'
              : 'RETORNO_CONFIRMADO';
          exit.lateObservation = body.lateObservation ?? null;
        }
      }
      event(exit, kind, body);
      return ok(view(exit));
    }
    return route.fulfill({ status: 400 });
  });
  return state;
}

test.use({ timezoneId: 'Pacific/Auckland' });

test('redução de 26 para 25 saídas curtas retorna à página válida com filtros preservados', async ({
  page,
}) => {
  await mockApi(page);
  const records = Array.from({ length: 25 }, (_, index) => ({
    ...exitFixture(),
    id: `saida-sintetica-${index}`,
    status: 'APROVADA',
  }));
  let reduced = false;
  const queries: URLSearchParams[] = [];
  await page.route('**/api/v1/saidas-curtas?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    queries.push(params);
    if (params.get('offset') === '25') reduced = true;
    return route.fulfill({
      headers: { 'X-Total-Count': String(reduced ? 25 : 26) },
      json: params.get('offset') === '25' ? [] : records,
    });
  });
  await page.goto('/saidas');
  const search = page.getByRole('searchbox', { name: 'Nome ou matrícula' });
  await expect(search).toHaveClass(/ng-valid/);
  await search.fill('TESTE-001');
  await page.getByLabel('Situação', { exact: true }).selectOption('APROVADA');
  const pagination = page.getByRole('navigation', { name: 'Paginação' });
  await expect.poll(() => queries.at(-1)?.get('status')).toBe('APROVADA');
  await expect(pagination).toContainText('1–25 de 26');
  await pagination.getByRole('button', { name: 'Próxima' }).click();
  await expect(pagination).toContainText('1–25 de 25');
  await expect(page.getByRole('link', { name: 'Ver pedido' })).toHaveCount(25);
  await expect(page.getByRole('heading', { name: 'Nenhum pedido ainda.' })).toHaveCount(0);
  await expect(search).toHaveValue('TESTE-001');
  await expect(page.getByLabel('Situação', { exact: true })).toHaveValue('APROVADA');
  expect(queries.slice(-2).map((params) => params.get('offset'))).toEqual(['25', '0']);
  for (const query of queries.slice(-2)) {
    expect(query.get('search')).toBe('TESTE-001');
    expect(query.get('status')).toBe('APROVADA');
  }
});

test('situação Aprovada permanece ao abrir uma saída curta e retornar à lista', async ({
  page,
}) => {
  await mockApi(page, { exits: [{ ...exitFixture(), status: 'APROVADA' }] });
  await page.goto('/saidas');
  await page.getByLabel('Situação', { exact: true }).selectOption('APROVADA');
  const filtered = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === '/api/v1/saidas-curtas' && url.searchParams.get('status') === 'APROVADA'
    );
  });
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await filtered;
  await page.getByRole('link', { name: 'Ver pedido' }).click();
  await expect(page.getByRole('heading', { name: 'Pedido de saída curta' })).toBeVisible();
  const restored = page.waitForRequest(
    (request) => new URL(request.url()).pathname === '/api/v1/saidas-curtas',
  );
  await page.getByRole('link', { name: '← Saídas', exact: true }).click();
  await expect(page.getByLabel('Situação', { exact: true })).toHaveValue('APROVADA');
  expect(new URL((await restored).url()).searchParams.get('status')).toBe('APROVADA');
  await expect(page.getByRole('link', { name: 'Ver pedido' })).toHaveCount(1);
});

test('chamada filtra por bloco e quarto, com número repetido, sem liberar o fechamento', async ({
  page,
}) => {
  await mockApi(page, { calls: [callFixture()] });
  await page.goto('/chamada');
  const unit = page.getByRole('combobox', { name: 'Casa ou bloco', exact: true });
  const room = page.getByRole('combobox', { name: 'Quarto', exact: true });
  await expect(room.locator('option')).toHaveText([
    'Todos os quartos',
    'A-101 · Bloco A',
    'B-101 · Bloco B',
  ]);
  await room.selectOption({ label: 'B-101 · Bloco B' });
  await expect(page.getByRole('heading', { name: 'Residente de Teste' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Estudante Sintético' })).toHaveCount(0);
  await expect(page.getByText('1 de 2 residentes')).toBeVisible();
  await expect(page.getByText('Falta marcar 1 residente')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fechar chamada' })).toBeDisabled();
  await unit.selectOption({ label: 'Bloco A' });
  await expect(room).toHaveValue('');
  await expect(room.locator('option')).toHaveText(['Todos os quartos', 'A-101 · Bloco A']);
  await expect(page.getByRole('heading', { name: 'Estudante Sintético' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Residente de Teste' })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
  await expect(page.getByText('2 de 2 residentes')).toBeVisible();
});

test('chamada persiste após recarga, confirma alerta e preserva correção da chamada fechada', async ({
  page,
}) => {
  const state = await mockApi(page, { outsideWindow: true, now: '2026-10-01T01:00:00Z' });
  await page.goto('/chamada');
  await page.getByRole('button', { name: 'Abrir chamada' }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('não é o horário da chamada');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(state.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Abrir chamada' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Abrir chamada', exact: true }).click();
  await expect(dialog.getByRole('alert').last()).toContainText('justificativa');
  await dialog
    .getByLabel('Justificativa', { exact: true })
    .fill('Ronda presencial concluída antes da janela.');
  await dialog.getByLabel('Confirmo o registro fora do horário').check();
  await dialog.getByRole('button', { name: 'Abrir chamada', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Chamada aberta' })).toBeVisible();
  const first = page.getByRole('group', { name: 'Presença de Estudante Sintético' });
  await first.getByRole('button', { name: 'Presente', exact: true }).click();
  await expect(first.getByRole('button', { name: 'Presente', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const second = page.getByRole('group', { name: 'Presença de Residente de Teste' });
  await expect(
    second.getByRole('button', { name: 'Ausência justificada', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('já entram como ausência justificada')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'saída curta de Residente de Teste' }),
  ).toHaveAttribute('href', `/saidas/${exitId}`);
  const automatic = page.getByRole('article').filter({ hasText: 'Residente de Teste' });
  await automatic.getByText('Histórico da marcação (1)').click();
  await expect(automatic.locator('.local-history').getByText('Sistema')).toBeVisible();
  await expect(page.getByText(exitId)).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.reload();
  await expect(
    page
      .getByRole('group', { name: 'Presença de Estudante Sintético' })
      .getByRole('button', { name: 'Presente', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Fechar chamada' }).click();
  dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Justificativa', { exact: true })
    .fill('Fechamento revisado após a ronda presencial.');
  await dialog.getByLabel('Confirmo o registro fora do horário').check();
  await dialog.getByRole('button', { name: 'Fechar chamada', exact: true }).click();
  await expect(page.getByText('Fechada', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Corrigir marcação de Estudante Sintético' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Marcação corrigida').selectOption('AUSENTE');
  await dialog
    .getByLabel('Justificativa', { exact: true })
    .fill('Correção conferida presencialmente com a portaria.');
  await dialog.getByRole('button', { name: 'Salvar correção' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Correção registrada' })).toBeVisible();
  await page.reload();
  await page.getByText('Histórico da marcação (2)').click();
  await expect(
    page.getByText('Correção conferida presencialmente com a portaria.', { exact: false }),
  ).toBeVisible();
  expect(state.calls[0].records[0].history.map((event) => event.mark)).toEqual([
    'PRESENTE',
    'AUSENTE',
  ]);
  expect(
    state.writes.map((write) => write.body.version).filter((version) => version !== undefined),
  ).toEqual([0, 1, 2]);
});

test('data de nascimento ausente bloqueia abertura e falha da API não mostra demonstração', async ({
  page,
}) => {
  const state = await mockApi(page, { missingBirthDates: true });
  await page.goto('/chamada');
  await expect(page.getByText(/Não é possível abrir a chamada/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir chamada' })).toBeDisabled();
  expect(state.writes).toHaveLength(0);
  state.failReads = true;
  await page.getByRole('button', { name: 'Ver chamada' }).click();
  await expect(
    page.getByRole('heading', { name: 'Não foi possível carregar a chamada' }),
  ).toBeVisible();
  await expect(page.getByText('Dados de demonstração')).toHaveCount(0);
  state.failReads = false;
  state.missingBirthDates = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByRole('button', { name: 'Abrir chamada' })).toBeEnabled();
});

test('residente envia NOW sem relógio do navegador, edita e consulta depois de recarregar', async ({
  page,
}) => {
  const state = await mockApi(page, { role: 'residente' });
  await page.goto('/saidas');
  await expect(page.getByRole('heading', { name: 'Nenhum pedido ainda.' })).toBeVisible();
  await page.getByRole('link', { name: 'Pedir saída curta' }).click();
  await expect(page.getByLabel('Que horas você volta?')).toHaveValue('2026-09-30T16:00');
  await page.getByLabel('Por que você quer sair?').fill('Buscar material escolar');
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(page).toHaveURL(new RegExp(`/saidas/${exitId}`));
  await expect(page.getByText('Pedido salvo.', { exact: true })).toBeVisible();
  expect(state.writes[0].body).not.toHaveProperty('requestedDepartureAt');
  expect(state.exits[0].residentId).toBe(residentId);
  await page.reload();
  await expect(page.getByText('Buscar material escolar', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Registrar volta' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Registrar saída' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Mudar pedido' }).click();
  await page.getByLabel('Por que você quer sair?').fill('Buscar material escolar na papelaria');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(
    page.getByText('Buscar material escolar na papelaria', { exact: true }),
  ).toBeVisible();
  expect(state.writes[1].body.version).toBe(1);
  await page.getByRole('button', { name: 'Cancelar pedido', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(state.writes).toHaveLength(2);
});

test('saída agendada limita duração, converte São Paulo e não solicita sem alocação', async ({
  page,
}) => {
  const state = await mockApi(page, { role: 'residente' });
  await page.goto('/saidas/nova');
  await page.getByLabel('Quando você quer sair?').selectOption('SCHEDULED');
  await page.getByLabel('Data e hora de saída').fill('2026-09-30T14:00');
  await page.getByLabel('Que horas você volta?').fill('2026-09-30T17:01');
  await page.getByLabel('Por que você quer sair?').fill('Buscar material escolar');
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(page.getByRole('alert')).toContainText('3 horas');
  expect(state.writes).toHaveLength(0);
  await page.getByLabel('Que horas você volta?').fill('2026-09-30T17:00');
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(page).toHaveURL(new RegExp(`/saidas/${exitId}`));
  expect(state.writes[0].body.requestedDepartureAt).toBe('2026-09-30T17:00:00.000Z');
  expect(state.writes[0].body.expectedReturnAt).toBe('2026-09-30T20:00:00.000Z');
  state.eligible = false;
  await page.goto('/saidas/nova');
  await expect(
    page.getByRole('heading', { name: 'Você não pode pedir esta saída agora' }),
  ).toBeVisible();
  await expect(
    page.getByText('Você ainda não tem quarto no sistema. Fale com o supervisor.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar pedido' })).toHaveCount(0);
});

test('Agendar pede a partida, retorno manual sobrevive e ajuste fora do limite é anunciado', async ({
  page,
}) => {
  const state = await mockApi(page, { role: 'residente', now: '2026-09-30T16:00:20Z' });
  await page.goto('/saidas/nova');
  const departure = page.getByLabel('Data e hora de saída');
  const expectedReturn = page.getByLabel('Que horas você volta?');
  await expect(expectedReturn).toHaveValue('2026-09-30T16:00');
  await page.getByLabel('Quando você quer sair?').selectOption('SCHEDULED');
  await expect(departure).toHaveValue('');
  await expect(departure).toHaveAttribute('min', '2026-09-30T13:01');
  await page.getByLabel('Por que você quer sair?').fill('Buscar material escolar');
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(page.getByText('Informe a data e hora de saída.', { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await departure.fill('2026-09-30T14:00');
  await expect(expectedReturn).toHaveValue('2026-09-30T17:00');
  await expectedReturn.fill('2026-09-30T15:30');
  await departure.fill('2026-09-30T14:10');
  await expect(expectedReturn).toHaveValue('2026-09-30T15:30');
  await expect(expectedReturn).toHaveAttribute('max', '2026-09-30T17:10');
  await expect(page.getByText('Duração: 1 h 20 min (máx. 3 h).', { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await departure.fill('2026-09-30T16:00');
  await expect(expectedReturn).toHaveValue('2026-09-30T19:00');
  await expect(page.getByRole('status').filter({ hasText: 'não dava' })).toContainText('19:00');
  await expectedReturn.fill('2026-09-30T18:00');
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(page).toHaveURL(new RegExp(`/saidas/${exitId}`));
  expect(state.writes[0].body.requestedDepartureAt).toBe('2026-09-30T19:00:00.000Z');
  expect(state.writes[0].body.expectedReturnAt).toBe('2026-09-30T21:00:00.000Z');
});

test('supervisor aprova e registra partida e retorno tardio com histórico persistente', async ({
  page,
}) => {
  const state = await mockApi(page, { exits: [exitFixture()] });
  await page.goto(`/saidas/${exitId}`);
  await page.getByRole('button', { name: 'Aprovar', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(state.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Aprovar', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar aprovação' }).click();
  await expect(page.getByText('Aprovada', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Registrar saída' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar saída' }).click();
  await expect(page.getByText('Em andamento', { exact: true })).toBeVisible();
  expect(state.writes[1].body).toEqual({ version: 1, timeMode: 'NOW' });
  state.now = '2026-09-30T20:00:00Z';
  await page.getByRole('button', { name: 'Registrar volta' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Confirmar volta', exact: true }).click();
  await expect(dialog.getByRole('alert').last()).toContainText('observação do atraso');
  await dialog.getByLabel('Horário do registro').selectOption('RETROACTIVE');
  await dialog.getByLabel('Horário real do retorno').fill('2026-09-30T16:30');
  await dialog
    .getByLabel('Justificativa', { exact: true })
    .fill('Retorno conferido no livro da portaria.');
  await dialog
    .getByLabel('Observação do atraso', { exact: true })
    .fill('Problema no transporte causou atraso no retorno.');
  await dialog.getByRole('button', { name: 'Confirmar volta', exact: true }).click();
  await expect(page.getByText('Retorno confirmado com atraso', { exact: true })).toBeVisible();
  expect(state.writes[2].body).toEqual({
    version: 2,
    timeMode: 'RETROACTIVE',
    occurredAt: '2026-09-30T19:30:00.000Z',
    justification: 'Retorno conferido no livro da portaria.',
    lateObservation: 'Problema no transporte causou atraso no retorno.',
  });
  await page.reload();
  await expect(page.getByText('Saída registrada', { exact: true })).toBeVisible();
  await expect(page.getByText('Volta registrada', { exact: true })).toBeVisible();
  expect(state.exits[0].history).toHaveLength(3);
});

test('conflito exige recarga explícita e nunca repete a decisão com outra versão', async ({
  page,
}) => {
  const state = await mockApi(page, { exits: [exitFixture()], conflictOnce: true });
  await page.goto(`/saidas/${exitId}`);
  await page.getByRole('button', { name: 'Aprovar', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar aprovação' }).click();
  await expect(page.getByRole('alert')).toContainText('Clique em Recarregar');
  await expect(page.getByRole('button', { name: 'Aprovar', exact: true })).toBeDisabled();
  expect(state.writes).toHaveLength(1);
  state.exits[0].status = 'REJEITADA';
  state.exits[0].version = 1;
  await page.getByRole('button', { name: 'Recarregar dados' }).click();
  await expect(page.getByText('Rejeitada', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aprovar', exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
});

test('rejeição de saída curta exige justificativa', async ({ page }) => {
  const state = await mockApi(page, { exits: [exitFixture()] });
  await page.goto(`/saidas/${exitId}`);
  await page.getByRole('button', { name: 'Rejeitar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const confirm = dialog.getByRole('button', { name: 'Confirmar rejeição' });
  await confirm.click();
  await expect(dialog.getByRole('alert')).toContainText('10 a 2.000');
  await dialog.getByLabel('Justificativa', { exact: true }).fill('a'.repeat(9));
  await confirm.click();
  await expect(dialog.getByRole('alert')).toContainText('10 a 2.000');
  expect(state.writes).toHaveLength(0);
  await dialog.getByLabel('Justificativa', { exact: true }).fill('Sem vaga.!');
  await confirm.click();
  await expect(page.getByText('Rejeitada', { exact: true }).first()).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].path).toBe(`/api/v1/saidas-curtas/${exitId}/decisao`);
  expect(state.writes[0].body).toMatchObject({ decision: 'REJECT', comment: 'Sem vaga.!' });
});

test('layout de 320px, revisão por teclado, foco restaurado e acessibilidade', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const state = await mockApi(page, { exits: [exitFixture()] });
  await page.goto(`/saidas/${exitId}`);
  const approve = page.getByRole('button', { name: 'Aprovar', exact: true });
  await approve.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Comentário (opcional)')).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(approve).toBeFocused();
  expect(state.writes).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('gestor não opera saídas ou chamada, supervisor não solicita e residente não registra presença', async ({
  page,
}) => {
  const inProgress = {
    ...exitFixture(),
    status: 'EM_ANDAMENTO' as ShortExitStatus,
    actualDepartureAt: initialNow,
    deadlineAt: null,
  };
  const state = await mockApi(page, { exits: [inProgress] });
  await page.goto('/saidas/nova');
  await expect(page).toHaveURL(/\/acesso-negado$/);
  expect(state.writes).toHaveLength(0);
  state.role = 'gestor';
  await page.goto('/chamada');
  await expect(page).toHaveURL(/\/acesso-negado$/);
  await page.goto('/saidas');
  await expect(page).toHaveURL(/\/acesso-negado$/);
  state.role = 'residente';
  await page.goto('/chamada');
  await expect(page).toHaveURL(/\/acesso-negado$/);
  await page.goto(`/saidas/${exitId}`);
  await expect(page.getByText('Em andamento', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Registrar volta' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Registrar saída' })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
