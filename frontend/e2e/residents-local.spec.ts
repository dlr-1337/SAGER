import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';

interface ResidentRecord {
  id: string;
  name: string;
  enrollment: string;
  birthDate: string | null;
  course: string | null;
  version: number;
}

const id = '00000000-0000-0000-0000-000000000041';
const principal = (profile: 'gestor' | 'supervisor' = 'gestor') => ({
  id: '00000000-0000-0000-0000-000000000001',
  nome: 'Conta Sintética',
  email: 'conta@example.invalid',
  fotoUrl: null,
  perfis: [profile],
});

async function mockSession(page: Page, profile: 'gestor' | 'supervisor' = 'gestor') {
  await page.route('**/api/v1/auth/**', (route) => {
    if (route.request().url().endsWith('/me')) return route.fulfill({ json: principal(profile) });
    return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-synthetic' } });
  });
}

function mockRegistry(initial: ResidentRecord[] = []) {
  const records = initial;
  const writes: { method: string; body: Record<string, unknown> }[] = [];
  let failList = false;
  let failNextWrite = false;
  async function attach(page: Page) {
    await page.route('**/api/v1/alocacoes**', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/v1/quartos/mapa', (route) =>
      route.fulfill({
        json: { accommodations: [], units: [], rooms: [] },
      }),
    );
    await page.route('**/api/v1/responsaveis**', (route) => {
      const path = new URL(route.request().url()).pathname;
      return route.fulfill(path.endsWith('/responsaveis') ? { json: [] } : { status: 404 });
    });
    await page.route('**/api/v1/residentes**', (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const recordId = path.split('/').at(-1);
      if (request.method() === 'GET') {
        if (failList && path.endsWith('/residentes'))
          return route.fulfill({ status: 503, json: { code: 'unavailable' } });
        const result = path.endsWith('/residentes')
          ? records
          : records.find((item) => item.id === recordId);
        return route.fulfill(result ? { json: result } : { status: 404 });
      }
      expect(request.headers()['x-csrf-token']).toBe('csrf-synthetic');
      const body = request.postDataJSON() as Record<string, unknown>;
      writes.push({ method: request.method(), body });
      if (failNextWrite) {
        failNextWrite = false;
        return route.fulfill({ status: 400, json: { code: 'invalid_input' } });
      }
      const previous = records.find((item) => item.id === recordId);
      if (request.method() === 'PUT' && !previous) return route.fulfill({ status: 404 });
      if (previous && body['version'] !== previous.version)
        return route.fulfill({ status: 409, json: { code: 'stale_version' } });
      if (
        records.some(
          (item) =>
            item.id !== previous?.id &&
            item.enrollment.toLowerCase() === String(body['enrollment']).toLowerCase(),
        )
      )
        return route.fulfill({ status: 409, json: { code: 'duplicate_enrollment' } });
      const result: ResidentRecord = {
        id: previous?.id ?? id,
        name: body['name'] as string,
        enrollment: body['enrollment'] as string,
        birthDate: body['birthDate'] as string | null,
        course: body['course'] as string | null,
        version: previous ? previous.version + 1 : 0,
      };
      if (previous) Object.assign(previous, result);
      else records.push(result);
      return route.fulfill({ status: previous ? 200 : 201, json: result });
    });
  }
  return {
    attach,
    records,
    writes,
    setFailList: (value: boolean) => (failList = value),
    setFailNextWrite: () => (failNextWrite = true),
  };
}

