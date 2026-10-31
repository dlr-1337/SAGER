import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';

interface ResidentRecord {
  id: string;
  name: string;
  enrollment: string;
  birthDate: string | null;
  course: string | null;
  version: number;
  courseId?: string | null;
  institutionalEmail?: string | null;
}

const id = '00000000-0000-0000-0000-000000000041';
const principal = (profile: 'gestor' | 'supervisor' = 'gestor') => ({
  id: '00000000-0000-0000-0000-000000000001',
  nome: 'Conta Sintética',
  email: 'conta@example.invalid',
  matricula: 'TESTE-LOGIN',
  fotoUrl: null,
  perfis: [profile],
  residenteId: null,
  supervisorId: null,
});

async function mockSession(page: Page, profile: 'gestor' | 'supervisor' = 'gestor') {
  page.on('dialog', (dialog) => dialog.accept());
  await page.route('**/api/v1/auth/**', (route) => {
    if (route.request().url().endsWith('/me')) return route.fulfill({ json: principal(profile) });
    return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-synthetic' } });
  });
}

const availableCourse = {
  id: '00000000-0000-0000-0000-000000000202',
  name: 'Curso Disponível',
  active: true,
  version: 0,
};

function mockRegistry(initial: ResidentRecord[] = []) {
  const records = initial;
  const courses: { id: string; name: string; active: boolean; version: number }[] = [
    availableCourse,
  ];
  const writes: { method: string; body: Record<string, unknown> }[] = [];
  let failList = false;
  let failNextWrite = false;
  async function attach(page: Page) {
    await page.route('**/api/v1/cursos**', (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ json: courses });
      const course = {
        id: '00000000-0000-0000-0000-000000000201',
        name: route.request().postDataJSON().name,
        active: true,
        version: 0,
      };
      courses.push(course);
      return route.fulfill({ status: 201, json: course });
    });
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
        course: courses.find((c) => c.id === body['courseId'])?.name ?? null,
        courseId: (body['courseId'] as string | null) ?? null,
        institutionalEmail: (body['institutionalEmail'] as string | null) ?? null,
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
    courses,
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
  await expect(page.getByRole('main')).not.toContainText(/fictíc|backend|ambiente local/i);
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? '')),
  ).toEqual([]);
  await page.getByRole('textbox', { name: 'Nome completo *' }).fill(' Estudante Sintético ');
  await page.getByRole('textbox', { name: 'Matrícula *' }).fill(' 20261TESTEA0001 ');
  await page.getByRole('button', { name: 'Salvar residente' }).click();
  await expect(page.getByText('Informe a data de nascimento.')).toBeVisible();
  expect(registry.writes).toHaveLength(0);
  await page.getByLabel('Data de nascimento *').fill('2009-05-14');
  if (await page.getByLabel('Senha escolhida pelo residente *', { exact: true }).count()) {
    await page
      .getByLabel('Senha escolhida pelo residente *', { exact: true })
      .fill('Senha teste 123!');
    await page.getByLabel('Confirmar senha *', { exact: true }).fill('Senha teste 123!');
  }
  await page.getByRole('button', { name: 'Salvar residente' }).click();
  await expect(page.getByText('Escolha o curso.')).toBeVisible();
  expect(registry.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Novo curso', exact: true }).click();
  await page.getByLabel('Nome do novo curso').fill('Curso de Teste');
  await page.getByRole('button', { name: 'Cadastrar e selecionar' }).click();
  await expect(page.getByRole('combobox', { name: 'Curso *' })).toHaveValue(
    '00000000-0000-0000-0000-000000000201',
  );
  await page.getByRole('button', { name: 'Salvar residente' }).click();
  await expect(page.getByRole('heading', { name: 'Estudante Sintético' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Cadastro salvo.');
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
  await expect(page.getByRole('combobox', { name: 'Curso *' })).toHaveValue(
    '00000000-0000-0000-0000-000000000201',
  );
  await page.getByRole('button', { name: 'Salvar residente' }).click();
  await expect(page.getByText('Curso de Teste')).toBeVisible();
  await page.goto('/residentes');
  await page.getByRole('searchbox', { name: 'Nome, matrícula ou e-mail' }).fill('testea0001');
  await expect(page.getByRole('heading', { name: 'Estudante Sintético' })).toBeVisible();
  expect(registry.writes).toEqual([
    {
      method: 'POST',
      body: {
        name: 'Estudante Sintético',
        enrollment: '20261TESTEA0001',
        birthDate: '2009-05-14',
        courseId: '00000000-0000-0000-0000-000000000201',
        institutionalEmail: null,
        password: 'Senha teste 123!',
        passwordConfirmation: 'Senha teste 123!',
      },
    },
    {
      method: 'PUT',
      body: {
        name: 'Estudante Sintético',
        enrollment: '20261TESTEA0001',
        birthDate: '2009-05-14',
        courseId: '00000000-0000-0000-0000-000000000201',
        institutionalEmail: null,
        version: 0,
      },
    },
  ]);
});

test('aguarda o curso pendente e só salva o residente com seu vínculo após confirmação', async ({
  page,
}) => {
  await mockSession(page);
  const registry = mockRegistry([
    {
      id,
      name: 'Pessoa Sintética',
      enrollment: 'TESTE-001',
      birthDate: '2009-05-14',
      course: null,
      version: 0,
    },
  ]);
  await registry.attach(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => (release = resolve));
  const course = {
    id: '00000000-0000-0000-0000-000000000201',
    name: 'Curso Sintético',
    active: true,
    version: 0,
  };
  let courseWrites = 0;
  await page.route('**/api/v1/cursos**', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [] });
    expect(route.request().postDataJSON().name).toBe(course.name);
    courseWrites++;
    await pending;
    return route.fulfill({ status: 201, json: course });
  });
  await page.goto(`/residentes/${id}/editar`);
  await page.getByRole('button', { name: 'Novo curso', exact: true }).click();
  await page.getByLabel('Nome do novo curso').fill(course.name);
  await page.getByRole('button', { name: 'Cadastrar e selecionar', exact: true }).click();
  await expect.poll(() => courseWrites).toBe(1);
  const save = page.getByRole('button', { name: 'Salvar residente', exact: true });
  await expect(save).toBeDisabled();
  await page.keyboard.press('Enter');
  await page.locator('form[sagerUnsaved]').dispatchEvent('submit');
  expect(registry.writes).toHaveLength(0);
  await expect(page).toHaveURL(new RegExp(`/residentes/${id}/editar$`));
  release();
  await expect(page.getByRole('combobox', { name: 'Curso *' })).toHaveValue(course.id);
  await expect(save).toBeEnabled();
  expect(registry.writes).toHaveLength(0);
  await save.click();
  await expect(page.getByRole('heading', { name: 'Pessoa Sintética', exact: true })).toBeVisible();
  expect(registry.writes).toHaveLength(1);
  expect(registry.writes[0]).toMatchObject({ method: 'PUT', body: { courseId: course.id } });
});

