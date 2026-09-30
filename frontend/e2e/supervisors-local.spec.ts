import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';

interface SupervisorRecord {
  id: string;
  name: string;
  institutionalId: string;
  email: string;
  version: number;
}

const principal = {
  id: '00000000-0000-0000-0000-000000000001',
  nome: 'Gestora Exemplo',
  email: 'gestora@example.invalid',
  fotoUrl: null,
  perfis: ['gestor'],
  residenteId: null,
  supervisorId: null,
};

async function mockSession(page: Page, profile: 'gestor' | 'supervisor' = 'gestor'): Promise<void> {
  await page.route('**/api/v1/auth/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/me')) return route.fulfill({ json: { ...principal, perfis: [profile] } });
    if (path.endsWith('/csrf')) {
      return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-test' } });
    }
    return route.fulfill({ status: 404 });
  });
}

test('demonstração funciona sem backend e usa apenas registros fictícios', async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort('failed'));
  await page.goto('/demonstracao');
  await page.getByRole('button', { name: /Entrar como gestor/i }).click();
  await page.goto('/supervisores');
  await expect(page.getByText('Helena Supervisora Exemplo')).toBeVisible();
  await expect(page.getByText('Estes registros são demonstrativos')).toBeVisible();

  await page.getByRole('link', { name: 'Cadastrar supervisor' }).click();
  await page.getByRole('textbox', { name: 'Nome completo *' }).fill('Supervisora Fictícia');
  await page.getByRole('textbox', { name: 'Identificação institucional *' }).fill('DEMO-003');
  await page
    .getByRole('textbox', { name: 'E-mail institucional *' })
    .fill('ficticia@example.invalid');
  await page.getByRole('button', { name: 'Salvar supervisor' }).click();
  await expect(page.getByRole('status')).toContainText('Supervisor salvo nesta demonstração.');
});

test('supervisor usa API e persiste criação e edição após recarga', async ({ page }) => {
  await mockSession(page, 'supervisor');
  const records: SupervisorRecord[] = [];
  const writes: { method: string; csrf: string | undefined; body: Record<string, unknown> }[] = [];
  await page.route('**/api/v1/supervisores**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const id = path.split('/').at(-1);
    if (request.method() === 'GET' && path.endsWith('/supervisores')) {
      return route.fulfill({ json: records });
    }
    if (request.method() === 'GET') {
      const record = records.find((item) => item.id === id);
      return route.fulfill(record ? { json: record } : { status: 404 });
    }
    const body = request.postDataJSON() as Record<string, unknown>;
    writes.push({ method: request.method(), csrf: request.headers()['x-csrf-token'], body });
    if (request.method() === 'POST') {
      const record = {
        ...body,
        id: '00000000-0000-0000-0000-000000000010',
        version: 1,
      } as SupervisorRecord;
      records.push(record);
      return route.fulfill({ status: 201, json: record });
    }
    const record = records.find((item) => item.id === id);
    if (!record) return route.fulfill({ status: 404 });
    if (body['version'] !== record.version) {
      return route.fulfill({ status: 409, json: { code: 'stale_version' } });
    }
    Object.assign(record, body, { version: record.version + 1 });
    return route.fulfill({ json: record });
  });

  await page.goto('/supervisores');
  await expect(page.getByRole('heading', { name: 'Nenhum supervisor cadastrado' })).toBeVisible();
  await expect(page.getByText('Helena Supervisora Exemplo')).toHaveCount(0);
  await page.getByRole('link', { name: 'Cadastrar supervisor' }).click();
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? '')),
  ).toEqual([]);
  await page.getByRole('textbox', { name: 'Nome completo *' }).fill('Supervisora Exemplo');
  await page.getByRole('textbox', { name: 'Identificação institucional *' }).fill('TESTE-001');
  await page
    .getByRole('textbox', { name: 'E-mail institucional *' })
    .fill('supervisora@example.invalid');
  await page.getByRole('button', { name: 'Salvar supervisor' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Supervisor salvo no ambiente local de teste.',
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Supervisora Exemplo' })).toBeVisible();
  await page.getByRole('link', { name: 'Editar supervisor' }).click();
  await page.getByRole('textbox', { name: 'Nome completo *' }).fill('Supervisora Atualizada');
  await page.getByRole('button', { name: 'Salvar supervisor' }).click();
  await expect(page.getByRole('heading', { name: 'Supervisora Atualizada' })).toBeVisible();
  expect(writes).toEqual([
    {
      method: 'POST',
      csrf: 'csrf-test',
      body: {
        name: 'Supervisora Exemplo',
        institutionalId: 'TESTE-001',
        email: 'supervisora@example.invalid',
      },
    },
    {
      method: 'PUT',
      csrf: 'csrf-test',
      body: {
        name: 'Supervisora Atualizada',
        institutionalId: 'TESTE-001',
        email: 'supervisora@example.invalid',
        version: 1,
      },
    },
  ]);
});

