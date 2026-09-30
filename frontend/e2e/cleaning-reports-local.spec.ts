import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';
import type {
  CleaningAssessment,
  CleaningCriteria,
  CleaningPolicy,
} from '../src/app/features/cleaning/cleaning-local.models';
import type {
  ReportCatalog,
  ReportExport,
  ReportRow,
  ReportSnapshot,
} from '../src/app/features/reports/reports-local.models';

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const actorId = uuid(1),
  roomId = uuid(111),
  residentId = uuid(41),
  accommodationId = uuid(11),
  assessmentId = uuid(901),
  snapshotId = uuid(801);
const now = '2026-09-30T16:00:00Z';
const resident = {
  id: residentId,
  name: 'Estudante Sintético',
  enrollment: 'TESTE-001',
  birthDate: '2010-05-14',
  course: null,
  version: 0,
};
const room = {
  id: roomId,
  accommodationId,
  code: 'T-101',
  number: '101',
  unitId: null,
  floor: null,
  capacity: 2,
  situation: 'Ocupado',
  occupancy: 1,
  vacancies: 1,
  cleaningScore: null,
  version: 0,
};
const criteria: CleaningCriteria = { PISO: 6, SUPERFICIES: 6, RESIDUOS: 6, ORGANIZACAO: 6 };
const score = (values: CleaningCriteria) =>
  Math.floor(
    (Object.values(values).reduce((sum, value) => sum + Math.round(value * 10), 0) * 5 + 1) / 2,
  ) / 100;
