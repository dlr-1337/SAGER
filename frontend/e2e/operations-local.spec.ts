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
    summary: { total: 2, present: 0, absent: 0, justified: 0, unmarked: 2 },
    records: [0, 1].map((index) => ({
      id: `registro-${index}`,
      residentId: index === 0 ? residentId : '00000000-0000-0000-0000-000000000042',
      residentName: index === 0 ? 'Estudante Sintético' : 'Residente de Teste',
      enrollment: `TESTE-00${index + 1}`,
      birthDate: '2010-05-14',
      roomId: '00000000-0000-0000-0000-000000000111',
      roomNumber: '101',
      mark: null,
      authorizedExitId: null,
      authorizedExitType: null,
      version: 0,
      history: [],
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

test('chamada persiste após recarga, confirma alerta e preserva correção da chamada fechada', async ({
  page,
}) => {
  const state = await mockApi(page, { outsideWindow: true, now: '2026-10-01T01:00:00Z' });
  await page.goto('/chamada');
  await page.getByRole('button', { name: 'Revisar e abrir chamada' }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('fora da janela');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(state.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Revisar e abrir chamada' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Abrir chamada', exact: true }).click();
  await expect(dialog.getByRole('alert').last()).toContainText('justificativa');
  await dialog
    .getByLabel('Justificativa', { exact: true })
    .fill('Ronda presencial concluída antes da janela.');
  await dialog.getByLabel('Confirmo o registro fora da janela').check();
  await dialog.getByRole('button', { name: 'Abrir chamada', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Chamada aberta');
  const first = page.getByRole('group', { name: 'Presença de Estudante Sintético' });
  await first.getByRole('button', { name: 'Presente', exact: true }).click();
  await expect(first.getByRole('button', { name: 'Presente', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const second = page.getByRole('group', { name: 'Presença de Residente de Teste' });
  await second.getByRole('button', { name: 'Ausência justificada', exact: true }).click();
  await expect(
    second.getByRole('button', { name: 'Ausência justificada', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(
    page
      .getByRole('group', { name: 'Presença de Estudante Sintético' })
      .getByRole('button', { name: 'Presente', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Revisar e fechar chamada' }).click();
  dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Justificativa', { exact: true })
    .fill('Fechamento revisado após a ronda presencial.');
  await dialog.getByLabel('Confirmo o registro fora da janela').check();
  await dialog.getByRole('button', { name: 'Fechar chamada', exact: true }).click();
  await expect(page.getByText('Fechada', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Corrigir marcação de Estudante Sintético' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Marcação corrigida').selectOption('AUSENTE');
  await dialog
    .getByLabel('Justificativa', { exact: true })
    .fill('Correção conferida presencialmente com a portaria.');
  await dialog.getByRole('button', { name: 'Salvar correção' }).click();
  await expect(page.getByRole('status').last()).toContainText('Correção registrada');
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
  ).toEqual([0, 1, 2, 3]);
});

test('data de nascimento ausente bloqueia abertura e falha da API não mostra demonstração', async ({
  page,
}) => {
  const state = await mockApi(page, { missingBirthDates: true });
  await page.goto('/chamada');
  await expect(page.getByText(/A abertura está bloqueada/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Revisar e abrir chamada' })).toBeDisabled();
  expect(state.writes).toHaveLength(0);
  state.failReads = true;
  await page.getByRole('button', { name: 'Consultar chamadas' }).click();
  await expect(
    page.getByRole('heading', { name: 'Não foi possível carregar a chamada' }),
  ).toBeVisible();
  await expect(page.getByText('Dados de demonstração')).toHaveCount(0);
  state.failReads = false;
  state.missingBirthDates = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByRole('button', { name: 'Revisar e abrir chamada' })).toBeEnabled();
});

test('residente envia NOW sem relógio do navegador, edita e consulta depois de recarregar', async ({
  page,
}) => {
  const state = await mockApi(page, { role: 'residente' });
  await page.goto('/saidas');
  await expect(page.getByRole('heading', { name: 'Nenhuma saída encontrada' })).toBeVisible();
  await page.getByRole('link', { name: 'Solicitar saída curta' }).click();
  await expect(page.getByLabel('Retorno previsto')).toHaveValue('2026-09-30T16:00');
  await page.getByLabel('Motivo da saída').fill('Buscar material escolar');
  await page.getByRole('button', { name: 'Enviar solicitação' }).click();
  await expect(page).toHaveURL(new RegExp(`/saidas/${exitId}`));
  await expect(page.getByText('Solicitação salva.', { exact: true })).toBeVisible();
  expect(state.writes[0].body).not.toHaveProperty('requestedDepartureAt');
  expect(state.exits[0].residentId).toBe(residentId);
  await page.reload();
  await expect(page.getByText('Buscar material escolar', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar retorno presencial' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Registrar partida presencial' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Editar solicitação' }).click();
  await page.getByLabel('Motivo da saída').fill('Buscar material escolar na papelaria');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(
    page.getByText('Buscar material escolar na papelaria', { exact: true }),
  ).toBeVisible();
  expect(state.writes[1].body.version).toBe(1);
  await page.getByRole('button', { name: 'Cancelar solicitação', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(state.writes).toHaveLength(2);
});

test('saída agendada limita duração, converte São Paulo e não solicita sem alocação', async ({
  page,
}) => {
  const state = await mockApi(page, { role: 'residente' });
  await page.goto('/saidas/nova');
  await page.getByLabel('Quando deseja sair?').selectOption('SCHEDULED');
  await page.getByLabel('Data e hora de saída').fill('2026-09-30T14:00');
  await page.getByLabel('Retorno previsto').fill('2026-09-30T17:01');
  await page.getByLabel('Motivo da saída').fill('Buscar material escolar');
  await page.getByRole('button', { name: 'Enviar solicitação' }).click();
  await expect(page.getByRole('alert')).toContainText('3 horas');
  expect(state.writes).toHaveLength(0);
  await page.getByLabel('Retorno previsto').fill('2026-09-30T17:00');
  await page.getByRole('button', { name: 'Enviar solicitação' }).click();
  await expect(page).toHaveURL(new RegExp(`/saidas/${exitId}`));
  expect(state.writes[0].body.requestedDepartureAt).toBe('2026-09-30T17:00:00.000Z');
  expect(state.writes[0].body.expectedReturnAt).toBe('2026-09-30T20:00:00.000Z');
  state.eligible = false;
  await page.goto('/saidas/nova');
  await expect(page.getByRole('heading', { name: 'Solicitação indisponível' })).toBeVisible();
  await expect(page.getByText('É necessária uma alocação ativa em quarto.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar solicitação' })).toHaveCount(0);
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
  await page.getByRole('button', { name: 'Registrar partida presencial' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar partida' }).click();
  await expect(page.getByText('Em andamento', { exact: true })).toBeVisible();
  expect(state.writes[1].body).toEqual({ version: 1, timeMode: 'NOW' });
  state.now = '2026-09-30T20:00:00Z';
  await page.getByRole('button', { name: 'Confirmar retorno presencial' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Confirmar retorno', exact: true }).click();
  await expect(dialog.getByRole('alert').last()).toContainText('observação do atraso');
  await dialog.getByLabel('Horário do registro').selectOption('RETROACTIVE');
  await dialog.getByLabel('Horário real do retorno').fill('2026-09-30T16:30');
  await dialog
    .getByLabel('Justificativa', { exact: true })
    .fill('Retorno conferido no livro da portaria.');
  await dialog
    .getByLabel('Observação do atraso', { exact: true })
    .fill('Problema no transporte causou atraso no retorno.');
  await dialog.getByRole('button', { name: 'Confirmar retorno', exact: true }).click();
  await expect(page.getByText('Retorno confirmado com atraso', { exact: true })).toBeVisible();
  expect(state.writes[2].body).toEqual({
    version: 2,
    timeMode: 'RETROACTIVE',
    occurredAt: '2026-09-30T19:30:00.000Z',
    justification: 'Retorno conferido no livro da portaria.',
    lateObservation: 'Problema no transporte causou atraso no retorno.',
  });
  await page.reload();
  await expect(page.getByText('Partida presencial registrada', { exact: true })).toBeVisible();
  await expect(page.getByText('Retorno presencial registrado', { exact: true })).toBeVisible();
  expect(state.exits[0].history).toHaveLength(3);
});

test('conflito exige recarga explícita e nunca repete a decisão com outra versão', async ({
  page,
}) => {
  const state = await mockApi(page, { exits: [exitFixture()], conflictOnce: true });
  await page.goto(`/saidas/${exitId}`);
  await page.getByRole('button', { name: 'Aprovar', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar aprovação' }).click();
  await expect(page.getByRole('alert')).toContainText('Recarregue');
  await expect(page.getByRole('button', { name: 'Aprovar', exact: true })).toBeDisabled();
  expect(state.writes).toHaveLength(1);
  state.exits[0].status = 'REJEITADA';
  state.exits[0].version = 1;
  await page.getByRole('button', { name: 'Recarregar solicitação' }).click();
  await expect(page.getByText('Rejeitada', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aprovar', exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
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
  await expect(page.getByRole('button', { name: 'Confirmar retorno presencial' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Registrar partida presencial' })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
