import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type {
  CareAssignment,
  HealthCustody,
  HealthNote,
  HealthRevision,
  ProfessionalGrant,
} from '../src/app/features/health/health.models';

const residentId = '00000000-0000-4000-8000-000000000041';
const noteId = '00000000-0000-4000-8000-000000000061';
const authorId = '00000000-0000-4000-8000-000000000001';
const recipientId = '00000000-0000-4000-8000-000000000002';
const authorGrantId = '00000000-0000-4000-8000-000000000071';
const recipientGrantId = '00000000-0000-4000-8000-000000000072';
const shareId = '00000000-0000-4000-8000-000000000081';
const exportId = '00000000-0000-4000-8000-000000000091';
const now = '2026-09-30T12:00:00Z';
const resident = {
  id: residentId,
  name: 'Residente Sintético Saúde',
  enrollment: 'SAUDE-TESTE',
  birthDate: null,
  lastRecordedAt: now,
  reviewAfter: '2046-09-30',
};
const authorGrant: ProfessionalGrant = {
  id: authorGrantId,
  sequence: 1,
  accountId: authorId,
  accountName: 'Médica Sintética',
  profession: 'MEDICINA',
  registrationNumber: 'TESTE-1',
  registrationRegion: 'GO',
  verifiedBy: authorId,
  verifiedAt: now,
  verificationReason: 'Conferência sintética',
  startedAt: now,
  endedAt: null,
  version: 0,
};
const recipientGrant: ProfessionalGrant = {
  ...authorGrant,
  id: recipientGrantId,
  sequence: 2,
  accountId: recipientId,
  accountName: 'Enfermeira Sintética',
  profession: 'ENFERMAGEM',
};
const initialNote: HealthNote = {
  id: noteId,
  sequence: 1,
  residentId,
  category: 'GENERAL',
  authorAccountId: authorId,
  authorName: authorGrant.accountName,
  authorProfession: 'MEDICINA',
  authorRegistrationNumber: 'TESTE-1',
  authorRegistrationRegion: 'GO',
  createdAt: now,
  updatedAt: now,
  version: 0,
  relatedNoteId: null,
  canCorrect: true,
  canShare: true,
  custodyAccess: false,
  body: 'Conteúdo assistencial sintético',
  shares: [],
};
type Viewer = 'author' | 'recipient' | 'patient' | 'admin';

