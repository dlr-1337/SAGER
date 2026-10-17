import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';
import type {
  LongExit,
  LongExitEligibility,
} from '../src/app/features/operations/long-exit.models';
import type { SignatureAccess } from '../src/app/features/signature/signature-access.models';

const residentId = '00000000-0000-0000-0000-000000000041';
const guardianId = '00000000-0000-0000-0000-000000000051';
const exitId = '00000000-0000-0000-0000-000000000801';
const documentId = '00000000-0000-0000-0000-000000000811';
const bindingId = '00000000-0000-0000-0000-000000000821';
const token = 'A'.repeat(43);
const now = '2026-09-30T16:00:00Z';
const pdf = '%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF';

function exitFixture(): LongExit {
  return {
    id: exitId,
    residentId,
    residentName: 'Estudante Sintético',
    enrollment: 'TESTE-001',
    guardianId,
    guardianName: 'Responsável Sintético',
    guardianRelationship: 'Mãe',
    departureMode: 'NOW',
    requestedDepartureAt: now,
    expectedReturnAt: '2026-09-30T22:00:00Z',
    reason: 'Visita à família sintética',
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
    createdAt: now,
    updatedAt: now,
    version: 0,
    departureRecordedAt: null,
    returnRecordedAt: null,
    deadlineAt: '2026-09-30T22:00:00Z',
    deadlinePassed: false,
    now,
    zone: 'America/Sao_Paulo',
    currentDocument: {
      documentVersionId: documentId,
      revisionNumber: 1,
      originalState: 'STORED',
      signedState: 'NOT_AVAILABLE',
    },
    signatureStatus: 'PENDING',
    messageStatus: 'READ',
    signedAt: null,
    resendAvailableAt: null,
    remainingResends: 3,
    bindings: [
      {
        id: bindingId,
        documentVersionId: documentId,
        guardianId,
        guardianName: 'Responsável Sintético',
        status: 'PENDING',
        messageStatus: 'READ',
        expiresAt: '2026-09-30T22:00:00Z',
        createdAt: now,
        revokedAt: null,
        signedAt: null,
        verifiedAt: null,
        failureCode: null,
        widgetAvailable: true,
      },
    ],
    capabilities: {
      canEdit: false,
      canApprove: false,
      canReject: true,
      canCancel: true,
      canDepart: false,
      canReturn: false,
      canResend: true,
      canReconcile: false,
      canDownloadOriginal: true,
      canDownloadSigned: false,
    },
    history: [],
  };
}
function invitationFixture(): SignatureAccess {
  return {
    bindingId,
    documentVersionId: documentId,
    revisionNumber: 1,
    residentName: 'Estudante Sintético',
    enrollment: 'TESTE-001',
    guardianName: 'Responsável Sintético',
    guardianRelationship: 'Mãe',
    requestedDepartureAt: now,
    expectedReturnAt: '2026-09-30T22:00:00Z',
    reason: 'Visita à família sintética',
    notes: null,
    signatureStatus: 'PENDING',
    expiresAt: '2026-09-30T22:00:00Z',
    now,
    widget: {
      available: true,
      signerId: '00000000-0000-0000-0000-000000000831',
      environment: 'sandbox',
      libraryVersion: '2.1.0',
    },
  };
}
interface MockState {
  role: 'residente' | 'supervisor' | 'gestor';
  now: string;
  exits: LongExit[];
  guardiansEligible: boolean;
  providersEnabled: boolean;
  canResend: boolean;
  conflict: boolean;
  failReads: boolean;
  publicStatus: number;
  invitation: SignatureAccess;
  writes: { path: string; body: Record<string, any>; headers: Record<string, string> }[];
  publicReads: { path: string; method: string; headers: Record<string, string> }[];
  paths: string[];
  widgetRequests: { url: string; headers: Record<string, string> }[];
}
async function mockApi(page: Page, options: Partial<MockState> = {}): Promise<MockState> {
  const state: MockState = {
    role: 'supervisor',
    now,
    exits: [exitFixture()],
    guardiansEligible: true,
    providersEnabled: true,
    canResend: true,
    conflict: false,
    failReads: false,
    publicStatus: 200,
    invitation: invitationFixture(),
    writes: [],
    publicReads: [],
    paths: [],
    widgetRequests: [],
    ...options,
  };
  const view = (exit: LongExit): LongExit => {
    const pending = exit.status === 'AGUARDANDO_ANALISE';
    const supervisor = state.role === 'supervisor';
    return {
      ...exit,
      now: state.now,
      capabilities: {
        canEdit: pending && state.role === 'residente',
        canApprove: pending && supervisor && exit.signatureStatus === 'VALID',
        canReject: pending && supervisor,
        canCancel: pending || (supervisor && exit.status === 'APROVADA'),
        canDepart: supervisor && exit.status === 'APROVADA',
        canReturn: supervisor && exit.status === 'EM_ANDAMENTO',
        canResend:
          supervisor &&
          pending &&
          state.canResend &&
          state.providersEnabled &&
          exit.signatureStatus !== 'VALID' &&
          exit.signatureStatus !== 'UNCERTAIN' &&
          exit.remainingResends > 0,
        canReconcile: supervisor && pending && exit.signatureStatus === 'UNCERTAIN',
        canDownloadOriginal: exit.currentDocument?.originalState === 'STORED',
        canDownloadSigned: exit.currentDocument?.signedState === 'STORED',
      },
    };
  };
  const history = (exit: LongExit, event: string, body: Record<string, any>) => {
    exit.version++;
    exit.updatedAt = state.now;
    const { history: previousHistory, capabilities, bindings, currentDocument, ...snapshot } = exit;
    void previousHistory;
    void capabilities;
    void bindings;
    exit.history.push({
      ...snapshot,
      id: `evento-${exit.version}`,
      event,
      recordedAt: state.now,
      effectiveAt: body.occurredAt ?? (['DEPARTURE', 'RETURN'].includes(event) ? state.now : null),
      actorId: '00000000-0000-0000-0000-000000000001',
      actorProfile: state.role,
      origin: 'LOCAL_API',
      justification: body.justification ?? body.comment ?? null,
      documentVersionId: currentDocument?.documentVersionId ?? null,
    });
  };
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    state.paths.push(path);
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
      return ok({ headerName: 'X-CSRF-TOKEN', token: 'synthetic-csrf' });
    if (path.startsWith('/api/v1/assinaturas/')) {
      state.publicReads.push({ path, method, headers: request.headers() });
      if (state.publicStatus !== 200)
        return route.fulfill({ status: state.publicStatus, json: { message: `secret=${token}` } });
      if (path.endsWith('/documento'))
        return route.fulfill({ contentType: 'application/pdf', body: pdf });
      return ok(state.invitation);
    }
    if (method === 'GET') {
      if (state.failReads)
        return route.fulfill({
          status: 503,
          json: { message: 'Serviço temporariamente indisponível.' },
        });
      if (path === '/api/v1/saidas-longas/elegibilidade') {
        const eligibility: LongExitEligibility = {
          residentId,
          residentName: 'Estudante Sintético',
          enrollment: 'TESTE-001',
          birthDate: '2010-05-14',
          roomId: '00000000-0000-0000-0000-000000000111',
          roomNumber: '101',
          accommodationId: '00000000-0000-0000-0000-000000000011',
          eligible: true,
          blockers: [],
          currentDate: '2026-09-30',
          now: state.now,
          zone: 'America/Sao_Paulo',
          guardians: [
            {
              id: guardianId,
              name: 'Responsável Sintético',
              relationship: 'Mãe',
              phone: '+5562999999999',
              eligible: state.guardiansEligible,
              blockers: state.guardiansEligible ? [] : ['invalid_phone'],
            },
          ],
          providers: {
            clicksignEnabled: state.providersEnabled,
            whatsappEnabled: state.providersEnabled,
          },
        };
        return ok(eligibility);
      }
      if (path === '/api/v1/saidas-longas')
        return ok(
          state.exits
            .filter(
              (exit) =>
                !url.searchParams.get('status') || exit.status === url.searchParams.get('status'),
            )
            .map(view),
        );
      if (path === '/api/v1/saidas-curtas') return ok([]);
      if (path.includes('/documentos/'))
        return route.fulfill({ contentType: 'application/pdf', body: pdf });
      const item = state.exits.find((exit) => path === `/api/v1/saidas-longas/${exit.id}`);
      return item ? ok(view(item)) : route.fulfill({ status: 404 });
    }
    const body = request.postDataJSON() as Record<string, any>;
    state.writes.push({ path, body, headers: request.headers() });
    if (state.conflict) {
      state.conflict = false;
      return route.fulfill({
        status: 409,
        json: { code: 'version_conflict', message: 'A solicitação foi alterada por outra pessoa.' },
      });
    }
    if (path === '/api/v1/saidas-longas' && method === 'POST') {
      const exit = exitFixture();
      Object.assign(exit, body, {
        requestedDepartureAt: body.departureMode === 'NOW' ? state.now : body.requestedDepartureAt,
      });
      if (!state.providersEnabled) {
        exit.signatureStatus = 'UNAVAILABLE';
        exit.messageStatus = 'UNAVAILABLE';
        exit.bindings = [];
      }
      history(exit, 'CREATE', body);
      state.exits.push(exit);
      return ok(view(exit));
    }
    const exit = state.exits.find((item) => path.startsWith(`/api/v1/saidas-longas/${item.id}`));
    if (!exit) return route.fulfill({ status: 404 });
    const action = path.split('/').at(-1);
    if (method === 'PUT') {
      Object.assign(exit, body);
      exit.bindings.forEach((binding) => {
        binding.status = 'INVALIDATED';
        binding.revokedAt = state.now;
        binding.widgetAvailable = false;
      });
      exit.currentDocument = {
        documentVersionId: '00000000-0000-0000-0000-000000000812',
        revisionNumber: 2,
        originalState: 'STORED',
        signedState: 'NOT_AVAILABLE',
      };
      exit.signatureStatus = state.providersEnabled ? 'PENDING' : 'UNAVAILABLE';
      exit.messageStatus = state.providersEnabled ? 'QUEUED' : 'UNAVAILABLE';
      history(exit, 'EDIT', body);
    } else if (action === 'decisao') {
      exit.decision = body.decision;
      exit.decisionComment = body.comment ?? null;
      exit.decidedAt = state.now;
      exit.status = body.decision === 'APPROVE' ? 'APROVADA' : 'REJEITADA';
      history(exit, body.decision, body);
    } else if (action === 'cancelamento') {
      exit.status = 'CANCELADA';
      exit.cancellationReason = body.comment;
      exit.signatureStatus = 'INVALIDATED';
      history(exit, 'CANCEL', body);
    } else if (action === 'reenvio') {
      exit.remainingResends--;
      exit.resendAvailableAt = '2026-09-30T16:10:00Z';
      state.canResend = false;
      exit.messageStatus = 'QUEUED';
      history(exit, 'RESEND', body);
    } else if (action === 'reconciliacao') {
      history(exit, 'RECONCILE', body);
    } else if (action === 'partida') {
      exit.actualDepartureAt = body.timeMode === 'NOW' ? state.now : body.occurredAt;
      exit.departureRecordedAt = state.now;
      exit.status = 'EM_ANDAMENTO';
      history(exit, 'DEPARTURE', body);
    } else if (action === 'retorno') {
      exit.actualReturnAt = body.timeMode === 'NOW' ? state.now : body.occurredAt;
      exit.returnRecordedAt = state.now;
      exit.lateObservation = body.lateObservation ?? null;
      exit.status =
        Date.parse(exit.actualReturnAt!) > Date.parse(exit.expectedReturnAt)
          ? 'RETORNO_CONFIRMADO_COM_ATRASO'
          : 'RETORNO_CONFIRMADO';
      history(exit, 'RETURN', body);
    }
    return ok(view(exit));
  });
  await page.route(
    'https://cdn-public-library.clicksign.com/embedded/embedded.min-2.1.0.js',
    async (route) => {
      state.widgetRequests.push({ url: route.request().url(), headers: route.request().headers() });
      await route.fulfill({
        contentType: 'text/javascript',
        body: `window.Clicksign = class {
      constructor(id) { this.id = id; this.callbacks = {}; }
      on(name, callback) { this.callbacks[name] = callback; }
      mount(id) { this.container = document.getElementById(id); const frame = document.createElement('iframe'); frame.src='about:blank'; frame.style.width='100%'; frame.style.border='0'; this.container.appendChild(frame); const button = document.createElement('button'); button.textContent='Concluir no provedor de teste'; button.onclick=()=>this.callbacks.signed?.({}); this.container.appendChild(button); this.callbacks.loaded?.({}); this.callbacks.resized?.({data:{height:480}}); }
      unmount() { this.container?.replaceChildren(); }
    };`,
      });
    },
  );
  return state;
}

