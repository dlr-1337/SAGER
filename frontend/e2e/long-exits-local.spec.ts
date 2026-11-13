import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';
import type {
  AuthorizationFile,
  LongExit,
  LongExitEligibility,
  ReceivedFile,
} from '../src/app/features/operations/long-exit.models';

const residentId = '00000000-0000-0000-0000-000000000041';
const guardianId = '00000000-0000-0000-0000-000000000051';
const exitId = '00000000-0000-0000-0000-000000000801';
const documentId = '00000000-0000-0000-0000-000000000811';
const bindingId = '00000000-0000-0000-0000-000000000821';
const fileId = '00000000-0000-0000-0000-000000000831';
const messageId = '00000000-0000-0000-0000-000000000841';
const supervisorAccount = '00000000-0000-0000-0000-000000000001';
const now = '2026-09-30T16:00:00Z';
const pdf = '%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/AAAMBAQAY3Y2wAAAAAElFTkSuQmCC',
  'base64',
);

function candidate(overrides: Partial<AuthorizationFile> = {}): AuthorizationFile {
  return {
    id: fileId,
    documentVersionId: documentId,
    bindingId,
    origin: 'WHATSAPP',
    state: 'CANDIDATE',
    mediaType: 'image/png',
    size: png.length,
    sha256: 'a'.repeat(64),
    senderPhone: '+5562999999999',
    senderDivergent: false,
    receivedAt: '2026-09-30T15:30:00Z',
    decidedBy: null,
    decidedByName: null,
    decidedAt: null,
    decisionReason: null,
    ...overrides,
  };
}
function receivedFile(overrides: Partial<ReceivedFile> = {}): ReceivedFile {
  return {
    messageId,
    senderPhone: '+5562988887777',
    fromGuardian: false,
    mediaState: 'STORED',
    failureCode: null,
    mediaType: 'image/png',
    size: png.length,
    receivedAt: '2026-09-30T15:40:00Z',
    ...overrides,
  };
}

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
      signedState: 'MISSING',
    },
    authorizationFiles: [],
    whatsappAvailable: true,
    deliveryUnconfirmed: false,
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
        verifiedBy: null,
        verifiedByName: null,
        failureCode: null,
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
      canAttachAuthorization: true,
      canDownloadOriginal: true,
      canDownloadSigned: false,
    },
    history: [],
  };
}
interface MockState {
  role: 'residente' | 'supervisor' | 'gestor';
  maiorDeIdade: boolean;
  now: string;
  exits: LongExit[];
  guardiansEligible: boolean;
  providersEnabled: boolean;
  canResend: boolean;
  conflict: boolean;
  failReads: boolean;
  conflictCode: string;
  signedMediaType: string;
  unlinked: ReceivedFile[];
  writes: { path: string; body: Record<string, any>; headers: Record<string, string> }[];
  paths: string[];
}
async function mockApi(page: Page, options: Partial<MockState> = {}): Promise<MockState> {
  const state: MockState = {
    role: 'supervisor',
    maiorDeIdade: false,
    now,
    exits: [exitFixture()],
    guardiansEligible: true,
    providersEnabled: true,
    canResend: true,
    conflict: false,
    failReads: false,
    conflictCode: 'stale_version',
    signedMediaType: 'application/pdf',
    unlinked: [],
    writes: [],
    paths: [],
    ...options,
  };
  const view = (exit: LongExit): LongExit => {
    const pending = exit.status === 'AGUARDANDO_ANALISE';
    const supervisor = state.role === 'supervisor';
    return {
      ...exit,
      now: state.now,
      authorizationFiles: supervisor ? exit.authorizationFiles : [],
      whatsappAvailable: state.providersEnabled,
      capabilities: {
        canEdit: pending && state.role === 'residente',
        canApprove:
          pending &&
          supervisor &&
          exit.signatureStatus === 'VALID' &&
          exit.currentDocument?.signedState === 'STORED',
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
        canAttachAuthorization: supervisor && pending && exit.signatureStatus !== 'VALID',
        canDownloadOriginal: exit.currentDocument?.originalState === 'STORED',
        canDownloadSigned: exit.currentDocument?.signedState === 'STORED',
      },
    };
  };
  const history = (exit: LongExit, event: string, body: Record<string, any>) => {
    exit.version++;
    exit.updatedAt = state.now;
    const {
      history: previousHistory,
      capabilities,
      bindings,
      authorizationFiles,
      currentDocument,
      ...snapshot
    } = exit;
    void previousHistory;
    void capabilities;
    void bindings;
    void authorizationFiles;
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
        maiorDeIdade: state.maiorDeIdade,
      });
    if (path === '/api/v1/auth/csrf')
      return ok({ headerName: 'X-CSRF-TOKEN', token: 'synthetic-csrf' });
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
          providers: { whatsappEnabled: state.providersEnabled },
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
      if (path.endsWith('/autorizacao/nao-vinculados')) return ok(state.unlinked);
      if (path.includes('/autorizacao/arquivos/')) {
        const file = state.exits
          .flatMap((exit) => exit.authorizationFiles)
          .find((item) => path.endsWith(item.id));
        return file?.mediaType === 'application/pdf'
          ? route.fulfill({ contentType: 'application/pdf', body: pdf })
          : route.fulfill({ contentType: 'image/png', body: png });
      }
      if (path.endsWith('/assinado') && state.signedMediaType === 'image/png')
        return route.fulfill({ contentType: 'image/png', body: png });
      if (path.includes('/documentos/'))
        return route.fulfill({ contentType: 'application/pdf', body: pdf });
      const item = state.exits.find((exit) => path === `/api/v1/saidas-longas/${exit.id}`);
      return item ? ok(view(item)) : route.fulfill({ status: 404 });
    }
    const multipart = request.headers()['content-type']?.startsWith('multipart/form-data');
    const body = (multipart ? {} : request.postDataJSON()) as Record<string, any>;
    state.writes.push({ path, body, headers: request.headers() });
    if (state.conflict) {
      state.conflict = false;
      return route.fulfill({
        status: 409,
        json: { code: state.conflictCode, message: 'Mensagem do servidor sobre o conflito.' },
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
      });
      exit.currentDocument = {
        documentVersionId: '00000000-0000-0000-0000-000000000812',
        revisionNumber: 2,
        originalState: 'STORED',
        signedState: 'MISSING',
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
    } else if (action === 'arquivos') {
      exit.authorizationFiles.push(
        candidate({
          id: `00000000-0000-0000-0000-00000000085${exit.authorizationFiles.length}`,
          origin: 'MANUAL',
          mediaType: 'application/pdf',
          senderPhone: null,
          receivedAt: state.now,
        }),
      );
      history(exit, 'AUTHORIZATION_LINKED', body);
    } else if (action === 'vinculos') {
      state.unlinked = state.unlinked.filter((item) => item.messageId !== body.messageId);
      exit.authorizationFiles.push(candidate({ senderDivergent: true }));
      history(exit, 'AUTHORIZATION_LINKED', body);
    } else if (action === 'conferencia') {
      const file = exit.authorizationFiles.find((item) => path.includes(item.id))!;
      Object.assign(file, {
        state: 'ACCEPTED',
        decidedBy: supervisorAccount,
        decidedByName: 'Ana Supervisora',
        decidedAt: state.now,
        decisionReason: body.justification ?? null,
      });
      Object.assign(exit.bindings[0], {
        status: 'VALID',
        signedAt: file.receivedAt,
        verifiedAt: state.now,
        verifiedBy: supervisorAccount,
        verifiedByName: 'Ana Supervisora',
      });
      exit.signatureStatus = 'VALID';
      exit.signedAt = file.receivedAt;
      exit.currentDocument!.signedState = 'STORED';
      history(exit, 'AUTHORIZATION_CONFIRMED', body);
    } else if (action === 'recusa') {
      const file = exit.authorizationFiles.find((item) => path.includes(item.id))!;
      Object.assign(file, {
        state: 'REFUSED',
        decidedBy: supervisorAccount,
        decidedByName: 'Ana Supervisora',
        decidedAt: state.now,
        decisionReason: body.comment,
      });
      history(exit, 'AUTHORIZATION_REFUSED', body);
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
  await expect(page.getByRole('link', { name: 'Ver pedido' })).toHaveCount(25);
  await expect(page.getByRole('heading', { name: 'Nenhuma saída encontrada' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Saídas longas', exact: true })).toHaveAttribute(
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
  await page.getByRole('link', { name: 'Ver pedido' }).click();
  await expect(page.getByRole('heading', { name: 'Pedido de saída longa' })).toBeVisible();
  const restored = page.waitForRequest(
    (request) => new URL(request.url()).pathname === '/api/v1/saidas-longas',
  );
  await page.getByRole('link', { name: '← Saídas longas', exact: true }).click();
  await expect(page.getByLabel('Situação', { exact: true })).toHaveValue('APROVADA');
  expect(new URL((await restored).url()).searchParams.get('status')).toBe('APROVADA');
  await expect(page.getByRole('link', { name: 'Ver pedido' })).toHaveCount(1);
  await page.getByRole('link', { name: 'Saídas curtas', exact: true }).click();
  await expect(page.getByLabel('Situação', { exact: true })).toHaveValue('');
  await page.getByRole('link', { name: 'Saídas longas', exact: true }).click();
  await expect(page.getByLabel('Situação', { exact: true })).toHaveValue('');
});

test('residente cria NOW, mantém revisão persistida no mock e edição substitui documento', async ({
  page,
}) => {
  const state = await mockApi(page, { role: 'residente', exits: [], providersEnabled: false });
  await page.goto('/saidas?tipo=longa');
  await page.getByRole('link', { name: 'Pedir saída longa' }).click();
  await page.getByLabel('Quem vai autorizar?').selectOption(guardianId);
  await page.getByLabel('Que horas você volta?').fill('2026-09-30T16:00');
  await page.getByLabel('Por que você quer sair?').fill('Visita à família sintética');
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'A saída longa precisa durar mais de 3 horas.',
  );
  expect(state.writes).toHaveLength(0);
  await page.getByLabel('Que horas você volta?').fill('2026-09-30T19:00');
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
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
  await expect(
    page.getByText('WhatsApp indisponível; autorização por outro canal', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('link', { name: 'Mudar pedido', exact: true }).click();
  await expect(page.getByText('precisa autorizar de novo', { exact: false }).first()).toBeVisible();
  await page.getByLabel('Por que você quer sair?').fill('Consulta familiar em novo período');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('heading', { name: 'Documento atual' })).toBeVisible();
  expect(state.writes[1].body.version).toBe(1);
  expect(state.exits[0].history.map((item) => item.event)).toEqual(['CREATE', 'EDIT']);
  await expect(page.getByRole('button', { name: 'Registrar saída' })).toHaveCount(0);
});

test('saída longa agendada começa sem partida, sugere 4 h e preserva o retorno manual', async ({
  page,
}) => {
  const state = await mockApi(page, {
    role: 'residente',
    exits: [],
    now: '2026-09-30T16:00:20Z',
  });
  await page.goto('/saidas/longas/nova');
  const departure = page.getByLabel('Data e hora de saída');
  const expectedReturn = page.getByLabel('Que horas você volta?');
  await page.getByLabel('Quem vai autorizar?').selectOption(guardianId);
  await page.getByLabel('Por que você quer sair?').fill('Visita à família sintética');
  await page.getByLabel('Quando você quer sair?').selectOption('SCHEDULED');
  await expect(departure).toHaveValue('');
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(page.getByText('Informe a data e hora de saída.', { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await departure.fill('2026-09-30T14:00');
  await expect(expectedReturn).toHaveValue('2026-09-30T18:00');
  await expect(expectedReturn).toHaveAttribute('min', '2026-09-30T17:01');
  await expect(
    page.getByText('Duração: 4 h (mínimo: mais de 3 h).', { exact: true }),
  ).toBeVisible();
  await expectedReturn.fill('2026-09-30T20:00');
  await departure.fill('2026-09-30T14:30');
  await expect(expectedReturn).toHaveValue('2026-09-30T20:00');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(page).toHaveURL(new RegExp(`/saidas/longas/${exitId}`));
  expect(state.writes[0].body).toMatchObject({
    departureMode: 'SCHEDULED',
    requestedDepartureAt: '2026-09-30T17:30:00.000Z',
    expectedReturnAt: '2026-09-30T23:00:00.000Z',
  });
});

test('cadastro de responsável inválido e falha da API bloqueiam pedido sem dados demonstrativos', async ({
  page,
}) => {
  const state = await mockApi(page, { role: 'residente', guardiansEligible: false });
  await page.goto('/saidas/longas/nova');
  await expect(
    page.getByRole('heading', { name: 'Você não pode pedir esta saída agora' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar pedido' })).toHaveCount(0);
  state.guardiansEligible = true;
  state.failReads = true;
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Não foi possível carregar o pedido' }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  state.failReads = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByLabel('Quem vai autorizar?')).toBeVisible();
});

test('documento lido não habilita aprovação; supervisor rejeita antes da conferência com justificativa', async ({
  page,
}) => {
  const state = await mockApi(page);
  await page.goto(`/saidas/longas/${exitId}`);
  await expect(page.getByRole('button', { name: 'Aprovar saída longa' })).toBeDisabled();
  await expect(page.getByText('Documento lido', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Rejeitar pedido' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Justificativa', { exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Rejeitar pedido' })).toBeFocused();
  expect(state.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Rejeitar pedido' }).click();
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
  await page.getByRole('button', { name: 'Registrar saída' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmar saída', exact: true })
    .click();
  await expect(page.getByText('Saída registrada.', { exact: true })).toBeVisible();
  state.now = '2026-09-30T23:30:00Z';
  await page.getByRole('button', { name: 'Registrar volta' }).click();
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
  await dialog.getByRole('button', { name: 'Confirmar volta', exact: true }).click();
  await expect(page.getByText('Volta registrada.', { exact: true })).toBeVisible();
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

test('resultado incerto bloqueia reenvio; reenvio com limite e conflito congela ações até recarga explícita', async ({
  page,
}) => {
  const exit = exitFixture();
  exit.signatureStatus = 'UNCERTAIN';
  exit.messageStatus = 'UNCERTAIN';
  const state = await mockApi(page, { exits: [exit] });
  await page.goto(`/saidas/longas/${exitId}`);
  await expect(
    page.getByRole('button', { name: 'Reenviar documento ao responsável' }),
  ).toBeDisabled();
  exit.signatureStatus = 'FAILED';
  exit.messageStatus = 'FAILED';
  exit.bindings[0].failureCode = 'recipient_not_found';
  await page.getByRole('button', { name: 'Atualizar dados' }).click();
  await expect(page.getByText('O telefone do responsável não tem WhatsApp.')).toBeVisible();
  state.conflict = true;
  await page.getByRole('button', { name: 'Reenviar documento ao responsável' }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Justificativa', { exact: true })
    .fill('Telefone conferido com o responsável');
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar reenvio' }).click();
  await expect(page.getByRole('button', { name: 'Recarregar dados' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Reenviar documento ao responsável' }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(1);
  await page.getByRole('button', { name: 'Recarregar dados' }).click();
  await page.getByRole('button', { name: 'Reenviar documento ao responsável' }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Justificativa', { exact: true })
    .fill('Telefone conferido com o responsável');
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar reenvio' }).click();
  await expect(page.getByText('Reenvio solicitado.', { exact: false })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Reenviar documento ao responsável' }),
  ).toBeDisabled();
  expect(state.writes[1].body).toEqual({
    version: 0,
    comment: 'Telefone conferido com o responsável',
  });
});

test('arquivo recebido não aprova; conferência registra quem e quando e libera a decisão separada', async ({
  page,
}) => {
  const exit = exitFixture();
  exit.authorizationFiles = [candidate()];
  const state = await mockApi(page, { exits: [exit], signedMediaType: 'image/png' });
  await page.goto(`/saidas/longas/${exitId}`);
  await expect(page.getByRole('button', { name: 'Aprovar saída longa' })).toBeDisabled();
  await expect(page.getByText('Aguardando conferência', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /Imagem recebida em/ })).toHaveJSProperty(
    'naturalWidth',
    1,
  );
  await page.getByRole('button', { name: /Confirmar conferência do arquivo/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('00000000', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirmar conferência' }).click();
  await expect(dialog.getByText('Marque a declaração para continuar.')).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await dialog
    .getByLabel(/Declaro que conferi o responsável e o documento com o código 00000000/)
    .check();
  await dialog.getByRole('button', { name: 'Confirmar conferência' }).click();
  await expect(
    page.getByText('Autorização conferida. A aprovação', { exact: false }),
  ).toBeVisible();
  expect(state.writes[0].path).toBe(
    `/api/v1/saidas-longas/${exitId}/autorizacao/arquivos/${fileId}/conferencia`,
  );
  expect(state.writes[0].body).toEqual({ version: 0, confirmed: true });
  expect(exit.status).toBe('AGUARDANDO_ANALISE');
  await expect(page.getByText('Ana Supervisora', { exact: true })).toBeVisible();
  await expect(page.getByText(/Conferido em .* por Ana Supervisora/)).toBeVisible();
  await expect(page.getByText(supervisorAccount)).toHaveCount(0);
  await expect(page.getByRole('main')).not.toContainText(/assinatura válida/i);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar autorização conferida' }).click();
  expect((await downloading).suggestedFilename()).toBe(
    `sager-saida-longa-${documentId}-autorizacao.png`,
  );
  await page.getByRole('button', { name: 'Aprovar saída longa' }).click();
  await dialog.getByRole('button', { name: 'Confirmar aprovação' }).click();
  await expect(page.getByText('Pedido aprovado.', { exact: false })).toBeVisible();
  expect(state.writes[1].body).toEqual({
    version: 1,
    decision: 'APPROVE',
    documentVersionId: documentId,
  });
});

test('remetente divergente exige justificativa; recusa mantém o pedido aguardando autorização', async ({
  page,
}) => {
  const exit = exitFixture();
  const refused = '00000000-0000-0000-0000-000000000832';
  exit.authorizationFiles = [
    candidate({ senderDivergent: true }),
    candidate({ id: refused, mediaType: 'application/pdf' }),
  ];
  const state = await mockApi(page, { exits: [exit] });
  await page.goto(`/saidas/longas/${exitId}`);
  await page
    .getByRole('button', { name: /Recusar arquivo/ })
    .nth(1)
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Justificativa', { exact: true }).fill('Foto ilegível do documento');
  await dialog.getByRole('button', { name: 'Confirmar recusa' }).click();
  await expect(page.getByText('Arquivo recusado', { exact: true })).toBeVisible();
  await expect(page.getByText('Foto ilegível do documento', { exact: true }).first()).toBeVisible();
  expect(state.writes[0].path).toContain(`/autorizacao/arquivos/${refused}/recusa`);
  expect(state.writes[0].body).toEqual({ version: 0, comment: 'Foto ilegível do documento' });
  await expect(page.getByRole('button', { name: 'Aprovar saída longa' })).toBeDisabled();
  await expect(page.getByText('O telefone de origem é diferente', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: /Confirmar conferência do arquivo/ }).click();
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Confirmar conferência' }).click();
  await expect(dialog.getByText('Informe uma justificativa', { exact: false })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await dialog
    .getByLabel('Justificativa', { exact: true })
    .fill('Responsável confirmou por telefone que usou outro aparelho');
  await dialog.getByRole('button', { name: 'Confirmar conferência' }).click();
  await expect(
    page.getByText('Autorização conferida. A aprovação', { exact: false }),
  ).toBeVisible();
  expect(state.writes[1].body).toEqual({
    version: 1,
    confirmed: true,
    justification: 'Responsável confirmou por telefone que usou outro aparelho',
  });
});

test('WhatsApp desligado: anexo manual em multipart com CSRF, sem link de conversa e com limite de tamanho', async ({
  page,
}) => {
  const exit = exitFixture();
  exit.signatureStatus = 'UNAVAILABLE';
  exit.messageStatus = 'UNAVAILABLE';
  const state = await mockApi(page, { exits: [exit], providersEnabled: false });
  await page.goto(`/saidas/longas/${exitId}`);
  await expect(page.getByText('O WhatsApp está indisponível.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir conversa com o responsável' })).toHaveCount(0);
  const input = page.getByLabel('Anexar arquivo recebido por outro meio');
  await input.setInputFiles({
    name: 'grande.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  await expect(page.getByText('mais de 10 MB', { exact: false }).first()).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await input.setInputFiles({
    name: 'autorizacao.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(pdf),
  });
  await expect(page.getByText('Anexado por supervisor', { exact: true })).toBeVisible();
  expect(state.writes[0].path).toBe(`/api/v1/saidas-longas/${exitId}/autorizacao/arquivos`);
  expect(state.writes[0].headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
  expect(state.writes[0].headers['x-csrf-token']).toBe('synthetic-csrf');
  await expect(page.getByRole('img', { name: /Imagem recebida em/ })).toHaveCount(0);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: /Baixar arquivo recebido em/ }).click();
  expect((await downloading).suggestedFilename()).toMatch(/-autorizacao-recebida\.pdf$/);
});

test('sem confirmação de entrega avisa; arquivo sem vínculo é escolhido pelo supervisor e conflito explica a causa', async ({
  page,
}) => {
  const exit = exitFixture();
  exit.deliveryUnconfirmed = true;
  const state = await mockApi(page, {
    exits: [exit],
    conflict: true,
    conflictCode: 'already_linked',
    unlinked: [
      receivedFile(),
      receivedFile({
        messageId: '00000000-0000-0000-0000-000000000842',
        fromGuardian: true,
        mediaState: 'FAILED',
        mediaType: null,
        size: 0,
      }),
    ],
  });
  await page.goto(`/saidas/longas/${exitId}`);
  await expect(
    page.getByText('segue sem confirmação de entrega após 15 minutos', { exact: false }),
  ).toBeVisible();
  const conversation = page.getByRole('link', { name: 'Abrir conversa com o responsável' });
  await expect(conversation).toHaveAttribute('href', /\/conversas\?q=/);
  await page.mouse.move(0, 0);
  await expect(conversation).toHaveCSS('text-decoration-line', 'none');
  await conversation.hover();
  await expect(conversation).toHaveCSS('text-decoration-line', 'underline');
  await expect(page.getByText('Outro número', { exact: true })).toBeVisible();
  await expect(page.getByText('não pode ser vinculado', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: /Vincular a este pedido/ })).toHaveCount(1);
  await page.getByRole('button', { name: /Vincular a este pedido/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('número diferente do responsável', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirmar vínculo' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Mensagem do servidor' })).toBeVisible();
  await page.getByRole('button', { name: 'Recarregar dados' }).click();
  await page.getByRole('button', { name: /Vincular a este pedido/ }).click();
  await dialog.getByRole('button', { name: 'Confirmar vínculo' }).click();
  await expect(page.getByText('Arquivo vinculado. Ele ainda', { exact: false })).toBeVisible();
  expect(state.writes[1].path).toBe(`/api/v1/saidas-longas/${exitId}/autorizacao/vinculos`);
  expect(state.writes[1].body).toEqual({ version: 0, messageId });
  await expect(page.getByText('Aguardando conferência', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Vincular a este pedido/ })).toHaveCount(0);
});

test('saída longa a 320px tem leitura acessível, arquivos privados e restrições de papel', async ({
  page,
}) => {
  const exit = exitFixture();
  exit.deliveryUnconfirmed = true;
  exit.authorizationFiles = [candidate({ senderDivergent: true })];
  const state = await mockApi(page, { exits: [exit], unlinked: [receivedFile()] });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`/saidas/longas/${exitId}`);
  await expect(page.getByRole('heading', { name: 'Arquivos recebidos' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Vincular a este pedido/ })).toBeVisible();
  await expect(page.getByRole('img', { name: /Imagem recebida em/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: /Confirmar conferência do arquivo/ }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  exit.authorizationFiles = [];
  exit.signatureStatus = 'VALID';
  exit.currentDocument!.signedState = 'STORED';
  await page.reload();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar autorização conferida' }).click();
  expect((await downloading).suggestedFilename()).toBe(
    `sager-saida-longa-${documentId}-autorizacao.pdf`,
  );
  expect(state.paths).toContain(
    `/api/v1/saidas-longas/${exitId}/documentos/${documentId}/assinado`,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.goto('/assinatura/acesso');
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible();
  expect(state.paths.some((path) => path.startsWith('/api/v1/assinaturas'))).toBe(false);
  state.role = 'gestor';
  await page.goto(`/saidas/longas/${exitId}`);
  await expect(page).toHaveURL(/\/acesso-negado$/);
  state.role = 'supervisor';
  await page.goto('/saidas/longas/nova');
  await expect(page).toHaveURL(/\/acesso-negado$/);
  state.role = 'residente';
  await page.goto(`/saidas/longas/${exitId}`);
  await expect(page.getByRole('button', { name: 'Aprovar saída longa' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Registrar saída' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Autorização do responsável' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Arquivos recebidos' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Abrir conversa com o responsável' })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});

test('residente maior de idade abre a saída longa só para leitura', async ({ page }) => {
  const state = await mockApi(page, { role: 'residente', maiorDeIdade: true });
  for (const path of ['/saidas/longas/nova', `/saidas/longas/${exitId}/editar`]) {
    await page.goto(path);
    await expect(page).toHaveURL(/acesso-negado$/);
  }
  await page.goto(`/saidas/longas/${exitId}`);
  await expect(page.getByRole('heading', { name: 'Pedido de saída longa' })).toBeVisible();
  await expect(page.locator('.op-status')).toHaveText('Aguardando análise');
  await expect(page.getByRole('link', { name: 'Mudar pedido' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cancelar pedido' })).toHaveCount(0);
  expect(state.writes).toEqual([]);
});
