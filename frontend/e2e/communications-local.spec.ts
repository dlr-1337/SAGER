import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';
import type {
  DisciplineNotification,
  DisciplineOccurrence,
  DisciplineTerm,
  DisciplineWarning,
  OwnCommunication,
  PublishedNotice,
  RecurrenceCandidate,
} from '../src/app/features/communications/communications-local.models';

const uuid = (number: number) => `00000000-0000-0000-0000-${String(number).padStart(12, '0')}`;
const residentId = uuid(41),
  actorId = uuid(1),
  notificationId = uuid(901),
  occurrenceId = uuid(902),
  noticeId = uuid(801),
  termId = uuid(701),
  ownId = uuid(601);
const now = '2026-09-30T16:00:00Z';
const resident = {
  id: residentId,
  name: 'Estudante Sintético',
  enrollment: 'TESTE-001',
  birthDate: '2010-05-14',
  course: null,
  version: 0,
};
const otherResident = {
  ...resident,
  id: uuid(42),
  name: 'Outro Estudante',
  enrollment: 'TESTE-002',
};
const document = { id: uuid(702), sha256: 'a'.repeat(64), size: 987, state: 'STORED' };
function warning(index = 1): DisciplineWarning {
  return {
    id: uuid(910 + index),
    residentId,
    residentName: resident.name,
    occurrenceId: uuid(920 + index),
    notificationId: index === 1 ? notificationId : null,
    category: 'AUSENCIA',
    severity: 'MODERADA',
    description: `Ausência conferida na chamada ${index}`,
    justification: 'A evidência foi revista pelo supervisor.',
    warningDate: index === 1 ? '2026-09-29' : '2026-09-30',
    status: 'VIGENTE',
    requiresReview: false,
    issuedAt: now,
    issuedBy: actorId,
    communicationId: uuid(930 + index),
    version: 0,
    annulmentReason: null,
  };
}
function occurrence(id = occurrenceId): DisciplineOccurrence {
  return {
    id,
    residentId,
    residentName: resident.name,
    sourceType: 'NIGHT_CALL',
    sourceId: uuid(100),
    category: 'AUSENCIA',
    valid: true,
    sourceVersion: 4,
    version: 0,
    occurredAt: '2026-09-30T01:30:00Z',
    evidence: { mark: 'AUSENTE', callStatus: 'FECHADA', referenceDate: '2026-09-29' },
    revisions: [
      {
        version: 0,
        sourceVersion: 4,
        valid: true,
        evidence: { mark: 'AUSENTE', callStatus: 'FECHADA' },
        occurredAt: '2026-09-30T01:30:00Z',
        recordedAt: now,
      },
    ],
  };
}
function notification(): DisciplineNotification {
  return {
    id: notificationId,
    occurrenceId,
    residentId,
    residentName: resident.name,
    category: 'AUSENCIA',
    status: 'PENDENTE',
    requiresReview: false,
    version: 0,
    occurrenceVersion: 0,
    policyCode: 'ABSENCE_ON_CLOSED_CALL',
    policyVersion: 1,
    createdAt: now,
    valid: true,
    evidence: occurrence().evidence,
    events: [],
  };
}
function ownCommunication(): OwnCommunication {
  return {
    id: ownId,
    kind: 'AVISO',
    sourceId: noticeId,
    contentVersion: 2,
    title: 'Reunião de residentes',
    body: 'Encontro no auditório às 18 horas. Consulte a versão publicada.',
    publishedAt: now,
    status: 'PUBLICADO',
    stateReason: null,
    requiresReview: false,
    readAt: null,
    acknowledgedAt: null,
    document: null,
  };
}
interface State {
  role: 'supervisor' | 'residente' | 'gestor';
  failReads: boolean;
  failWriteOnce: boolean;
  conflictOnce: boolean;
  notification: DisciplineNotification;
  occurrence: DisciplineOccurrence;
  warnings: DisciplineWarning[];
  notices: PublishedNotice[];
  terms: DisciplineTerm[];
  own: OwnCommunication;
  writes: { path: string; body: Record<string, any>; csrf: string | undefined }[];
  gets: string[];
  idempotency: Map<string, unknown>;
}
async function mockApi(page: Page, options: Partial<State> = {}): Promise<State> {
  const state: State = {
    role: 'supervisor',
    failReads: false,
    failWriteOnce: false,
    conflictOnce: false,
    notification: notification(),
    occurrence: occurrence(),
    warnings: [warning(1), warning(2)],
    notices: [],
    terms: [],
    own: ownCommunication(),
    writes: [],
    gets: [],
    idempotency: new Map(),
    ...options,
  };
  const candidates = (): RecurrenceCandidate[] =>
    ['AUSENCIA', 'ATRASO_RETORNO', 'LIMPEZA'].map((category) => {
      const warnings = state.warnings.filter(
        (item) => item.category === category && item.status === 'VIGENTE' && !item.requiresReview,
      );
      return {
        category: category as RecurrenceCandidate['category'],
        minimumWarnings: 2,
        windowDays: 90,
        warnings,
        candidate:
          warnings.length >= 2 && new Set(warnings.map((item) => item.occurrenceId)).size >= 2,
      };
    });
  const list = (items: unknown[]) => ({ items, nextCursor: null });
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const method = request.method();
    const ok = (value: unknown) => route.fulfill({ json: value });
    if (path === '/auth/me')
      return ok({
        id: actorId,
        nome: state.role === 'residente' ? resident.name : 'Supervisora Sintética',
        email: 'sessao@example.test',
        fotoUrl: null,
        perfis: [state.role],
        residenteId: state.role === 'residente' ? residentId : null,
        supervisorId: state.role === 'supervisor' ? uuid(101) : null,
      });
    if (path === '/auth/csrf') return ok({ headerName: 'X-CSRF-TOKEN', token: 'synthetic-csrf' });
    if (method === 'GET') {
      state.gets.push(path + url.search);
      if (state.failReads)
        return route.fulfill({ status: 503, json: { message: 'db-password-secret' } });
      if (path === '/notificacoes/contexto')
        return ok({
          now,
          currentDate: '2026-09-30',
          zone: 'America/Sao_Paulo',
          categories: ['AUSENCIA', 'ATRASO_RETORNO', 'LIMPEZA', 'OUTRA'],
          severities: ['LEVE', 'MODERADA', 'GRAVE'],
        });
      if (path === '/residentes') return ok([resident, otherResident]);
      if (path === '/residentes/' + residentId) return ok(resident);
      if (path === '/notificacoes') return ok(list([state.notification]));
      if (path === '/notificacoes/' + notificationId) return ok(state.notification);
      if (path.startsWith('/ocorrencias/'))
        return ok({ ...state.occurrence, id: path.split('/').pop() });
      if (path === '/advertencias') {
        const filter = url.searchParams.get('residentId');
        return ok(list(state.warnings.filter((item) => !filter || item.residentId === filter)));
      }
      if (path.startsWith('/advertencias/')) {
        const item = state.warnings.find((item) => path.endsWith(item.id));
        if (item) return ok(item);
      }
      if (path === `/residentes/${residentId}/reincidencias`) return ok(candidates());
      if (path === `/residentes/${residentId}/termos`) return ok(list(state.terms));
      if (/^\/(?:me\/)?termos\/.+\/documento$/.test(path))
        return route.fulfill({
          contentType: 'application/pdf',
          body: '%PDF-1.7\nSAGER synthetic term\n%%EOF',
        });
      if (path.startsWith('/termos/')) {
        const item = state.terms.find((item) => path.endsWith(item.id));
        if (item) return ok(item);
      }
      if (path === '/avisos') return ok(list(state.notices));
      if (path.startsWith('/avisos/')) {
        const item = state.notices.find((item) => path.endsWith(item.id));
        if (item) return ok(item);
      }
      if (path === '/me/comunicacoes/' + state.own.id) return ok(state.own);
      if (path === '/me/avisos' || path === '/me/advertencias' || path === '/me/termos') {
        const kind = path.endsWith('avisos')
          ? 'AVISO'
          : path.endsWith('advertencias')
            ? 'ADVERTENCIA'
            : 'TERMO';
        return ok(list(state.own.kind === kind ? [state.own] : []));
      }
      return route.fulfill({ status: 404, json: { message: 'private-db-schema' } });
    }
    const body = request.postDataJSON() as Record<string, any>;
    state.writes.push({ path, body, csrf: request.headers()['x-csrf-token'] });
    if (state.failWriteOnce) {
      state.failWriteOnce = false;
      return route.fulfill({ status: 503, json: { message: 'db-password-secret' } });
    }
    if (state.conflictOnce) {
      state.conflictOnce = false;
      return route.fulfill({
        status: 409,
        json: { code: 'version_conflict', message: 'private-db-schema' },
      });
    }
    if (body.idempotencyKey && state.idempotency.has(body.idempotencyKey))
      return ok(state.idempotency.get(body.idempotencyKey));
    const finish = (value: unknown) => {
      if (body.idempotencyKey) state.idempotency.set(body.idempotencyKey, value);
      return ok(value);
    };
    if (path.startsWith('/notificacoes/')) {
      const action = path.split('/').pop();
      if (action === 'converter') {
        const item = { ...warning(9), ...body, occurrenceId, notificationId };
        delete item.idempotencyKey;
        state.warnings.push(item);
        state.notification.status = 'CONVERTIDA';
        state.notification.version++;
        return finish(item);
      }
      state.notification.version++;
      if (action === 'visualizar') state.notification.status = 'VISUALIZADA';
      if (action === 'analisar') {
        if (body.confirmCurrentEvidence) state.notification.requiresReview = false;
        if (state.notification.status !== 'CONVERTIDA') state.notification.status = 'EM_ANALISE';
      }
      if (action === 'arquivar') state.notification.status = 'ARQUIVADA';
      state.notification.events.push({
        id: uuid(1000 + state.notification.version),
        action: body.confirmCurrentEvidence
          ? 'REVISAR_ORIGEM'
          : action === 'visualizar'
            ? 'VISUALIZAR'
            : action === 'analisar'
              ? 'ANALISAR'
              : 'ARQUIVAR',
        actorId,
        recordedAt: now,
        resultingVersion: state.notification.version,
        occurrenceVersion: state.notification.occurrenceVersion,
        reasonCode: body.reasonCode ?? null,
        reason: body.reason ?? null,
      });
      return ok(state.notification);
    }
    if (path === '/advertencias') {
      const item = { ...warning(8), ...body, occurrenceId: uuid(990), notificationId: null };
      delete item.idempotencyKey;
      state.warnings.push(item);
      return finish(item);
    }
    if (path.endsWith('/anular') && path.startsWith('/advertencias/')) {
      const item = state.warnings.find((item) => path.includes(item.id))!;
      Object.assign(item, {
        status: 'ANULADA',
        version: item.version + 1,
        annulmentReason: body.reason,
      });
      return ok(item);
    }
    if (path === `/residentes/${residentId}/termos`) {
      const item: DisciplineTerm = {
        id: termId,
        residentId,
        residentName: resident.name,
        warningIds: body.warningIds,
        decision: body.decision,
        status: 'EMITIDO',
        issuedAt: now,
        issuedBy: actorId,
        communicationId: uuid(703),
        document,
        version: 0,
        annulmentReason: null,
      };
      state.terms.push(item);
      return finish(item);
    }
    if (path.endsWith('/anular') && path.startsWith('/termos/')) {
      const item = state.terms.find((item) => path.includes(item.id))!;
      Object.assign(item, {
        status: 'ANULADO',
        version: item.version + 1,
        annulmentReason: body.reason,
      });
      return ok(item);
    }
    if (path === '/avisos') {
      const item: PublishedNotice = {
        id: noticeId,
        title: body.title,
        body: body.body,
        residentIds: body.residentIds,
        status: 'RASCUNHO',
        version: 0,
        publishedAt: null,
        communicationId: null,
        withdrawalReason: null,
      };
      state.notices.push(item);
      return finish(item);
    }
    if (path.startsWith('/avisos/')) {
      const item = state.notices.find((item) => path.includes(item.id))!;
      item.version++;
      if (path.endsWith('/publicar'))
        Object.assign(item, { status: 'PUBLICADO', publishedAt: now, communicationId: uuid(802) });
      if (path.endsWith('/revisar')) Object.assign(item, { title: body.title, body: body.body });
      if (path.endsWith('/retirar'))
        Object.assign(item, { status: 'RETIRADO', withdrawalReason: body.reason });
      return finish(item);
    }
    if (path.startsWith('/me/comunicacoes/')) {
      if (path.endsWith('/leitura')) state.own.readAt = now;
      if (path.endsWith('/ciencia')) state.own.acknowledgedAt = now;
      return ok(state.own);
    }
    return route.fulfill({ status: 404, json: { code: 'not_found' } });
  });
  return state;
}
async function fillWarning(page: Page): Promise<void> {
  await page.getByLabel('Gravidade decidida pelo supervisor').selectOption('GRAVE');
  await page
    .getByLabel('Descrição da ocorrência')
    .fill('Ausência na chamada conferida após análise humana.');
  await page
    .getByLabel('Justificativa da decisão', { exact: true })
    .fill('A ocorrência e a justificativa apresentada foram avaliadas pelo supervisor.');
}
async function confirm(page: Page, name: string): Promise<void> {
  await page.getByRole('dialog').getByRole('button', { name, exact: true }).click();
}
test.use({ timezoneId: 'Pacific/Auckland' });