function assessment(): CleaningAssessment {
  return {
    id: assessmentId,
    roomId,
    roomCode: room.code,
    accommodationId,
    evaluatedAt: now,
    assessmentDate: '2026-09-30',
    timeMode: 'NOW',
    criteria: { ...criteria },
    score: 6,
    observation: null,
    policyVersion: 1,
    version: 0,
    recordedAt: now,
    recordedBy: actorId,
    participants: [{ allocationId: uuid(301), residentId, residentName: resident.name }],
    revisions: [
      {
        version: 0,
        criteria: { ...criteria },
        score: 6,
        observation: null,
        reason: null,
        recordedAt: now,
        recordedBy: actorId,
      },
    ],
    feedback: {
      previousScore: null,
      newScore: 6,
      delta: null,
      periodMean: 6,
      position: 1,
      rankingReference: 'MONTH',
      from: '2026-09-01',
      to: '2026-09-30',
    },
  };
}
function ownAssessment(item: CleaningAssessment) {
  const {
    accommodationId: _a,
    timeMode: _t,
    policyVersion: _p,
    recordedAt: _r,
    recordedBy: _by,
    participants: _part,
    revisions: _rev,
    ...own
  } = item;
  return own;
}
const columns: ReportCatalog['items'][number]['columns'] = [
  { key: 'id', label: 'Identificador', type: 'UUID' },
  { key: 'date', label: 'Data', type: 'DATE' },
  { key: 'type', label: 'Tipo', type: 'STRING' },
  { key: 'status', label: 'Situação', type: 'STRING' },
  { key: 'residentId', label: 'Residente UUID', type: 'UUID' },
  { key: 'residentName', label: 'Residente', type: 'STRING' },
  { key: 'roomCode', label: 'Quarto', type: 'STRING' },
  { key: 'score', label: 'Nota', type: 'DECIMAL' },
  { key: 'category', label: 'Categoria', type: 'STRING' },
  { key: 'sourceType', label: 'Origem', type: 'STRING' },
];
const catalogs = {
  PRESENCA: ['PRESENTE', 'AUSENTE', 'AUSENCIA_JUSTIFICADA', 'PENDENTE', 'CHAMADA_ABERTA'],
  SAIDAS: ['RETORNO_CONFIRMADO_COM_ATRASO', 'APROVADA'],
  LIMPEZA: ['ABAIXO_LIMITE', 'DENTRO_LIMITE'],
  OCORRENCIAS: ['VALIDA', 'INVALIDADA'],
  NOTIFICACOES: ['PENDENTE', 'CONVERTIDA'],
  ADVERTENCIAS: ['VIGENTE', 'ANULADA'],
  TERMOS: ['EMITIDO', 'ANULADO'],
  CONSOLIDADO: [],
};
const catalog: ReportCatalog = {
  version: 1,
  items: Object.entries(catalogs).map(([code, statuses]) => ({
    code: code as ReportCatalog['items'][number]['code'],
    title:
      code === 'CONSOLIDADO'
        ? 'Consolidado administrativo'
        : code === 'TERMOS'
          ? 'Termos de compromisso'
          : code === 'PRESENCA'
            ? 'Presença'
            : code === 'LIMPEZA'
              ? 'Limpeza'
              : code,
    statuses,
    columns,
  })),
  maxPeriodDays: 366,
  maxRows: 10000,
  defaultPageSize: 20,
  maxPageSize: 100,
  expiresAfterHours: 24,
};
const summary = {
  totalRows: 21,
  countsByType: { PRESENCA: 19, SAIDAS: 1, ADVERTENCIAS: 1 },
  countsByStatus: { AUSENTE: 19, RETORNO_CONFIRMADO_COM_ATRASO: 1, VIGENTE: 1 },
  cleaningMean: null,
  unjustifiedAbsences: 19,
  confirmedLateReturns: 1,
  activeWarnings: 1,
};
function snapshot(): ReportSnapshot {
  return {
    id: snapshotId,
    catalogCode: 'CONSOLIDADO',
    catalogVersion: 1,
    filters: {
      from: '2026-09-01',
      to: '2026-09-30',
      accommodationId: null,
      roomId: null,
      residentId: null,
      status: null,
    },
    columns,
    rowCount: 21,
    summary: { ...summary },
    monthly: [{ month: '2026-09', ...summary }],
    contentHash: 'a'.repeat(64),
    asOf: now,
    expiresAt: '2026-10-01T16:00:00Z',
  };
}
function rows(): ReportRow[] {
  return Array.from({ length: 21 }, (_, i) => ({
    id: uuid(1000 + i),
    date: '2026-09-30',
    type: i === 20 ? 'ADVERTENCIAS' : i === 19 ? 'SAIDAS' : 'PRESENCA',
    status: i === 20 ? 'VIGENTE' : i === 19 ? 'RETORNO_CONFIRMADO_COM_ATRASO' : 'AUSENTE',
    residentId,
    residentName: resident.name,
    roomId,
    roomCode: room.code,
    accommodationId,
    score: null,
    category: i === 20 ? 'AUSENCIA' : null,
    sourceType: i === 19 ? 'LONG_RETURN' : 'NIGHT_CALL',
  }));
}
interface State {
  role: 'supervisor' | 'gestor' | 'residente';
  now: string;
  item: CleaningAssessment;
  snapshot: ReportSnapshot;
  rows: ReportRow[];
  exists: boolean;
  failReads: boolean;
  failWriteOnce: boolean;
  conflictOnce: boolean;
  expired: boolean;
  limit: boolean;
  leakRanking: boolean;
  jobs: Map<string, ReportExport>;
  writes: { path: string; body: Record<string, any>; csrf: string | undefined }[];
  gets: string[];
  files: string[];
}
async function mockApi(page: Page, options: Partial<State> = {}): Promise<State> {
  const state: State = {
    role: 'supervisor',
    now,
    item: assessment(),
    snapshot: snapshot(),
    rows: rows(),
    exists: true,
    failReads: false,
    failWriteOnce: false,
    conflictOnce: false,
    expired: false,
    limit: false,
    leakRanking: false,
    jobs: new Map(),
    writes: [],
    gets: [],
    files: [],
    ...options,
  };
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const method = request.method();
    const ok = (value: unknown) => route.fulfill({ json: value });
    if (path === '/auth/me')
      return ok({
        id: actorId,
        nome: state.role === 'residente' ? resident.name : 'Conta Sintética',
        email: 'sessao@example.test',
        fotoUrl: null,
        perfis: [state.role],
        residenteId: state.role === 'residente' ? residentId : null,
        supervisorId: state.role === 'supervisor' ? uuid(101) : null,
      });
    if (path === '/auth/csrf') return ok({ headerName: 'X-CSRF-TOKEN', token: 'synthetic-csrf' });
    if (path === '/auth/logout') return route.fulfill({ status: 204 });
    if (method === 'GET') {
      state.gets.push(path + url.search);
      if (state.failReads)
        return route.fulfill({ status: 503, json: { message: 'db-password-secret' } });
      if (path === '/limpeza/politica')
        return ok({
          version: 1,
          weights: { PISO: 0.25, SUPERFICIES: 0.25, RESIDUOS: 0.25, ORGANIZACAO: 0.25 },
          lowScoreThreshold: 6,
          zone: 'America/Sao_Paulo',
          now: state.now,
          currentDate: '2026-09-30',
        } satisfies CleaningPolicy);
      if (path === '/quartos') return ok([room]);
      if (path === '/residentes') return ok([resident]);
      if (path === '/alojamentos')
        return ok([{ id: accommodationId, code: 'T', name: 'Alojamento Sintético', version: 0 }]);
      if (path === '/limpeza/avaliacoes')
        return ok({ items: state.exists ? [state.item] : [], nextCursor: null });
      if (path === '/me/limpeza/avaliacoes')
        return ok({ items: state.exists ? [ownAssessment(state.item)] : [], nextCursor: null });
      if (path === '/limpeza/avaliacoes/' + assessmentId) return ok(state.item);
      if (path === '/me/limpeza/avaliacoes/' + assessmentId) return ok(ownAssessment(state.item));
      if (path === '/limpeza/ranking')
        return ok({
          period: url.searchParams.get('period'),
          referenceDate: url.searchParams.get('referenceDate'),
          from: '2026-09-01',
          to: '2026-09-30',
          items: [
            {
              roomId,
              roomCode: room.code,
              mean: 6,
              position: 1,
              assessmentCount: 1,
              own: state.role === 'residente',
            },
            {
              roomId: state.role === 'residente' ? null : uuid(112),
              roomCode: 'T-102',
              mean: state.role === 'residente' && !state.leakRanking ? null : 6,
              position: 1,
              assessmentCount: state.role === 'residente' ? null : 1,
              own: false,
            },
            {
              roomId: state.role === 'residente' ? null : uuid(113),
              roomCode: 'T-103',
              mean: state.role === 'residente' ? null : 4,
              position: 3,
              assessmentCount: state.role === 'residente' ? null : 1,
              own: false,
            },
            {
              roomId: state.role === 'residente' ? null : uuid(114),
              roomCode: 'T-104',
              mean: null,
              position: null,
              assessmentCount: state.role === 'residente' ? null : 0,
              own: false,
            },
          ],
        });
      if (path === '/limpeza/indicadores')
        return ok([
          { month: '2026-08', unjustifiedAbsences: 0, confirmedLateReturns: 2, activeWarnings: 1 },
          { month: '2026-09', unjustifiedAbsences: 3, confirmedLateReturns: 0, activeWarnings: 1 },
        ]);
      if (path === '/relatorios/catalogo') return ok(catalog);
      if (path === '/relatorios/consultas/' + snapshotId)
        return state.expired
          ? route.fulfill({ status: 410, json: { message: 'secret' } })
          : ok(state.snapshot);
      if (path === '/relatorios/consultas/' + snapshotId + '/linhas') {
        if (state.expired)
          return route.fulfill({ status: 410, json: { code: 'snapshot_expired' } });
        const offset = Number(url.searchParams.get('offset') ?? 0);
        const limit = Number(url.searchParams.get('limit'));
        return ok({
          snapshotId,
          offset,
          limit,
          total: state.snapshot.rowCount,
          nextOffset: offset + limit < state.rows.length ? offset + limit : null,
          items: state.rows.slice(offset, offset + limit),
        });
      }
      if (path.startsWith('/relatorios/exportacoes/')) {
        const id = path.split('/')[3];
        const job = state.jobs.get(id);
        if (!job) return route.fulfill({ status: 404, json: {} });
        if (path.endsWith('/arquivo')) {
          state.files.push(path);
          if (job.status !== 'READY') return route.fulfill({ status: 409, json: {} });
          return route.fulfill({
            body: job.format === 'PDF' ? '%PDF-1.7\n%%EOF' : 'PK\u0003\u0004synthetic-xlsx',
            contentType:
              job.format === 'PDF'
                ? 'application/pdf'
                : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
        }
        return ok(job);
      }
    } else {
      const body = request.postDataJSON();
      state.writes.push({ path, body, csrf: request.headers()['x-csrf-token'] });
      if (state.failWriteOnce) {
        state.failWriteOnce = false;
        return route.fulfill({ status: 503, json: { message: 'private-secret' } });
      }
      if (state.conflictOnce) {
        state.conflictOnce = false;
        return route.fulfill({ status: 409, json: { code: 'version_conflict' } });
      }
      if (path === '/limpeza/avaliacoes') {
        state.item = {
          ...assessment(),
          criteria: body.criteria,
          score: score(body.criteria),
          evaluatedAt: body.timeMode === 'NOW' ? state.now : body.evaluatedAt,
          timeMode: body.timeMode,
          observation: body.observation,
          recordedAt: state.now,
        };
        state.item.assessmentDate = '2026-09-30';
        state.item.feedback = {
          ...state.item.feedback,
          newScore: state.item.score,
          periodMean: state.item.score,
        };
        state.item.revisions = [
          {
            ...state.item.revisions[0],
            criteria: body.criteria,
            score: state.item.score,
            observation: body.observation,
            reason: body.registrationReason ?? null,
          },
        ];
        state.exists = true;
        return ok(state.item);
      }
      if (path === '/limpeza/avaliacoes/' + assessmentId + '/corrigir') {
        if (body.version !== state.item.version) return route.fulfill({ status: 409, json: {} });
        const previous = state.item.score;
        state.item = {
          ...state.item,
          criteria: body.criteria,
          score: score(body.criteria),
          observation: body.observation,
          version: state.item.version + 1,
          recordedAt: state.now,
        };
        state.item.revisions.push({
          version: state.item.version,
          criteria: body.criteria,
          score: state.item.score,
          observation: body.observation,
          reason: body.reason,
          recordedAt: state.now,
          recordedBy: actorId,
        });
        state.item.feedback = {
          ...state.item.feedback,
          previousScore: previous,
          newScore: state.item.score,
          delta: state.item.score - previous,
          periodMean: state.item.score,
        };
        return ok(state.item);
      }
      if (path === '/relatorios/consultas') {
        if (state.limit)
          return route.fulfill({
            status: 422,
            json: { code: 'report_limit_exceeded', message: 'private-secret' },
          });
        state.snapshot = {
          ...snapshot(),
          catalogCode: body.catalogCode,
          filters: {
            from: body.filters.from,
            to: body.filters.to,
            accommodationId: body.filters.accommodationId ?? null,
            roomId: body.filters.roomId ?? null,
            residentId: body.filters.residentId ?? null,
            status: body.filters.status ?? null,
          },
        };
        return ok(state.snapshot);
      }
      if (path === '/relatorios/consultas/' + snapshotId + '/exportacoes') {
        const id = body.format === 'PDF' ? uuid(701) : uuid(702);
        if (!state.jobs.has(id))
          state.jobs.set(id, {
            id,
            snapshotId,
            format: body.format,
            status: 'PENDING',
            createdAt: state.now,
            expiresAt: '2026-10-01T16:00:00Z',
            attempts: 0,
            errorCode: null,
            document: null,
          });
        return ok(state.jobs.get(id));
      }
    }
    return route.fulfill({ status: 404, json: { message: 'not available' } });
  });
  return state;
}
async function grades(page: Page, value = '6') {
  for (const label of ['Piso', 'Superfícies', 'Resíduos', 'Organização'])
    await page.getByRole('spinbutton', { name: label, exact: false }).fill(value);
}
async function confirm(page: Page, action: string) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: action, exact: true }).click();
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}
test.use({ timezoneId: 'Pacific/Auckland' });