test('cadastro local cria, consulta, busca e edita após recarga, sem dados inventados', async ({
  page,
}) => {
  await mockSession(page);
  const registry = mockRegistry();
  await registry.attach(page);
  await page.goto('/residentes');
  await expect(page.getByRole('heading', { name: 'Nenhum residente cadastrado' })).toBeVisible();
  await expect(page.getByText('Ana Luísa Ribeiro')).toHaveCount(0);
  await page.getByRole('link', { name: 'Cadastrar residente' }).click();
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? '')),
  ).toEqual([]);
  await page.getByRole('textbox', { name: 'Nome completo *' }).fill(' Estudante Sintético ');
  await page.getByRole('textbox', { name: 'Matrícula *' }).fill(' TESTE-A1 ');
  await page.getByRole('button', { name: 'Salvar residente' }).click();
  await expect(page.getByText('Informe a data de nascimento.')).toBeVisible();
  expect(registry.writes).toHaveLength(0);
  await page.getByLabel('Data de nascimento *').fill('2009-05-14');
  await page.getByRole('button', { name: 'Salvar residente' }).click();
  await expect(page.getByRole('heading', { name: 'Estudante Sintético' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText(
    'Cadastro salvo no ambiente local de teste.',
  );
  await expect(page.getByText('Não informado')).toHaveCount(1);
  await expect(
    page.getByText('A ausência da data de nascimento não indica maioridade'),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Responsáveis' }).click();
  await expect(page.getByRole('heading', { name: 'Nenhum responsável vinculado' })).toBeVisible();
  await expect(page.getByText('Mariana Ribeiro')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Estudante Sintético' })).toBeVisible();
  await page.getByRole('link', { name: 'Editar cadastro' }).click();
  await page.getByRole('textbox', { name: 'Curso (opcional)' }).fill('Curso de Teste');
  await page.getByRole('button', { name: 'Salvar residente' }).click();
  await expect(page.getByText('Curso de Teste')).toBeVisible();
  await page.goto('/residentes');
  await page.getByRole('searchbox', { name: 'Nome ou matrícula' }).fill('teste-a1');
  await expect(page.getByRole('heading', { name: 'Estudante Sintético' })).toBeVisible();
  expect(registry.writes).toEqual([
    {
      method: 'POST',
      body: {
        name: 'Estudante Sintético',
        enrollment: 'TESTE-A1',
        birthDate: '2009-05-14',
        course: null,
      },
    },
    {
      method: 'PUT',
      body: {
        name: 'Estudante Sintético',
        enrollment: 'TESTE-A1',
        birthDate: '2009-05-14',
        course: 'Curso de Teste',
        version: 0,
      },
    },
  ]);
});

test('duplicidade, entrada inválida e conflito de duas abas não anunciam sucesso', async ({
  page,
  context,
}) => {
  await mockSession(page);
  const registry = mockRegistry([
    {
      id,
      name: 'Estudante Original',
      enrollment: 'TESTE-001',
      birthDate: null,
      course: null,
      version: 0,
    },
  ]);
  await registry.attach(page);
  await page.goto('/residentes/novo');
  await page.getByRole('textbox', { name: 'Nome completo *' }).fill('Outra Pessoa');
  await page.getByRole('textbox', { name: 'Matrícula *' }).fill('teste-001');
  await page.getByLabel('Data de nascimento *').fill('2009-05-14');
  registry.setFailNextWrite();
  await page.getByRole('button', { name: 'Salvar residente' }).click();
  await expect(page.getByRole('alert')).toContainText('Os dados foram recusados');
  await page.getByRole('button', { name: 'Salvar residente' }).click();
  await expect(page.getByRole('alert')).toContainText('Já existe um cadastro');
  await expect(page).toHaveURL(/\/residentes\/novo$/);

  await page.goto(`/residentes/${id}/editar`);
  await expect(page.getByRole('textbox', { name: 'Nome completo *' })).toHaveValue(
    'Estudante Original',
  );
  const other = await context.newPage();
  await mockSession(other);
  await registry.attach(other);
  await other.goto(`/residentes/${id}/editar`);
  await expect(other.getByRole('textbox', { name: 'Nome completo *' })).toHaveValue(
    'Estudante Original',
  );
  await other.getByRole('textbox', { name: 'Nome completo *' }).fill('Alteração da Outra Aba');
  await other.getByLabel('Data de nascimento *').fill('2009-05-14');
  await other.getByRole('button', { name: 'Salvar residente' }).click();
  await expect(other.getByRole('heading', { name: 'Alteração da Outra Aba' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Nome completo *' }).fill('Alteração Desatualizada');
  await page.getByLabel('Data de nascimento *').fill('2009-05-14');
  await page.getByRole('button', { name: 'Salvar residente' }).click();
  await expect(page.getByRole('alert')).toContainText('alterado por outra sessão');
  await expect(page).toHaveURL(new RegExp(`/residentes/${id}/editar$`));
  await page.getByRole('button', { name: 'Carregar versão atual do cadastro' }).click();
  await expect(page.getByRole('textbox', { name: 'Nome completo *' })).toHaveValue(
    'Alteração da Outra Aba',
  );
  await other.close();
});

test('erro local não carrega demo, supervisor edita e demonstração funciona offline', async ({
  page,
}) => {
  await mockSession(page);
  const registry = mockRegistry([
    {
      id,
      name: 'Estudante Sintético',
      enrollment: 'TESTE-001',
      birthDate: null,
      course: null,
      version: 0,
    },
  ]);
  registry.setFailList(true);
  await registry.attach(page);
  await page.goto('/residentes');
  await expect(
    page.getByRole('heading', { name: 'Não foi possível carregar residentes' }),
  ).toBeVisible();
  await expect(page.getByText('Ana Luísa Ribeiro')).toHaveCount(0);
  registry.setFailList(false);
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByRole('heading', { name: 'Estudante Sintético' })).toBeVisible();

  const supervisor = await page.context().newPage();
  await mockSession(supervisor, 'supervisor');
  await registry.attach(supervisor);
  await supervisor.goto('/residentes');
  await expect(supervisor.getByRole('heading', { name: 'Estudante Sintético' })).toBeVisible();
  await expect(supervisor.getByRole('link', { name: 'Cadastrar residente' })).toBeVisible();
  await supervisor.goto(`/residentes/${id}/editar`);
  await expect(supervisor.getByRole('heading', { name: 'Editar residente' })).toBeVisible();
  await expect(supervisor.getByLabel('Data de nascimento *')).toHaveValue('');
  await supervisor.getByRole('button', { name: 'Salvar residente' }).click();
  await expect(supervisor.getByText('Informe a data de nascimento.')).toBeVisible();
  await supervisor.getByLabel('Data de nascimento *').fill('2009-05-14');
  await supervisor.getByRole('button', { name: 'Salvar residente' }).click();
  await expect(supervisor.getByRole('heading', { name: 'Estudante Sintético' })).toBeVisible();
  await supervisor.close();

  const demo = await page.context().newPage();
  await demo.route('**/api/**', (route) => route.abort('failed'));
  await demo.goto('/demonstracao');
  await demo.getByRole('button', { name: /Entrar como gestor/i }).click();
  await demo.goto('/residentes');
  await expect(demo.getByText('Ana Luísa Ribeiro')).toBeVisible();
  await demo.close();
});

test('formulário local mantém navegação acessível no celular', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await mockSession(page);
  await mockRegistry().attach(page);
  await page.goto('/residentes/novo');
  await expect(page.getByRole('heading', { name: 'Cadastrar residente' })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(1);
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? '')),
  ).toEqual([]);
});

test('responsável demonstrativo não aparece no acesso local e segue na demonstração', async ({
  page,
}) => {
  await mockSession(page);
  await page.route('**/api/v1/responsaveis/g-1', (route) => route.fulfill({ status: 404 }));
  await page.goto('/responsaveis/g-1');
  await expect(page.getByRole('heading', { name: 'Responsável não encontrado' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ana Luísa Ribeiro' })).toHaveCount(0);
  await expect(page.getByText('Ana Luísa Ribeiro')).toHaveCount(0);

  const demo = await page.context().newPage();
  await demo.route('**/api/**', (route) => route.abort('failed'));
  await demo.goto('/demonstracao');
  await demo.getByRole('button', { name: /Entrar como gestor/i }).click();
  await demo.goto('/responsaveis/g-1');
  await expect(demo.getByRole('link', { name: 'Ana Luísa Ribeiro' })).toHaveAttribute(
    'href',
    '/residentes/r-ana',
  );
  await demo.close();
});