function fixtureData(empty = false) {
  let record: HealthNote | null = empty ? null : { ...initialNote, shares: [] };
  const revisions: HealthRevision[] = empty
    ? []
    : [
        {
          id: exportId,
          noteId,
          version: 0,
          body: initialNote.body,
          reason: null,
          recordedAt: now,
          recordedBy: authorId,
        },
      ];
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  const grants: ProfessionalGrant[] = empty ? [] : [authorGrant, recipientGrant];
  const assignments: CareAssignment[] = [];
  const custodies: HealthCustody[] = [];
  let fail = false;
  const pageOf = <T>(items: T[]) => ({ items, nextCursor: null, totalCount: items.length });
  const accessible = (viewer: Viewer) =>
    viewer === 'author' ||
    viewer === 'patient' ||
    (viewer === 'recipient' &&
      !!record?.shares.some((s) => s.recipientGrantId === recipientGrantId && !s.endedAt));
  const visibleNote = (viewer: Viewer) =>
    record ? { ...record, canCorrect: viewer === 'author', canShare: viewer === 'author' } : null;

  async function attach(page: Page, viewer: Viewer) {
    await page.route('**/api/v1/auth/**', (route) => {
      if (new URL(route.request().url()).pathname.endsWith('/me'))
        return route.fulfill({
          json: {
            id: viewer === 'recipient' ? recipientId : authorId,
            nome: 'Conta Sintética Saúde',
            email: 'saude@exemplo.invalid',
            matricula: 'TESTE-LOGIN',
            fotoUrl: null,
            perfis: [viewer === 'admin' ? 'gestor' : viewer === 'patient' ? 'residente' : 'saude'],
            residenteId: viewer === 'patient' ? residentId : null,
            supervisorId: null,
          },
        });
      return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-synthetic' } });
    });
    await page.route('**/api/v1/residentes**', (route) =>
      route.fulfill({
        json: [
          {
            id: residentId,
            name: resident.name,
            enrollment: resident.enrollment,
            birthDate: null,
            course: null,
            version: 0,
          },
        ],
      }),
    );
    await page.route('**/api/v1/{saude,minha-saude}/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const own = path.startsWith('/api/v1/minha-saude');
      if (own) expect(url.searchParams.has('residentId')).toBe(false);
      if (path === '/api/v1/saude/me')
        return route.fulfill({
          json: {
            professionalGrant:
              viewer === 'author' ? authorGrant : viewer === 'recipient' ? recipientGrant : null,
            canAdministerAccess: viewer === 'admin',
            canAccessOwnRecord: viewer === 'patient',
          },
        });
      if (fail)
        return route.fulfill({ status: 503, json: { code: 'unavailable', requestId: exportId } });
      if (request.method() === 'POST') {
        expect(request.headers()['x-csrf-token']).toBe('csrf-synthetic');
        const body = request.postDataJSON() as Record<string, unknown>;
        writes.push({ path, body });
        if (path.endsWith('/exportacoes'))
          return route.fulfill({
            json: {
              exportId,
              generatedAt: now,
              requestId: exportId,
              resident,
              notes: record ? [{ ...visibleNote(viewer), revisions }] : [],
            },
          });
        if (path.endsWith(`/residentes/${residentId}/notas`)) {
          record = {
            ...initialNote,
            body: body['body'] as string,
            category: body['category'] as HealthNote['category'],
            shares: [],
          };
          revisions.push({
            id: exportId,
            noteId,
            version: 0,
            body: record.body,
            reason: null,
            recordedAt: now,
            recordedBy: authorId,
          });
          return route.fulfill({ status: 201, json: record });
        }
        if (path.endsWith('/correcoes') && record) {
          if (body['version'] !== record.version)
            return route.fulfill({ status: 409, json: { code: 'stale_version' } });
          record = { ...record, body: body['body'] as string, version: record.version + 1 };
          revisions.unshift({
            id: recipientId,
            noteId,
            version: record.version,
            body: record.body,
            reason: body['reason'] as string,
            recordedAt: now,
            recordedBy: authorId,
          });
          return route.fulfill({ json: record });
        }
        if (path.endsWith('/partilhas') && record) {
          expect(body['recipientGrantIds']).toEqual([recipientGrantId]);
          record.shares.push({
            id: shareId,
            recipientGrantId,
            recipientCareAssignmentId: recipientId,
            recipientName: recipientGrant.accountName,
            profession: 'ENFERMAGEM',
            createdAt: now,
            endedAt: null,
            version: 0,
          });
          return route.fulfill({ json: record });
        }
        if (path.endsWith(`/partilhas/${shareId}/revogacao`) && record) {
          expect(body).toEqual({ version: 0 });
          record.shares[0] = { ...record.shares[0], endedAt: now, version: 1 };
          return route.fulfill({ json: record });
        }
        if (path.endsWith('/habilitacoes')) {
          const grant = {
            ...authorGrant,
            registrationNumber: body['registrationNumber'] as string,
            registrationRegion: body['registrationRegion'] as string,
            verificationReason: body['verificationReason'] as string,
          };
          grants.push(grant);
          return route.fulfill({ status: 201, json: grant });
        }
        if (path.endsWith('/vinculos')) {
          const assignment: CareAssignment = {
            id: shareId,
            sequence: 1,
            residentId,
            residentName: resident.name,
            professionalGrantId: authorGrantId,
            accountId: authorId,
            accountName: authorGrant.accountName,
            profession: 'MEDICINA',
            startedAt: now,
            endedAt: null,
            createdBy: authorId,
            reason: body['reason'] as string,
            version: 0,
          };
          assignments.push(assignment);
          return route.fulfill({ status: 201, json: assignment });
        }
        if (path.endsWith(`/vinculos/${shareId}/encerramento`)) {
          assignments[0] = { ...assignments[0], endedAt: now, version: 1 };
          return route.fulfill({ json: assignments[0] });
        }
        if (path.endsWith('/custodias')) {
          const custody: HealthCustody = {
            id: exportId,
            sequence: 1,
            residentId,
            sourceAuthorAccountId: recipientId,
            sourceAuthorName: 'Autora Sintética',
            recipientGrantId: authorGrantId,
            recipientAccountName: authorGrant.accountName,
            createdBy: authorId,
            createdAt: now,
            reason: body['reason'] as string,
            endedAt: null,
            version: 0,
          };
          custodies.push(custody);
          return route.fulfill({ status: 201, json: custody });
        }
        return route.fulfill({ status: 404, json: { code: 'not_found' } });
      }
      if (path === '/api/v1/saude/contas')
        return route.fulfill({
          json: pageOf([
            {
              id: authorId,
              name: authorGrant.accountName,
              email: 'medica@exemplo.invalid',
              profile: 'saude',
            },
            {
              id: recipientId,
              name: recipientGrant.accountName,
              email: 'enfermeira@exemplo.invalid',
              profile: 'saude',
            },
          ]),
        });
      if (path === '/api/v1/saude/habilitacoes')
        return route.fulfill({
          json: pageOf(grants.filter((g) => g.accountId === url.searchParams.get('accountId'))),
        });
      if (path === '/api/v1/saude/vinculos') return route.fulfill({ json: pageOf(assignments) });
      if (path === '/api/v1/saude/custodias/autores')
        return route.fulfill({ json: [{ id: recipientId, name: 'Autora Sintética' }] });
      if (path === '/api/v1/saude/custodias') return route.fulfill({ json: pageOf(custodies) });
      if (path === '/api/v1/saude/residentes') return route.fulfill({ json: pageOf([resident]) });
      if (path.endsWith(`/residentes/${residentId}`)) return route.fulfill({ json: resident });
      if (path.endsWith('/profissionais'))
        return route.fulfill({
          json: {
            items: [
              {
                accountId: authorId,
                grantId: authorGrantId,
                careAssignmentId: authorId,
                name: authorGrant.accountName,
                profession: 'MEDICINA',
              },
              {
                accountId: recipientId,
                grantId: recipientGrantId,
                careAssignmentId: recipientId,
                name: recipientGrant.accountName,
                profession: 'ENFERMAGEM',
              },
            ],
          },
        });
      if (path.endsWith('/notas'))
        return route.fulfill({
          json: pageOf(record && accessible(viewer) ? [visibleNote(viewer)] : []),
        });
      if (path.endsWith(`/notas/${noteId}`) && record && accessible(viewer))
        return route.fulfill({ json: visibleNote(viewer) });
      if (path.endsWith(`/notas/${noteId}/historico`) && accessible(viewer))
        return route.fulfill({ json: pageOf(revisions) });
      return route.fulfill({ status: 404, json: { code: 'not_found', requestId: exportId } });
    });
  }
  return {
    attach,
    writes,
    setFail: (value: boolean) => {
      fail = value;
    },
    shareInitially: () => {
      if (record)
        record.shares = [
          {
            id: shareId,
            recipientGrantId,
            recipientCareAssignmentId: recipientId,
            recipientName: recipientGrant.accountName,
            profession: 'ENFERMAGEM',
            createdAt: now,
            endedAt: null,
            version: 0,
          },
        ];
    },
  };
}