test('supervisor registra quatro notas NOW, cancela revisão sem escrita e preserva registro após recarga', async ({
  page,
}) => {
  const state = await mockApi(page, { exists: false });
  await page.goto('/limpeza/nova');
  await expect(page.getByRole('heading', { name: 'Registrar avaliação de limpeza' })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Revisar registro', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'quatro critérios' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Quarto', exact: true }).selectOption(roomId);
  await grades(page, '0');
  await page.getByRole('spinbutton', { name: 'Piso', exact: false }).fill('0.1');
  await expect(page.getByText('Prévia da média:', { exact: false })).toContainText('0,03');
  const review = page.getByRole('button', { name: 'Revisar registro', exact: true });
  await review.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(review).toBeFocused();
  expect(state.writes).toHaveLength(0);
  await review.click();
  await confirm(page, 'Confirmar avaliação');
  await expect(page).toHaveURL(new RegExp('/limpeza/' + assessmentId + '$'));
  expect(state.writes[0].body).toMatchObject({
    roomId,
    timeMode: 'NOW',
    criteria: { PISO: 0.1, SUPERFICIES: 0, RESIDUOS: 0, ORGANIZACAO: 0 },
  });
  expect(state.writes[0].body).not.toHaveProperty('evaluatedAt');
  expect(state.writes[0].body).not.toHaveProperty('registrationReason');
  expect(state.writes[0].csrf).toBe('synthetic-csrf');
  await page.reload();
  await expect(page.getByText('Sem comparação anterior').first()).toBeVisible();
  await expect(page.getByText(resident.name, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
test('registro histórico exige instante não futuro e motivo; usa horário de São Paulo independente do navegador', async ({
  page,
}) => {
  const state = await mockApi(page, { exists: false });
  await page.goto('/limpeza/nova');
  await page.getByRole('combobox', { name: 'Quarto', exact: true }).selectOption(roomId);
  await grades(page);
  await page
    .getByRole('combobox', { name: 'Momento da avaliação', exact: true })
    .selectOption('RETROACTIVE');
  await page.getByLabel('Instante real da avaliação', { exact: false }).fill('2026-09-30T14:00');
  await page
    .getByLabel('Justificativa do registro histórico', { exact: false })
    .fill('Avaliação presencial conferida antes do registro.');
  await page.getByRole('button', { name: 'Revisar registro', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'não futuro' })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.getByLabel('Instante real da avaliação', { exact: false }).fill('2026-09-30T12:30');
  await page.getByRole('button', { name: 'Revisar registro', exact: true }).click();
  await confirm(page, 'Confirmar avaliação');
  await expect(page).toHaveURL(new RegExp(assessmentId));
  expect(state.writes[0].body).toMatchObject({
    timeMode: 'RETROACTIVE',
    evaluatedAt: '2026-09-30T15:30:00.000Z',
    registrationReason: 'Avaliação presencial conferida antes do registro.',
  });
});
test('correção motivada preserva instante e participantes, bloqueia versão alterada e exige recarga explícita', async ({
  page,
}) => {
  const state = await mockApi(page);
  await page.goto('/limpeza/' + assessmentId + '/corrigir');
  await expect(page.getByRole('heading', { name: 'Corrigir avaliação de limpeza' })).toBeVisible();
  await grades(page, '8');
  state.item.version = 1;
  await page.getByRole('button', { name: 'Revisar correção', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'avaliação mudou' })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await expect(page.getByRole('button', { name: 'Revisar correção', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Recarregar avaliação' }).click();
  await grades(page, '8');
  await page.getByRole('button', { name: 'Revisar correção', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Justificativa', { exact: true })
    .fill('Notas conferidas novamente com evidência presencial.');
  await confirm(page, 'Confirmar correção');
  await expect(page).toHaveURL(new RegExp('/limpeza/' + assessmentId + '$'));
  expect(state.writes[0].body.version).toBe(1);
  expect(state.writes[0].body).not.toHaveProperty('evaluatedAt');
  expect(state.item.participants[0].residentId).toBe(residentId);
  expect(state.item.evaluatedAt).toBe(now);
  await expect(
    page.getByText('Notas conferidas novamente com evidência presencial.'),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText('Versão 0 · nota 6,00')).toBeVisible();
});
test('residente consulta avaliações pela participação histórica e ranking omite notas dos outros quartos', async ({
  page,
}) => {
  const state = await mockApi(page, { role: 'residente' });
  await page.goto('/minha-limpeza');
  await expect(page.getByRole('heading', { name: 'Minhas avaliações de limpeza' })).toBeVisible();
  expect(state.gets.some((path) => path.startsWith('/me/limpeza/avaliacoes'))).toBe(true);
  expect(
    state.gets.some((path) => path.startsWith('/residentes') || path.startsWith('/quartos')),
  ).toBe(false);
  await page.getByRole('link', { name: 'Consultar avaliação', exact: false }).click();
  await expect(
    page.getByRole('heading', { name: 'Avaliação do quarto', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Participantes capturados')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Corrigir com justificativa' })).toHaveCount(0);
  await page.goto('/ranking');
  await expect(page.getByRole('heading', { name: 'Ranking interno de limpeza' })).toBeVisible();
  await expect(page.getByText('Nota privada do quarto')).toHaveCount(3);
  expect(state.writes).toHaveLength(0);
  state.leakRanking = true;
  await page.getByRole('button', { name: 'Consultar período', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Registros indisponíveis' })).toBeVisible();
  await expect(page.getByText('Classificação ilustrativa')).toHaveCount(0);
});
test('ranking usa posições e nulos do servidor, empates 1 1 3 e período explícito, sem fallback em falha', async ({
  page,
}) => {
  const state = await mockApi(page, { role: 'gestor' });
  await page.goto('/ranking');
  await expect(page.getByText('1º', { exact: true })).toHaveCount(2);
  await expect(page.getByText('3º', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Sem posição', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Sem avaliações no período', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Período', exact: true }).selectOption('SEMESTER');
  await page.getByRole('button', { name: 'Consultar período', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Semestre · 01/09/2026 a 30/09/2026' }),
  ).toBeVisible();
  expect(state.gets.some((path) => path.includes('period=SEMESTER'))).toBe(true);
  state.failReads = true;
  await page.getByRole('button', { name: 'Consultar período', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Registros indisponíveis' }),
  ).toBeVisible();
  await expect(page.getByText('Fórmula pendente da AE')).toHaveCount(0);
  await expect(page.getByText('db-password-secret')).toHaveCount(0);
});
test('catálogo filtra situações pertinentes, limite inclusivo e repete mesma intenção manual sem duplicar consulta', async ({
  page,
}) => {
  const state = await mockApi(page);
  await page.goto('/relatorios');
  await expect(page.getByRole('heading', { name: 'Relatórios', exact: true })).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Tipo de relatório', exact: true })
    .selectOption('TERMOS');
  await expect(
    page
      .getByRole('combobox', { name: 'Situação', exact: true })
      .getByRole('option', { name: 'Termo emitido', exact: true }),
  ).toHaveCount(1);
  await page.getByLabel('Data inicial', { exact: true }).fill('2025-01-01');
  await page.getByRole('button', { name: 'Revisar consulta', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '366 dias' })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.getByLabel('Data inicial', { exact: true }).fill('2026-09-01');
  await page
    .getByRole('combobox', { name: 'Alojamento', exact: true })
    .selectOption(accommodationId);
  await page.getByRole('combobox', { name: 'Quarto', exact: true }).selectOption(roomId);
  await page.getByRole('combobox', { name: 'Residente', exact: true }).selectOption(residentId);
  await page.getByRole('combobox', { name: 'Situação', exact: true }).selectOption('EMITIDO');
  state.failWriteOnce = true;
  await page.getByRole('button', { name: 'Revisar consulta', exact: true }).click();
  await confirm(page, 'Preparar consulta');
  await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível' })).toBeVisible();
  await page.getByRole('button', { name: 'Revisar consulta', exact: true }).click();
  await confirm(page, 'Preparar consulta');
  await expect(page).toHaveURL(new RegExp(snapshotId));
  expect(state.writes[0].body.idempotencyKey).toBe(state.writes[1].body.idempotencyKey);
  expect(state.writes[1].body).toMatchObject({
    catalogCode: 'TERMOS',
    filters: {
      from: '2026-09-01',
      to: '2026-09-30',
      accommodationId,
      roomId,
      residentId,
      status: 'EMITIDO',
    },
  });
  await page.reload();
  await expect(page.getByText('21 linhas', { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(2);
});
test('páginas totais séries PDF e Excel compartilham snapshot, fila manual e download real apenas READY', async ({
  page,
}) => {
  const state = await mockApi(page);
  await page.goto('/relatorios/consultas/' + snapshotId);
  await expect(page.getByText('20 de 21 linhas consultadas.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Carregar mais linhas', exact: true }).click();
  await expect(page.getByText('21 de 21 linhas consultadas.', { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Preparar PDF', exact: true }).click();
  await confirm(page, 'Solicitar preparação');
  await expect(page.getByText('Na fila', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Baixar PDF', exact: true })).toHaveCount(0);
  expect(state.files).toHaveLength(0);
  const pendingGets = state.gets.filter((path) =>
    path.startsWith('/relatorios/exportacoes'),
  ).length;
  await page.waitForTimeout(150);
  expect(state.gets.filter((path) => path.startsWith('/relatorios/exportacoes')).length).toBe(
    pendingGets,
  );
  for (const [format, title, id] of [
    ['PDF', 'PDF', uuid(701)],
    ['XLSX', 'Excel', uuid(702)],
  ] as const) {
    if (format === 'XLSX') {
      await page.getByRole('button', { name: 'Preparar Excel', exact: true }).click();
      await confirm(page, 'Solicitar preparação');
    }
    await expect(
      page.getByRole('button', { name: 'Consultar preparação de ' + title, exact: true }),
    ).toBeVisible();
    const job = state.jobs.get(id)!;
    job.status = 'READY';
    job.document = { id: uuid(750), sha256: 'b'.repeat(64), size: 987, state: 'STORED' };
    await page
      .getByRole('button', { name: 'Consultar preparação de ' + title, exact: true })
      .click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Baixar ' + title, exact: true }).click();
    expect((await download).suggestedFilename()).toContain(format.toLowerCase());
  }
  expect(state.writes.map((item) => item.body)).toEqual([{ format: 'PDF' }, { format: 'XLSX' }]);
  expect(
    state.writes.every((item) => item.path.includes(snapshotId) && item.csrf === 'synthetic-csrf'),
  ).toBe(true);
  expect(state.files).toHaveLength(2);
  await page.reload();
  await page.getByRole('button', { name: 'Preparar PDF', exact: true }).click();
  await confirm(page, 'Solicitar preparação');
  await expect(page.getByRole('button', { name: 'Baixar PDF', exact: true })).toBeVisible();
  expect(state.jobs.size).toBe(2);
});
test('consulta expirada e limite de linhas ficam explícitos sem resultado truncado ou dados demo', async ({
  page,
}) => {
  const state = await mockApi(page, { expired: true });
  await page.goto('/relatorios/consultas/' + snapshotId);
  await expect(page.getByRole('alert').filter({ hasText: 'expirou' })).toBeVisible();
  await expect(page.getByText('Ana Luísa Ribeiro', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Preparar PDF', exact: true })).toHaveCount(0);
  state.expired = false;
  state.limit = true;
  await page.goto('/relatorios');
  await page.getByRole('button', { name: 'Revisar consulta', exact: true }).click();
  await confirm(page, 'Preparar consulta');
  await expect(
    page.getByRole('alert').filter({ hasText: 'nenhum resultado foi truncado' }),
  ).toBeVisible();
  await expect(page.getByText('private-secret')).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
});
test('indicadores reais apresentam três séries sem pontuação de comportamento com tabela acessível', async ({
  page,
}) => {
  const state = await mockApi(page, { role: 'gestor' });
  await page.goto('/relatorios/individual/' + residentId);
  await expect(
    page.getByRole('heading', { name: 'Indicadores individuais', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('figure')).toHaveCount(3);
  await expect(page.getByText('Escala comum de 0 a 3 registros.', { exact: true })).toHaveCount(3);
  await expect(
    page.getByRole('table', { name: 'Valores mensais das três séries', exact: true }),
  ).toBeVisible();
  expect(
    state.gets.some(
      (path) => path.includes('/limpeza/indicadores') && path.includes('residentId=' + residentId),
    ),
  ).toBe(true);
  expect(state.gets.some((path) => path.includes('/saude'))).toBe(false);
  expect(state.writes).toHaveLength(0);
  await expect(page.getByText('Histórico pedagógico', { exact: true })).toHaveCount(0);
});
test('320px sem overflow e axe, teclado em revisão, papéis protegidos e demonstração de relatórios preservada', async ({
  page,
}) => {
  const state = await mockApi(page);
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/limpeza/nova');
  await page.getByRole('combobox', { name: 'Quarto', exact: true }).selectOption(roomId);
  await grades(page);
  await noOverflow(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Revisar registro', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await noOverflow(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await page.goto('/relatorios/consultas/' + snapshotId);
  await expect(
    page.getByRole('heading', { name: 'Resultados da consulta', exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  state.role = 'gestor';
  await page.goto('/limpeza/nova');
  await expect(page).toHaveURL(/acesso-negado$/);
  state.role = 'residente';
  await page.goto('/relatorios');
  await expect(page).toHaveURL(/acesso-negado$/);
  await page.goto('/demonstracao');
  await page.getByRole('button', { name: /Entrar como gestor/ }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  await page.goto('/relatorios');
  await expect(
    page.locator('.demo-tag').getByText('Dados fictícios', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Simular exportação PDF', exact: false }),
  ).toBeVisible();
});