test('validação do servidor e versão obsoleta não exibem sucesso falso', async ({ page }) => {
  await mockSession(page);
  let record: SupervisorRecord = {
    id: '00000000-0000-0000-0000-000000000011',
    name: 'Supervisora Original',
    institutionalId: 'TESTE-011',
    email: 'original@example.invalid',
    version: 1,
  };
  let rejectCreate = true;
  await page.route('**/api/v1/supervisores**', (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      return route.fulfill({ json: request.url().endsWith('/supervisores') ? [record] : record });
    }
    if (request.method() === 'POST') {
      return route.fulfill({
        status: rejectCreate ? 400 : 409,
        json: { code: rejectCreate ? 'invalid_input' : 'duplicate_institutional_id' },
      });
    }
    const body = request.postDataJSON() as SupervisorRecord;
    if (body.institutionalId === 'DUPLICADO') {
      return route.fulfill({ status: 409, json: { code: 'duplicate_institutional_id' } });
    }
    if (body.version !== record.version) {
      return route.fulfill({ status: 409, json: { code: 'stale_version' } });
    }
    record = { ...body, id: record.id, version: record.version + 1 };
    return route.fulfill({ json: record });
  });

  await page.goto('/supervisores/novo');
  await page.getByRole('textbox', { name: 'Nome completo *' }).fill('Supervisora Nova');
  await page.getByRole('textbox', { name: 'Identificação institucional *' }).fill('TESTE-012');
  await page.getByRole('textbox', { name: 'E-mail institucional *' }).fill('nova@example.invalid');
  await page.getByRole('button', { name: 'Salvar supervisor' }).click();
  await expect(page.getByRole('alert')).toContainText('Os dados foram recusados');
  await expect(page).toHaveURL(/\/supervisores\/novo$/);
  rejectCreate = false;
  await page.getByRole('button', { name: 'Salvar supervisor' }).click();
  await expect(page.getByRole('alert')).toContainText('Já existe um cadastro');

  await page.goto(`/supervisores/${record.id}/editar`);
  await expect(page.getByRole('textbox', { name: 'Nome completo *' })).toHaveValue(
    'Supervisora Original',
  );
  await page.getByRole('textbox', { name: 'Identificação institucional *' }).fill('DUPLICADO');
  await page.getByRole('button', { name: 'Salvar supervisor' }).click();
  await expect(page.getByRole('alert')).toContainText('Já existe um cadastro');
  await expect(page.getByRole('button', { name: 'Carregar versão atual do cadastro' })).toHaveCount(
    0,
  );
  await page.getByRole('textbox', { name: 'Identificação institucional *' }).fill('TESTE-011');
  record = { ...record, name: 'Supervisora Alterada Externamente', version: 2 };
  await page.getByRole('textbox', { name: 'Nome completo *' }).fill('Edição Local');
  await page.getByRole('button', { name: 'Salvar supervisor' }).click();
  await expect(page.getByRole('alert')).toContainText('alterado por outra sessão');
  await page.getByRole('button', { name: 'Carregar versão atual do cadastro' }).click();
  await expect(page.getByRole('textbox', { name: 'Nome completo *' })).toHaveValue(
    'Supervisora Alterada Externamente',
  );
  await page.getByRole('textbox', { name: 'Nome completo *' }).fill('Edição Confirmada');
  await page.getByRole('button', { name: 'Salvar supervisor' }).click();
  await expect(page.getByRole('heading', { name: 'Edição Confirmada' })).toBeVisible();
});