test('não inicia a criação do curso enquanto o residente está sendo salvo', async ({ page }) => {
  await mockSession(page);
  const registry = mockRegistry([
    {
      id,
      name: 'Pessoa Sintética',
      enrollment: 'TESTE-001',
      birthDate: '2009-05-14',
      course: availableCourse.name,
      courseId: availableCourse.id,
      version: 0,
    },
  ]);
  await registry.attach(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => (release = resolve));
  let residentWrites = 0;
  let courseWrites = 0;
  await page.route(`**/api/v1/residentes/${id}`, async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    residentWrites++;
    await pending;
    return route.fallback();
  });
  await page.route('**/api/v1/cursos**', (route) => {
    if (route.request().method() !== 'GET') courseWrites++;
    return route.fallback();
  });
  await page.goto(`/residentes/${id}/editar`);
  await page.getByRole('button', { name: 'Novo curso', exact: true }).click();
  await page.getByLabel('Nome do novo curso').fill('Curso Sintético');
  await page.getByRole('button', { name: 'Salvar residente', exact: true }).click();
  await expect.poll(() => residentWrites).toBe(1);
  const create = page.getByRole('button', { name: 'Cadastrar e selecionar', exact: true });
  await expect(create).toBeDisabled();
  await create.dispatchEvent('click');
  await expect(page.getByRole('combobox', { name: 'Curso *' })).toHaveValue(availableCourse.id);
  expect(courseWrites).toBe(0);
  release();
  await expect(page.getByRole('heading', { name: 'Pessoa Sintética', exact: true })).toBeVisible();
  expect(courseWrites).toBe(0);
  expect(registry.writes).toHaveLength(1);
  expect(registry.writes[0]).toMatchObject({
    method: 'PUT',
    body: { courseId: availableCourse.id },
  });
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
      enrollment: '20261TESTE00001',
      birthDate: null,
      course: null,
      version: 0,
    },
  ]);
  await registry.attach(page);
  await page.goto('/residentes/novo');
  await page.getByRole('textbox', { name: 'Nome completo *' }).fill('Outra Pessoa');
  await page.getByRole('textbox', { name: 'Matrícula *' }).fill('20261teste00001');
  await page.getByLabel('Data de nascimento *').fill('2009-05-14');
  await page.getByRole('combobox', { name: 'Curso *' }).selectOption(availableCourse.id);
  await page
    .getByLabel('Senha escolhida pelo residente *', { exact: true })
    .fill('Senha teste 123!');
  await page.getByLabel('Confirmar senha *', { exact: true }).fill('Senha teste 123!');
  registry.setFailNextWrite();
  await page.getByRole('button', { name: 'Salvar residente' }).click();
  await expect(page.getByRole('alert')).toContainText('Confira os campos');
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
  await other.getByRole('combobox', { name: 'Curso *' }).selectOption(availableCourse.id);
  await other.getByRole('button', { name: 'Salvar residente' }).click();
  await expect(other.getByRole('heading', { name: 'Alteração da Outra Aba' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Nome completo *' }).fill('Alteração Desatualizada');
  await page.getByLabel('Data de nascimento *').fill('2009-05-14');
  await page.getByRole('combobox', { name: 'Curso *' }).selectOption(availableCourse.id);
  if (await page.getByLabel('Senha escolhida pelo residente *', { exact: true }).count()) {
    await page
      .getByLabel('Senha escolhida pelo residente *', { exact: true })
      .fill('Senha teste 123!');
    await page.getByLabel('Confirmar senha *', { exact: true }).fill('Senha teste 123!');
  }
  await page.getByRole('button', { name: 'Salvar residente' }).click();
  await expect(page.getByRole('alert')).toContainText('Outra pessoa alterou este registro');
  await expect(page).toHaveURL(new RegExp(`/residentes/${id}/editar$`));
  await page.getByRole('button', { name: 'Recarregar dados' }).click();
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
  await supervisor.getByRole('combobox', { name: 'Curso *' }).selectOption(availableCourse.id);
  await supervisor.getByRole('button', { name: 'Salvar residente' }).click();
  await expect(supervisor.getByRole('heading', { name: 'Estudante Sintético' })).toBeVisible();
  await supervisor.close();

  const demo = await page.context().newPage();
  await demo.route('**/api/**', (route) => route.abort('failed'));
  await demo.goto('/demonstracao');
  await demo.getByRole('button', { name: /Entrar como gestor/i }).click();
  await expect(demo).toHaveURL(/\/inicio$/);
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
  await expect(demo).toHaveURL(/\/inicio$/);
  await demo.goto('/responsaveis/g-1');
  await expect(demo.getByRole('link', { name: 'Ana Luísa Ribeiro' })).toHaveAttribute(
    'href',
    '/residentes/r-ana',
  );
  await demo.close();
});

for (const outcome of ['success', 'failure'] as const) {
  test(`edição intacta bloqueia Cancelar durante o PUT (${outcome})`, async ({ page }) => {
    await mockSession(page);
    const record = {
      id,
      name: 'Pessoa Sintética',
      enrollment: 'TESTE-001',
      birthDate: '2009-05-14',
      course: availableCourse.name,
      courseId: availableCourse.id,
      version: 0,
    };
    const registry = mockRegistry([record]);
    await registry.attach(page);
    if (outcome === 'failure') registry.setFailNextWrite();
    let release!: () => void;
    let started!: () => void;
    const pending = new Promise<void>((resolve) => (release = resolve));
    const saving = new Promise<void>((resolve) => (started = resolve));
    let attempts = 0;
    await page.route(`**/api/v1/residentes/${id}`, async (route) => {
      if (route.request().method() === 'PUT') {
        attempts++;
        started();
        await pending;
      }
      return route.fallback();
    });
    await page.goto(`/residentes/${id}/editar`);
    await expect(page.getByRole('textbox', { name: 'Nome completo *' })).toHaveValue(record.name);
    await expect(page.locator('form[sagerUnsaved]')).toHaveClass(/ng-pristine/);
    await page.getByRole('button', { name: 'Salvar residente', exact: true }).click();
    await saving;
    await page.getByRole('link', { name: 'Cancelar', exact: true }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('Salvamento em andamento');
    await dialog.getByRole('button', { name: 'Aguardar', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/residentes/${id}/editar$`));
    expect(attempts).toBe(1);
    release();
    if (outcome === 'success') {
      await expect(page).toHaveURL(new RegExp(`/residentes/${id}\\?saved=1$`));
      await expect(page.getByRole('status').filter({ hasText: 'Cadastro salvo' })).toBeVisible();
    } else {
      await expect(page.getByRole('alert')).toContainText('Confira os campos');
      await expect(page.getByRole('textbox', { name: 'Nome completo *' })).toHaveValue(record.name);
      await page.getByRole('link', { name: 'Cancelar', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/residentes/${id}$`));
    }
    await expect(dialog).toHaveCount(0);
    expect(attempts).toBe(1);
    expect(registry.writes).toHaveLength(1);
  });
}

test('buscar curso sem alterar o cadastro permite cancelar sem confirmação', async ({ page }) => {
  await mockSession(page);
  const registry = mockRegistry([
    {
      id,
      name: 'Pessoa Sintética',
      enrollment: 'TESTE-001',
      birthDate: '2009-05-14',
      course: null,
      version: 0,
    },
  ]);
  registry.courses.push(
    ...Array.from({ length: 9 }, (_, index) => ({
      id: `00000000-0000-0000-0000-00000000030${index}`,
      name: `Curso Sintético ${index}`,
      active: true,
      version: 0,
    })),
  );
  await registry.attach(page);
  await page.goto(`/residentes/${id}/editar`);
  await expect(page.locator('form[sagerUnsaved]')).toHaveClass(/ng-pristine/);
  await page.getByRole('combobox', { name: 'Curso *', exact: true }).click();
  const search = page.getByRole('combobox', { name: 'Buscar em Curso *' });
  await search.fill('Sintético');
  await search.press('Escape');
  await page.getByRole('link', { name: 'Cancelar', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/residentes/${id}$`));
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expect(registry.writes).toHaveLength(0);
});

test('confirma sair do cadastro alterado e preserva os campos ao continuar', async ({ page }) => {
  await mockSession(page);
  const registry = mockRegistry();
  await registry.attach(page);
  await page.goto('/residentes/novo');
  await page.getByRole('textbox', { name: 'Nome completo *' }).fill('Rascunho Sintético');
  await page.getByRole('link', { name: 'Cancelar', exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Descartar alterações?');
  await dialog.getByRole('button', { name: 'Continuar preenchendo' }).click();
  await expect(page.getByRole('textbox', { name: 'Nome completo *' })).toHaveValue(
    'Rascunho Sintético',
  );
  await page.getByRole('link', { name: 'Cancelar', exact: true }).click();
  await dialog.getByRole('button', { name: 'Descartar e sair' }).click();
  await expect(page).toHaveURL(/\/residentes$/);
  expect(registry.writes).toHaveLength(0);
});
