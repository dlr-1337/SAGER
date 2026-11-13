import type { Page, Route } from '@playwright/test';

export type SessionRole = 'gestor' | 'supervisor' | 'residente';

const uuid = (number: number) => `00000000-0000-0000-0000-${String(number).padStart(12, '0')}`;
const now = '2026-09-30T16:00:00Z';

export const SYNTHETIC = {
  residentId: uuid(41),
  guardianId: uuid(51),
  supervisorId: uuid(101),
  exitId: uuid(801),
};

const resident = {
  id: SYNTHETIC.residentId,
  name: 'Estudante Sintético',
  enrollment: 'TESTE-001',
  birthDate: '2010-05-14',
  course: null,
  courseId: null,
  institutionalEmail: null,
  version: 0,
};

const guardian = {
  id: SYNTHETIC.guardianId,
  residentId: SYNTHETIC.residentId,
  name: 'Responsável Sintético',
  relationship: 'Mãe',
  phone: '(62) 99999-0000',
  active: true,
  version: 0,
};

const supervisor = {
  id: SYNTHETIC.supervisorId,
  name: 'Supervisor Sintético',
  institutionalId: 'TESTE-SUP-1',
  email: 'supervisor@example.invalid',
  version: 0,
};

function shortExit(role: SessionRole) {
  return {
    id: SYNTHETIC.exitId,
    residentId: SYNTHETIC.residentId,
    residentName: resident.name,
    enrollment: resident.enrollment,
    departureMode: 'NOW',
    requestedDepartureAt: now,
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
    createdAt: now,
    updatedAt: now,
    version: 0,
    departureRecordedAt: null,
    returnRecordedAt: null,
    deadlineAt: '2026-09-30T19:00:00Z',
    deadlinePassed: false,
    now,
    zone: 'America/Sao_Paulo',
    capabilities: {
      canEdit: role === 'residente',
      canDecide: role === 'supervisor',
      canCancel: true,
      canDepart: false,
      canReturn: false,
    },
    history: [],
  };
}

function principal(role: SessionRole) {
  return {
    id: uuid(1),
    nome: 'Conta Sintética',
    email: 'conta@example.invalid',
    matricula: 'TESTE-LOGIN',
    fotoUrl: null,
    perfis: [role],
    residenteId: role === 'residente' ? SYNTHETIC.residentId : null,
    supervisorId: role === 'supervisor' ? SYNTHETIC.supervisorId : null,
  };
}

function list(route: Route, items: unknown[]) {
  return route.fulfill({ headers: { 'X-Total-Count': String(items.length) }, json: items });
}

/**
 * Entra com uma conta sintética e responde à API com um registro por recurso.
 * Os demais GET recebem lista vazia e as escritas recebem 403.
 */
export async function signIn(page: Page, role: SessionRole = 'supervisor'): Promise<void> {
  const records: Record<string, { id: string }> = {
    residentes: resident,
    responsaveis: guardian,
    supervisores: supervisor,
    'saidas-curtas': shortExit(role),
  };
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/auth/me') return route.fulfill({ json: principal(role) });
    if (path === '/api/v1/auth/csrf')
      return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-synthetic' } });
    if (route.request().method() !== 'GET') return route.fulfill({ status: 403 });
    const [resource, id, ...rest] = path.replace('/api/v1/', '').split('/');
    const record = records[resource];
    if (record && id === undefined) return list(route, [record]);
    if (record && id === record.id && rest.length === 0) return route.fulfill({ json: record });
    return list(route, []);
  });
}