test('autor registra, corrige com histórico e partilha somente destinatário selecionado', async ({
  page,
}) => {
  const data = fixtureData(true);
  await data.attach(page, 'author');
  await page.goto('/saude');
  await page.getByLabel('Buscar por nome ou matrícula').fill('Saúde');
  const search = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === '/api/v1/saude/residentes' && url.searchParams.get('q') === 'Saúde';
  });
  await page.getByLabel('Buscar por nome ou matrícula').press('Enter');
  await search;
  await page.getByRole('link', { name: `Abrir registros de ${resident.name}` }).click();
  await expect(page.getByRole('heading', { name: resident.name })).toBeVisible();
  await page.getByLabel('Categoria *', { exact: true }).selectOption('GENERAL');
  await page.getByLabel('Texto do registro *').fill('  ');
  await page.getByRole('button', { name: 'Salvar registro', exact: true }).click();
  expect(data.writes).toHaveLength(0);
  await expect(page.getByLabel('Texto do registro *')).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('Texto do registro *').fill('  Atendimento Sintético  ');
  await page.getByRole('button', { name: 'Salvar registro', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/saude/notas/${noteId}`));
  expect(data.writes[0].body).toEqual({ category: 'GENERAL', body: 'Atendimento Sintético' });
  await page.getByText('Corrigir registro', { exact: true }).click();
  await page.getByLabel('Texto corrigido *').fill('Correção Sintética');
  await page.getByLabel('Justificativa da correção *').fill('Complemento sintético do atendimento');
  await page.getByRole('button', { name: 'Salvar correção', exact: true }).click();
  await expect(page.getByText('Correção registrada. O histórico foi preservado.')).toBeVisible();
  await expect(page.locator('.health-revision')).toHaveCount(2);
  await page.getByRole('button', { name: 'Partilhar registro', exact: true }).click();
  await expect(page.getByText('Selecione ao menos um destinatário.')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Enfermeira Sintética · Enfermagem' }).check();
  await page.getByRole('button', { name: 'Partilhar registro', exact: true }).click();
  await expect(
    page.getByText('Partilha registrada para os destinatários selecionados.'),
  ).toBeVisible();
  expect(data.writes.at(-1)?.body).toEqual({ version: 1, recipientGrantIds: [recipientGrantId] });
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain('Correção Sintética');
});

test('destinatário consulta sem corrigir e perde o conteúdo após revogação com sessão existente', async ({
  page,
  context,
}) => {
  const data = fixtureData();
  data.shareInitially();
  await data.attach(page, 'recipient');
  await page.goto(`/saude/notas/${noteId}`);
  await expect(page.getByText(initialNote.body, { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Corrigir registro', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Partilhar registro', exact: true })).toHaveCount(
    0,
  );
  const author = await context.newPage();
  await data.attach(author, 'author');
  await author.goto(`/saude/notas/${noteId}`);
  await author.getByRole('button', { name: 'Revogar partilha de Enfermeira Sintética' }).click();
  await author.getByRole('button', { name: 'Confirmar revogação', exact: true }).click();
  await expect(author.getByText('Partilha revogada.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Não encontramos este registro');
  await expect(page.getByText(initialNote.body, { exact: true })).toHaveCount(0);
  await author.close();
});

test('paciente lê notas e histórico próprios e baixa JSON sem residentId enviado', async ({
  page,
}) => {
  const data = fixtureData();
  await data.attach(page, 'patient');
  await page.goto('/minha-saude?residentId=registro-alheio');
  await expect(page.getByRole('heading', { name: 'Minha saúde', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Abrir Registro de saúde de Médica Sintética/ }).click();
  await expect(page.getByRole('heading', { name: 'Histórico preservado' })).toBeVisible();
  await expect(page.getByText(initialNote.body, { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Corrigir registro', { exact: true })).toHaveCount(0);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar meus registros (JSON)' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`sager-saude-${exportId}.json`);
  const file = await download.path();
  expect(file).not.toBeNull();
  const json = JSON.parse(await readFile(file!, 'utf8')) as {
    resident: { id: string };
    notes: unknown[];
  };
  expect(json.resident.id).toBe(residentId);
  expect(json.notes).toHaveLength(1);
  expect(data.writes.at(-1)).toEqual({ path: '/api/v1/minha-saude/exportacoes', body: {} });
});

for (const kind of ['habilitação', 'vínculo'] as const) {
  test(`${kind} salvo libera a navegação e uma nova edição continua protegida`, async ({
    page,
  }) => {
    const data = fixtureData(true);
    await data.attach(page, 'admin');
    await page.goto('/saude/acessos');
    await page.getByLabel('Conta do profissional *').selectOption(authorId);
    await page.getByText('Conferir e liberar profissional', { exact: true }).click();
    await page.getByLabel('Número do registro profissional *').fill('TESTE-2');
    await page.getByLabel('UF do registro *').fill('GO');
    await page
      .getByLabel('Justificativa da verificação *')
      .fill('Conferência sintética de documentos');
    await page.getByRole('button', { name: 'Liberar profissional', exact: true }).click();
    await expect(page.getByText('Profissional liberado.', { exact: true })).toBeVisible();
    if (kind === 'vínculo') {
      await page.getByLabel('Residente *', { exact: true }).selectOption(residentId);
      await page.getByLabel('Profissional *', { exact: true }).selectOption(authorGrantId);
      await page.getByLabel('Justificativa do vínculo *').fill('Vínculo assistencial sintético');
      await page.getByRole('button', { name: 'Criar vínculo assistencial', exact: true }).click();
      await expect(
        page.getByText('Vínculo assistencial registrado.', { exact: true }),
      ).toBeVisible();
    }
    await page.getByRole('link', { name: 'Residentes', exact: true }).click();
    await expect(page).toHaveURL('/residentes');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await page.goto('/saude/acessos');
    if (kind === 'habilitação') {
      await page.getByText('Conferir e liberar profissional', { exact: true }).click();
      await page.getByLabel('Justificativa da verificação *').fill('Novo rascunho sintético');
    } else await page.getByLabel('Justificativa do vínculo *').fill('Novo rascunho sintético');
    await page.getByRole('link', { name: 'Residentes', exact: true }).click();
    await expect(page.getByRole('alertdialog', { name: 'Descartar alterações?' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuar preenchendo', exact: true }).click();
    await expect(page).toHaveURL('/saude/acessos');
  });
}

test('gestão habilita, vincula e autoriza custódia usando apenas metadados em 320px', async ({
  page,
}) => {
  const data = fixtureData(true);
  await data.attach(page, 'admin');
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/saude/acessos');
  await expect(page.getByRole('heading', { name: 'Acessos de saúde', exact: true })).toBeVisible();
  await page.getByLabel('Buscar conta por nome ou e-mail').fill('Sintética');
  const accountSearch = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === '/api/v1/saude/contas' && url.searchParams.get('q') === 'Sintética';
  });
  await page.getByRole('button', { name: 'Buscar contas', exact: true }).click();
  await accountSearch;
  await page.getByLabel('Conta do profissional *').selectOption(authorId);
  await page.getByText('Conferir e liberar profissional', { exact: true }).click();
  await page.getByLabel('Número do registro profissional *').fill('TESTE-2');
  await page.getByLabel('UF do registro *').fill('go');
  await page
    .getByLabel('Justificativa da verificação *')
    .fill('Conferência sintética de documentos');
  await page.getByRole('button', { name: 'Liberar profissional', exact: true }).click();
  await expect(page.getByText('Profissional liberado.', { exact: true })).toBeVisible();
  expect(data.writes[0].body['registrationRegion']).toBe('GO');
  await page.getByLabel('Residente *', { exact: true }).selectOption(residentId);
  await page.getByLabel('Profissional *', { exact: true }).selectOption(authorGrantId);
  await page.getByLabel('Justificativa do vínculo *').fill('Vínculo assistencial sintético');
  await page.getByRole('button', { name: 'Criar vínculo assistencial', exact: true }).click();
  await expect(page.getByText('Vínculo assistencial registrado.', { exact: true })).toBeVisible();
  await page.getByLabel('Autor das anotações *').selectOption(recipientId);
  await page.getByLabel('Profissional que recebe os registros *').selectOption(authorGrantId);
  await page
    .getByLabel('Justificativa da custódia *')
    .fill('Continuidade sintética após desligamento');
  await page.getByRole('button', { name: 'Autorizar custódia', exact: true }).click();
  await expect(page.getByText('Custódia registrada.', { exact: true })).toBeVisible();
  await expect(page.getByText('Autor das anotações: Autora Sintética')).toBeVisible();
  await page.getByRole('button', { name: 'Encerrar vínculo', exact: true }).click();
  await expect(page.getByLabel('Justificativa do encerramento *')).toBeFocused();
  await page
    .getByLabel('Justificativa do encerramento *')
    .fill('Encerramento sintético do vínculo');
  await page.getByRole('button', { name: 'Confirmar encerramento', exact: true }).click();
  await expect(page.getByText('Acesso encerrado. O histórico foi preservado.')).toBeVisible();
  await expect(page.getByText('Vínculo encerrado', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(1);
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? '')),
  ).toEqual([]);
  await expect(page.getByText(initialNote.body, { exact: true })).toHaveCount(0);
  data.setFail(true);
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Verifique a internet');
  await expect(page.getByText(initialNote.body, { exact: true })).toHaveCount(0);
});