test.use({ timezoneId: 'Pacific/Auckland' });

test('redução de 26 para 25 saídas longas retorna à página válida com filtros preservados', async ({
  page,
}) => {
  await mockApi(page);
  const records = Array.from({ length: 25 }, (_, index) => ({
    ...exitFixture(),
    id: `saida-longa-sintetica-${index}`,
    status: 'APROVADA',
  }));
  let reduced = false;
  const queries: URLSearchParams[] = [];
  await page.route('**/api/v1/saidas-longas?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    queries.push(params);
    if (params.get('offset') === '25') reduced = true;
    return route.fulfill({
      headers: { 'X-Total-Count': String(reduced ? 25 : 26) },
      json: params.get('offset') === '25' ? [] : records,
    });
  });
  await page.goto('/saidas?tipo=longa');
  const search = page.getByRole('searchbox', { name: 'Nome ou matrícula' });
  await expect(search).toHaveClass(/ng-valid/);
  await search.fill('TESTE-001');
  await page.getByLabel('Situação', { exact: true }).selectOption('APROVADA');
  const pagination = page.getByRole('navigation', { name: 'Paginação' });
  await expect.poll(() => queries.at(-1)?.get('status')).toBe('APROVADA');
  await expect(pagination).toContainText('1–25 de 26');
  await pagination.getByRole('button', { name: 'Próxima' }).click();
  await expect(pagination).toContainText('1–25 de 25');
  await expect(page.getByRole('link', { name: 'Ver solicitação' })).toHaveCount(25);
  await expect(page.getByRole('heading', { name: 'Nenhuma saída encontrada' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Longas', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(search).toHaveValue('TESTE-001');
  await expect(page.getByLabel('Situação', { exact: true })).toHaveValue('APROVADA');
  expect(queries.slice(-2).map((params) => params.get('offset'))).toEqual(['25', '0']);
  for (const query of queries.slice(-2)) {
    expect(query.get('search')).toBe('TESTE-001');
    expect(query.get('status')).toBe('APROVADA');
  }
});

test('situação Aprovada permanece no retorno à lista longa e limpa ao trocar modalidade', async ({
  page,
}) => {
  await mockApi(page, { role: 'supervisor', exits: [{ ...exitFixture(), status: 'APROVADA' }] });
  await page.goto('/saidas?tipo=longa');
  await page.getByLabel('Situação', { exact: true }).selectOption('APROVADA');
  const filtered = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === '/api/v1/saidas-longas' && url.searchParams.get('status') === 'APROVADA'
    );
  });
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await filtered;
  await page.getByRole('link', { name: 'Ver solicitação' }).click();
  await expect(page.getByRole('heading', { name: 'Solicitação de saída longa' })).toBeVisible();
  const restored = page.waitForRequest(
    (request) => new URL(request.url()).pathname === '/api/v1/saidas-longas',
  );
  await page.getByRole('link', { name: '← Saídas longas', exact: true }).click();
  await expect(page.getByLabel('Situação', { exact: true })).toHaveValue('APROVADA');
  expect(new URL((await restored).url()).searchParams.get('status')).toBe('APROVADA');
  await expect(page.getByRole('link', { name: 'Ver solicitação' })).toHaveCount(1);
  await page.getByRole('link', { name: 'Curtas', exact: true }).click();
  await expect(page.getByLabel('Situação', { exact: true })).toHaveValue('');
  await page.getByRole('link', { name: 'Longas', exact: true }).click();
  await expect(page.getByLabel('Situação', { exact: true })).toHaveValue('');
});