test('GET não decide; supervisor registra visualização, análise e arquivamento motivado', async ({
  page,
}) => {
  const state = await mockApi(page);
  await page.goto('/notificacoes');
  await page.getByRole('link', { name: 'Abrir análise' }).click();
  await expect(page.getByRole('heading', { name: 'Origem e evidência' })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Registrar visualização' }).click();
  await expect(page.getByText('Visualização registrada por ação explícita.')).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar análise', exact: true }).click();
  await expect(page.getByText('Análise iniciada. Nenhuma advertência foi emitida.')).toBeVisible();
  const archive = page.getByRole('button', { name: 'Arquivar com justificativa' });
  await archive.click();
  await expect(page.getByRole('dialog').getByLabel('Motivo do arquivamento')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(archive).toBeFocused();
  expect(state.writes).toHaveLength(2);
  await archive.click();
  await page.getByRole('dialog').getByLabel('Motivo do arquivamento').selectOption('NAO_PROCEDE');
  await page
    .getByRole('dialog')
    .getByLabel('Justificativa', { exact: true })
    .fill('A ocorrência não procede após conferir o registro de origem.');
  await confirm(page, 'Confirmar arquivamento');
  await expect(page.getByText('Notificação arquivada com justificativa.')).toBeVisible();
  expect(state.writes[2].body).toEqual({
    version: 2,
    reasonCode: 'NAO_PROCEDE',
    reason: 'A ocorrência não procede após conferir o registro de origem.',
  });
  expect(state.writes.every((item) => item.csrf === 'synthetic-csrf')).toBe(true);
  await page.reload();
  await expect(page.getByText('Notificação arquivada', { exact: true })).toBeVisible();
});

test('origem corrigida exige revisão humana antes da conversão com gravidade e data próprias', async ({
  page,
}) => {
  const state = await mockApi(page);
  state.notification.requiresReview = true;
  state.notification.occurrenceVersion = 1;
  state.notification.version = 4;
  state.occurrence.version = 1;
  state.occurrence.revisions.push({
    ...state.occurrence.revisions[0],
    version: 1,
    sourceVersion: 5,
  });
  await page.goto('/notificacoes/' + notificationId);
  await expect(page.getByRole('button', { name: 'Converter após análise humana' })).toBeDisabled();
  await page.getByRole('button', { name: 'Confirmar evidência atual' }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Justificativa', { exact: true })
    .fill('A evidência atual continua válida após a correção da chamada.');
  await page.getByRole('dialog').getByRole('checkbox').check();
  await confirm(page, 'Confirmar evidência atual');
  await expect(page.getByText('Revisão humana da evidência registrada.')).toBeVisible();
  await page.getByRole('button', { name: 'Converter após análise humana' }).click();
  await fillWarning(page);
  await page.getByRole('button', { name: 'Revisar conversão em advertência' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Revisar conversão em advertência' }),
  ).toBeFocused();
  expect(state.writes).toHaveLength(1);
  await page.getByRole('button', { name: 'Revisar conversão em advertência' }).click();
  await confirm(page, 'Confirmar emissão da advertência');
  await expect(page).toHaveURL(/\/advertencias\//);
  const write = state.writes.find((item) => item.path.endsWith('/converter'))!;
  expect(write.body).toMatchObject({
    category: 'AUSENCIA',
    severity: 'GRAVE',
    warningDate: '2026-09-30',
    version: 5,
  });
  expect(write.body.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  await page.reload();
  await expect(
    page.getByText('Ausência na chamada conferida após análise humana.', { exact: true }),
  ).toBeVisible();
});

test('advertência manual valida data do servidor, repete intenção com a mesma chave e anula por motivo', async ({
  page,
}) => {
  const state = await mockApi(page, { failWriteOnce: true });
  await page.goto('/advertencias/nova');
  await page.getByRole('combobox', { name: 'Residente', exact: true }).selectOption(residentId);
  await fillWarning(page);
  await page.getByLabel('Data da advertência').fill('2026-10-01');
  await page.getByRole('button', { name: 'Revisar e emitir advertência' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'não seja futura' })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.getByLabel('Data da advertência').fill('2026-09-30');
  await page.getByRole('button', { name: 'Revisar e emitir advertência' }).click();
  await confirm(page, 'Confirmar emissão da advertência');
  await expect(page.getByRole('alert').filter({ hasText: 'conexão' })).toBeVisible();
  await page.getByRole('button', { name: 'Revisar e emitir advertência' }).click();
  await confirm(page, 'Confirmar emissão da advertência');
  await expect(page).toHaveURL(/\/advertencias\/000/);
  expect(state.writes[0].body.idempotencyKey).toBe(state.writes[1].body.idempotencyKey);
  expect(state.writes[1].body.residentId).toBe(residentId);
  await page.getByRole('button', { name: 'Anular com justificativa' }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Justificativa', { exact: true })
    .fill('Nova evidência demonstra que a advertência deve ser anulada.');
  await confirm(page, 'Confirmar anulação');
  await expect(
    page.getByText('Advertência anulada por decisão humana. O histórico foi preservado.'),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText('Anulada', { exact: true })).toBeVisible();
});

test('candidato é revisto, termo exige confirmação humana e PDF privado preserva anulação', async ({
  page,
}) => {
  const state = await mockApi(page);
  await page.goto(`/residentes/${residentId}/reincidencias`);
  await expect(page.getByRole('heading', { name: 'Revisar possível reincidência' })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.getByRole('checkbox').nth(0).check();
  await page.getByRole('checkbox').nth(1).check();
  await page
    .getByLabel('Justificativa da decisão')
    .fill('As duas origens distintas foram conferidas e justificam a emissão do termo.');
  await page.getByRole('button', { name: 'Revisar emissão de termo' }).click();
  await confirm(page, 'Confirmar emissão do termo');
  await expect(
    page.getByRole('dialog').getByRole('alert').filter({ hasText: 'Marque a confirmação' }),
  ).toHaveText('Marque a confirmação após conferir os dados.');
  expect(state.writes).toHaveLength(0);
  await page.getByRole('dialog').getByRole('checkbox').check();
  await confirm(page, 'Confirmar emissão do termo');
  await expect(page).toHaveURL('/termos/' + termId);
  expect(state.writes[0].body).toMatchObject({
    warningIds: [warning(1).id, warning(2).id],
    confirmed: true,
  });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar PDF original' }).click();
  expect((await download).suggestedFilename()).toBe('sager-termo-' + termId + '.pdf');
  await page.getByRole('button', { name: 'Anular termo com justificativa' }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Justificativa', { exact: true })
    .fill('A base foi reavaliada com novas informações e o termo foi anulado.');
  await confirm(page, 'Confirmar anulação do termo');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Termo anulado' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Baixar PDF original' })).toBeEnabled();
});

test('base corrigida e conflito impedem escrita até recarregar evidência atual', async ({
  page,
}) => {
  const state = await mockApi(page);
  await page.goto(`/residentes/${residentId}/reincidencias`);
  await page.getByRole('checkbox').nth(0).check();
  await page.getByRole('checkbox').nth(1).check();
  await page
    .getByLabel('Justificativa da decisão')
    .fill('Decisão sobre duas ocorrências previamente conferidas.');
  state.warnings[1].requiresReview = true;
  await page.getByRole('button', { name: 'Revisar emissão de termo' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'A base mudou' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Revisar emissão de termo' })).toBeDisabled();
  expect(state.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Recarregar base' }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(1);
  await expect(page.getByRole('checkbox')).toBeDisabled();
  await page.goto('/notificacoes/' + notificationId);
  state.conflictOnce = true;
  await page.getByRole('button', { name: 'Registrar visualização' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Recarregue' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Registrar visualização' })).toBeDisabled();
  await page.getByRole('button', { name: 'Recarregar notificação' }).click();
  await expect(page.getByRole('button', { name: 'Registrar visualização' })).toBeEnabled();
  expect(state.writes).toHaveLength(1);
});

test('supervisor publica aviso por UUID, revisa preservando destinatários e retira com motivo', async ({
  page,
}) => {
  const state = await mockApi(page);
  await page.goto('/comunicacoes/avisos/novo');
  await page.getByLabel('Título', { exact: true }).fill('Reunião geral de residentes');
  await page
    .getByLabel('Mensagem', { exact: true })
    .fill('Compareçam ao auditório às 18 horas para a reunião geral.');
  await page.getByRole('checkbox', { name: /Estudante Sintético/ }).check();
  await page.getByRole('button', { name: 'Revisar e salvar rascunho' }).click();
  await confirm(page, 'Salvar rascunho');
  await expect(page).toHaveURL('/comunicacoes/avisos/' + noticeId);
  expect(state.writes[0].body.residentIds).toEqual([residentId]);
  await page.getByRole('button', { name: 'Revisar publicação' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Revisar publicação' })).toBeFocused();
  expect(state.writes).toHaveLength(1);
  await page.getByRole('button', { name: 'Revisar publicação' }).click();
  await confirm(page, 'Confirmar publicação');
  await expect(page.getByText('Aviso publicado para os destinatários selecionados.')).toBeVisible();
  await page.getByRole('button', { name: 'Preparar nova versão' }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page
    .getByLabel('Mensagem', { exact: true })
    .fill('A reunião foi transferida para as 19 horas no mesmo auditório.');
  await page.getByRole('button', { name: 'Revisar e publicar nova versão' }).click();
  await confirm(page, 'Publicar nova versão');
  await expect(
    page.getByText(
      'Nova versão publicada. O conteúdo e as evidências anteriores foram preservados.',
    ),
  ).toBeVisible();
  expect(state.writes[2].body).toMatchObject({ version: 1, title: 'Reunião geral de residentes' });
  expect(state.writes[2].body).not.toHaveProperty('residentIds');
  await page.getByRole('button', { name: 'Retirar com justificativa' }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Justificativa', { exact: true })
    .fill('A reunião foi cancelada pela organização responsável.');
  await confirm(page, 'Confirmar retirada');
  await page.reload();
  await expect(page.getByText('Versão 3 · Retirado')).toBeVisible();
});

test('residente consulta dados próprios e registra leitura e ciência separadas na versão exata', async ({
  page,
}) => {
  const state = await mockApi(page, { role: 'residente' });
  await page.goto('/avisos');
  await expect(page.getByRole('heading', { name: 'Minhas comunicações' })).toBeVisible();
  await page.getByRole('link', { name: 'Ler comunicação' }).click();
  await expect(page.getByRole('heading', { name: state.own.title })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  expect(
    state.gets.every(
      (path) => !path.startsWith('/notificacoes') && !path.startsWith('/residentes'),
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Registrar minha leitura' }).click();
  await expect(page.getByText('Leitura desta versão registrada.')).toBeVisible();
  expect(state.own.acknowledgedAt).toBeNull();
  const trigger = page.getByRole('button', { name: 'Conferir e registrar ciência' });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(state.writes).toHaveLength(1);
  await trigger.click();
  await page.getByRole('dialog').getByRole('checkbox').check();
  await confirm(page, 'Confirmar minha ciência');
  await expect(page.getByText('Ciência desta versão registrada.')).toBeVisible();
  expect(state.writes.map((item) => item.path.split('/').pop())).toEqual(['leitura', 'ciencia']);
  expect(state.writes.every((item) => JSON.stringify(item.body) === '{"version":2}')).toBe(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Conferir e registrar ciência' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Registrar minha leitura' })).toHaveCount(0);
});

test('publicação alterada exige leitura atual; registro de outra conta e falha não expõem demo', async ({
  page,
}) => {
  const state = await mockApi(page, { role: 'residente' });
  await page.goto('/minhas-comunicacoes/' + ownId);
  await expect(page.getByRole('heading', { name: state.own.title })).toBeVisible();
  state.own = {
    ...state.own,
    contentVersion: 3,
    body: 'Nova versão do conteúdo publicada pelo supervisor.',
  };
  await page.getByRole('button', { name: 'Conferir e registrar ciência' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'A publicação mudou' })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await expect(page.getByRole('button', { name: 'Conferir e registrar ciência' })).toBeDisabled();
  await page.getByRole('button', { name: 'Recarregar comunicação' }).click();
  await expect(page.getByText(state.own.body, { exact: true })).toBeVisible();
  await page.goto('/minhas-comunicacoes/' + uuid(999));
  await expect(
    page.getByRole('alert').filter({ hasText: 'não está disponível para sua conta' }),
  ).toBeVisible();
  await expect(page.getByText('private-db-schema')).toHaveCount(0);
  state.failReads = true;
  await page.goto('/avisos');
  await expect(page.getByRole('alert').filter({ hasText: 'conexão' })).toBeVisible();
  await expect(page.getByText('Dados de demonstração')).toHaveCount(0);
  state.failReads = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByRole('link', { name: 'Ler comunicação' })).toBeVisible();
});

test('termo próprio usa UUID da fonte para PDF e preserva ciência histórica e base em revisão', async ({
  page,
}) => {
  const own = {
    ...ownCommunication(),
    kind: 'TERMO' as const,
    sourceId: termId,
    title: 'Termo de reincidência emitido',
    body: 'Decisão publicada após análise da base histórica.',
    document,
    requiresReview: true,
    status: 'ANULADO' as const,
    stateReason: 'Base reavaliada pelo supervisor.',
    readAt: now,
    acknowledgedAt: now,
  };
  const state = await mockApi(page, { role: 'residente', own });
  await page.goto('/avisos?tipo=termos');
  await page.getByRole('link', { name: 'Ler comunicação' }).click();
  await expect(
    page.getByText('A origem ou a base está em revisão.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Registrar minha leitura' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Conferir e registrar ciência' })).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar meu termo em PDF' }).click();
  expect((await download).suggestedFilename()).toBe('sager-termo-' + termId + '.pdf');
  expect(state.gets).toContain('/me/termos/' + termId + '/documento');
  expect(state.gets.some((path) => path.startsWith('/ocorrencias'))).toBe(false);
  expect(state.writes).toHaveLength(0);
});

test('320 px e teclado acessíveis; permissões e demonstração mantêm seus escopos', async ({
  page,
}) => {
  const state = await mockApi(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/notificacoes/' + notificationId);
  await expect(page.getByRole('heading', { name: 'Analisar notificação' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Arquivar com justificativa' }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  state.role = 'residente';
  await page.goto('/minhas-comunicacoes/' + ownId);
  await expect(page.getByRole('heading', { name: state.own.title })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.goto('/advertencias/nova');
  await expect(page).toHaveURL('/acesso-negado');
  state.role = 'gestor';
  await page.goto('/notificacoes');
  await expect(page).toHaveURL('/acesso-negado');
  expect(state.writes).toHaveLength(0);
  await page.addInitScript(() => {
    sessionStorage.setItem('sager.demo.active', 'true');
    sessionStorage.setItem('sager.demo.role', 'residente');
  });
  await page.goto('/avisos');
  await expect(page.getByRole('heading', { name: 'Avisos e advertências' })).toBeVisible();
  await expect(
    page.getByText('Os registros abaixo são fictícios.', { exact: false }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