test('residente cria NOW, mantém revisão persistida no mock e edição substitui documento', async ({
  page,
}) => {
  const state = await mockApi(page, { role: 'residente', exits: [], providersEnabled: false });
  await page.goto('/saidas?tipo=longa');
  await page.getByRole('link', { name: 'Solicitar saída longa' }).click();
  await page.getByLabel('Responsável para o convite').selectOption(guardianId);
  await page.getByLabel('Retorno previsto').fill('2026-09-30T16:00');
  await page.getByLabel('Motivo da saída').fill('Visita à família sintética');
  await page.getByRole('button', { name: 'Enviar solicitação de saída longa' }).click();
  await expect(
    page.getByText('A saída longa deve durar mais de 3 horas.', { exact: false }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.getByLabel('Retorno previsto').fill('2026-09-30T19:00');
  await page.getByRole('button', { name: 'Enviar solicitação de saída longa' }).click();
  await expect(page).toHaveURL(new RegExp(`/saidas/longas/${exitId}`));
  expect(state.writes[0].body).toMatchObject({
    departureMode: 'NOW',
    guardianId,
    expectedReturnAt: '2026-09-30T22:00:00.000Z',
  });
  expect(state.writes[0].body).not.toHaveProperty('requestedDepartureAt');
  expect(state.writes[0].body).not.toHaveProperty('version');
  expect(state.writes[0].headers['x-csrf-token']).toBe('synthetic-csrf');
  expect(state.paths).not.toContain('/api/v1/responsaveis');
  await expect(page.getByText('Serviço de assinatura indisponível', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('link', { name: 'Editar solicitação', exact: true }).click();
  await expect(page.getByText('invalida', { exact: false }).first()).toBeVisible();
  await page.getByLabel('Motivo da saída').fill('Consulta familiar em novo período');
  await page.getByRole('button', { name: 'Salvar alterações e gerar nova revisão' }).click();
  await expect(page.getByRole('heading', { name: 'Documento · revisão 2' })).toBeVisible();
  expect(state.writes[1].body.version).toBe(1);
  expect(state.exits[0].history.map((item) => item.event)).toEqual(['CREATE', 'EDIT']);
  await expect(page.getByRole('button', { name: 'Registrar partida presencial' })).toHaveCount(0);
});

test('cadastro de responsável inválido e falha da API bloqueiam pedido sem dados demonstrativos', async ({
  page,
}) => {
  const state = await mockApi(page, { role: 'residente', guardiansEligible: false });
  await page.goto('/saidas/longas/nova');
  await expect(page.getByRole('heading', { name: 'Solicitação indisponível' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar solicitação de saída longa' })).toHaveCount(
    0,
  );
  state.guardiansEligible = true;
  state.failReads = true;
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Não foi possível carregar a solicitação' }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  state.failReads = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByLabel('Responsável para o convite')).toBeVisible();
});

test('convite lido não habilita aprovação; supervisor rejeita antes da assinatura com justificativa', async ({
  page,
}) => {
  const state = await mockApi(page);
  await page.goto(`/saidas/longas/${exitId}`);
  await expect(page.getByRole('button', { name: 'Aprovar saída longa' })).toBeDisabled();
  await expect(page.getByText('Convite lido', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Rejeitar solicitação' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Justificativa', { exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Rejeitar solicitação' })).toBeFocused();
  expect(state.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Rejeitar solicitação' }).click();
  await dialog.getByRole('button', { name: 'Confirmar rejeição' }).click();
  await expect(dialog.getByText('Informe uma justificativa', { exact: false })).toBeVisible();
  await dialog
    .getByLabel('Justificativa', { exact: true })
    .fill('Pedido incompatível com atividade escolar');
  await dialog.getByRole('button', { name: 'Confirmar rejeição' }).click();
  await expect(page.getByText('Rejeição registrada.', { exact: true })).toBeVisible();
  expect(state.writes[0].body).toEqual({
    version: 0,
    decision: 'REJECT',
    comment: 'Pedido incompatível com atividade escolar',
  });
});

test('aprovação usa revisão atual; partida NOW e retorno retroativo preservam horário físico e de registro', async ({
  page,
}) => {
  const exit = exitFixture();
  exit.signatureStatus = 'VALID';
  exit.currentDocument!.signedState = 'STORED';
  const state = await mockApi(page, { exits: [exit] });
  await page.goto(`/saidas/longas/${exitId}`);
  await page.getByRole('button', { name: 'Aprovar saída longa' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar aprovação' }).click();
  await page.getByRole('button', { name: 'Registrar partida presencial' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmar partida', exact: true })
    .click();
  await expect(page.getByText('Partida presencial registrada.', { exact: true })).toBeVisible();
  state.now = '2026-09-30T23:30:00Z';
  await page.getByRole('button', { name: 'Confirmar retorno presencial' }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByText('O retorno está após o horário previsto.', { exact: false }),
  ).toBeVisible();
  await dialog.getByLabel('Horário do registro').selectOption('RETROACTIVE');
  await dialog.getByLabel('Horário real do retorno').fill('2026-09-30T20:00');
  await dialog
    .getByLabel('Justificativa', { exact: true })
    .fill('Registro após conferência presencial');
  await dialog
    .getByLabel('Observação do atraso', { exact: true })
    .fill('Transporte retornou após o horário previsto');
  await dialog.getByRole('button', { name: 'Confirmar retorno', exact: true }).click();
  await expect(page.getByText('Retorno presencial registrado.', { exact: true })).toBeVisible();
  expect(state.writes[0].body).toEqual({
    version: 0,
    decision: 'APPROVE',
    documentVersionId: documentId,
  });
  expect(state.writes[1].body).toEqual({ version: 1, timeMode: 'NOW' });
  expect(state.writes[2].body).toEqual({
    version: 2,
    timeMode: 'RETROACTIVE',
    occurredAt: '2026-09-30T23:00:00.000Z',
    justification: 'Registro após conferência presencial',
    lateObservation: 'Transporte retornou após o horário previsto',
  });
  expect(state.exits[0].returnRecordedAt).toBe('2026-09-30T23:30:00Z');
  expect(state.exits[0].status).toBe('RETORNO_CONFIRMADO_COM_ATRASO');
  await expect(page.getByText('Registrado em 30/09/2026, 20:30', { exact: true })).toBeVisible();
});

test('resultado incerto exige conferência; reenvio com limite e conflito congela ações até recarga explícita', async ({
  page,
}) => {
  const exit = exitFixture();
  exit.signatureStatus = 'UNCERTAIN';
  exit.messageStatus = 'UNCERTAIN';
  const state = await mockApi(page, { exits: [exit] });
  await page.goto(`/saidas/longas/${exitId}`);
  await expect(
    page.getByRole('button', { name: 'Reenviar convite ao responsável' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Solicitar conferência da assinatura' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Solicitar conferência', exact: true })
    .click();
  await expect(page.getByText('Conferência solicitada.', { exact: false })).toBeVisible();
  expect(state.writes[0].body).toEqual({ version: 0 });
  exit.signatureStatus = 'FAILED';
  exit.messageStatus = 'FAILED';
  await page.getByRole('button', { name: 'Atualizar dados' }).click();
  state.conflict = true;
  await page.getByRole('button', { name: 'Reenviar convite ao responsável' }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Justificativa', { exact: true })
    .fill('Telefone conferido com o responsável');
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar reenvio' }).click();
  await expect(page.getByRole('button', { name: 'Recarregar solicitação' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Reenviar convite ao responsável' }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(2);
  await page.getByRole('button', { name: 'Recarregar solicitação' }).click();
  await page.getByRole('button', { name: 'Reenviar convite ao responsável' }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Justificativa', { exact: true })
    .fill('Telefone conferido com o responsável');
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar reenvio' }).click();
  await expect(page.getByText('Reenvio solicitado.', { exact: false })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Reenviar convite ao responsável' }),
  ).toBeDisabled();
  expect(state.writes[2].body).toEqual({
    version: 1,
    comment: 'Telefone conferido com o responsável',
  });
});

test('convite público usa capability sem cookies e callback do widget não fabrica confirmação', async ({
  page,
  baseURL,
}) => {
  const state = await mockApi(page);
  await page
    .context()
    .addCookies([{ name: 'JSESSIONID', value: 'synthetic-session', url: baseURL! }]);
  await page.goto(`/assinatura/acesso#token=${token}`);
  await expect(page.getByRole('heading', { name: 'Revise a autorização de saída' })).toBeVisible();
  await expect(page).toHaveURL(/\/assinatura\/acesso$/);
  await expect(page.getByRole('button', { name: 'Abrir assinatura na Clicksign' })).toBeDisabled();
  expect(state.widgetRequests).toHaveLength(0);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar documento original' }).click();
  expect((await downloading).suggestedFilename()).toBe(
    `sager-saida-longa-${documentId}-original.pdf`,
  );
  await page.getByRole('checkbox', { name: 'Li o documento original' }).check();
  await page.getByRole('button', { name: 'Abrir assinatura na Clicksign' }).click();
  await page.getByRole('button', { name: 'Concluir no provedor de teste' }).click();
  await expect(
    page.getByText('O serviço informou a conclusão da assinatura.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByText('Aguardando assinatura', { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  expect(
    state.publicReads.every(
      (read) =>
        read.method === 'GET' &&
        read.headers['authorization'] === `Bearer ${token}` &&
        !read.headers['cookie'] &&
        !read.headers['x-csrf-token'] &&
        !read.headers['referer'],
    ),
  ).toBe(true);
  expect(state.widgetRequests).toHaveLength(1);
  expect(state.widgetRequests[0].url).not.toContain(token);
  expect(state.widgetRequests[0].headers['referer']).toBeUndefined();
  const storage = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
      history: history.state,
    }),
  );
  expect(storage).not.toContain(token);
  state.invitation.signatureStatus = 'VALID';
  state.invitation.widget.available = false;
  state.invitation.widget.signerId = null;
  state.invitation.widget.environment = null;
  await page.getByRole('button', { name: 'Atualizar situação' }).click();
  await expect(
    page.getByText('Assinatura confirmada pelo servidor', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Concluir no provedor de teste' })).toHaveCount(0);
  state.publicStatus = 410;
  await page.getByRole('button', { name: 'Atualizar situação' }).click();
  await expect(page.getByRole('heading', { name: 'Convite indisponível' })).toBeVisible();
  await expect(page.getByText('Estudante Sintético', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tentar novamente' })).toHaveCount(0);
  expect(await page.locator('body').innerText()).not.toContain(token);
});

test('convite ausente ou revogado falha fechado; rota antiga sem demonstração não simula assinatura', async ({
  page,
}) => {
  const state = await mockApi(page);
  await page.goto('/assinatura/acesso');
  await expect(page.getByRole('heading', { name: 'Convite indisponível' })).toBeVisible();
  expect(state.publicReads).toHaveLength(0);
  await page.goto(`/assinatura/${token}`);
  await expect(page.getByRole('heading', { name: 'Convite indisponível' })).toBeVisible();
  await expect(page.getByText('Simulação sem validade jurídica.', { exact: true })).toHaveCount(0);
  state.invitation.widget.environment = 'https://evil.test';
  await page.goto(`/assinatura/acesso#token=${token}`);
  await expect(page.getByRole('heading', { name: 'Convite indisponível' })).toBeVisible();
  expect(state.widgetRequests).toHaveLength(0);
  state.invitation = invitationFixture();
  state.publicStatus = 410;
  await page.goto(`/assinatura/acesso#token=${token}`);
  await expect(
    page.getByText('Este convite expirou ou foi revogado.', { exact: false }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
});

test('revogação entre leitura do PDF e abertura bloqueia o widget e apaga dados do convite', async ({
  page,
}) => {
  const state = await mockApi(page);
  await page.goto(`/assinatura/acesso#token=${token}`);
  await page.getByRole('button', { name: 'Baixar documento original' }).click();
  await page.getByRole('checkbox', { name: 'Li o documento original' }).check();
  state.publicStatus = 410;
  await page.getByRole('button', { name: 'Abrir assinatura na Clicksign' }).click();
  await expect(page.getByRole('heading', { name: 'Convite indisponível' })).toBeVisible();
  await expect(page.getByText('Estudante Sintético', { exact: true })).toHaveCount(0);
  expect(state.widgetRequests).toHaveLength(0);
});

test('novo convite na mesma aba descarta uma resposta pendente da revisão anterior', async ({
  page,
}) => {
  await mockApi(page);
  const nextToken = 'B'.repeat(43);
  let releasePrevious!: () => void;
  let previousStarted!: () => void;
  const pendingPrevious = new Promise<void>((resolve) => {
    releasePrevious = resolve;
  });
  const startedPrevious = new Promise<void>((resolve) => {
    previousStarted = resolve;
  });
  await page.route('**/api/v1/assinaturas/acesso', async (route) => {
    if (route.request().headers()['authorization'] === `Bearer ${token}`) {
      previousStarted();
      await pendingPrevious;
      await route.fulfill({
        headers: { 'X-Test-Revision': 'previous' },
        json: invitationFixture(),
      });
    } else {
      await route.fulfill({
        json: {
          ...invitationFixture(),
          bindingId: '00000000-0000-0000-0000-000000000822',
          documentVersionId: '00000000-0000-0000-0000-000000000812',
          revisionNumber: 2,
          guardianName: 'Outro Responsável Sintético',
        },
      });
    }
  });
  await page.goto(`/assinatura/acesso#token=${token}`, { waitUntil: 'domcontentloaded' });
  await startedPrevious;
  await page.goto(`/assinatura/acesso#token=${nextToken}`);
  await expect(page.getByText('Outro Responsável Sintético · Mãe', { exact: true })).toBeVisible();
  const previousResponse = page.waitForResponse(
    (response) => response.headers()['x-test-revision'] === 'previous',
  );
  releasePrevious();
  await (await previousResponse).finished();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page.getByText('Outro Responsável Sintético · Mãe', { exact: true })).toBeVisible();
  await expect(page.getByText('Documento da revisão 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir assinatura na Clicksign' })).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: 'Li o documento original' })).not.toBeChecked();
  await expect(page).toHaveURL(/\/assinatura\/acesso$/);
});

test('institucional e convite a 320px têm leitura acessível, PDF privado e restrições de papel', async ({
  page,
}) => {
  const exit = exitFixture();
  exit.signatureStatus = 'VALID';
  exit.currentDocument!.signedState = 'STORED';
  const state = await mockApi(page, { exits: [exit] });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`/saidas/longas/${exitId}`);
  await expect(page.getByRole('heading', { name: 'Solicitação de saída longa' })).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar PDF assinado' }).click();
  expect((await downloading).suggestedFilename()).toBe(
    `sager-saida-longa-${documentId}-assinado.pdf`,
  );
  expect(state.paths).toContain(
    `/api/v1/saidas-longas/${exitId}/documentos/${documentId}/assinado`,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.goto(`/assinatura/acesso#token=${token}`);
  await expect(page.getByRole('heading', { name: 'Revise a autorização de saída' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  state.role = 'gestor';
  await page.goto(`/saidas/longas/${exitId}`);
  await expect(page).toHaveURL(/\/acesso-negado$/);
  state.role = 'supervisor';
  await page.goto('/saidas/longas/nova');
  await expect(page).toHaveURL(/\/acesso-negado$/);
  state.role = 'residente';
  await page.goto(`/saidas/longas/${exitId}`);
  await expect(page.getByRole('button', { name: 'Aprovar saída longa' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Registrar partida presencial' })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
