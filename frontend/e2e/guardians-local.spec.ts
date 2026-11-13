import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';

const residentId = '00000000-0000-0000-0000-000000000041';
const guardianId = '00000000-0000-0000-0000-000000000051';
const resident = {
  id: residentId,
  name: 'Estudante Sintético',
  enrollment: 'TESTE-001',
  birthDate: null,
  course: null,
  version: 0,
};
type Guardian = {
  id: string;
  residentId: string;
  name: string;
  relationship: string;
  phone: string | null;
  active: boolean;
  version: number;
};

async function session(page: Page, profile: 'gestor' | 'supervisor' = 'gestor') {
  await page.route('**/api/v1/auth/**', (route) => {
    if (route.request().url().endsWith('/me'))
      return route.fulfill({
        json: {
          id: '00000000-0000-0000-0000-000000000001',
          nome: 'Conta Sintética',
          email: 'conta@example.invalid',
          matricula: 'TESTE-LOGIN',
          fotoUrl: null,
          perfis: [profile],
          residenteId: null,
          supervisorId: null,
        },
      });
    return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-synthetic' } });
  });
}

function registry(initial: Guardian[] = [], residents = [resident]) {
  const records = initial;
  const writes: Record<string, unknown>[] = [];
  let failList = false;
  async function attach(page: Page) {
    await page.route('**/api/v1/residentes**', (route) => {
      const path = new URL(route.request().url()).pathname;
      return route.fulfill({
        json: path.endsWith('/residentes')
          ? residents
          : residents.find((item) => path.endsWith(item.id)),
      });
    });
    await page.route('**/api/v1/responsaveis**', (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const recordId = path.split('/').at(-1);
      if (request.method() === 'GET') {
        if (failList && path.endsWith('/responsaveis')) {
          return route.fulfill({ status: 503, json: { code: 'unavailable' } });
        }
        const value = path.endsWith('/responsaveis')
          ? records
          : records.find((item) => item.id === recordId);
        return route.fulfill(value ? { json: value } : { status: 404 });
      }
      expect(request.headers()['x-csrf-token']).toBe('csrf-synthetic');
      const body = request.postDataJSON() as Record<string, unknown>;
      writes.push(body);
      const old = records.find((item) => item.id === recordId);
      if (request.method() === 'PUT' && !old) return route.fulfill({ status: 404 });
      if (old && body['version'] !== old.version) {
        return route.fulfill({ status: 409, json: { code: 'stale_version' } });
      }
      const value: Guardian = {
        id: old?.id ?? guardianId,
        residentId: body['residentId'] as string,
        name: body['name'] as string,
        relationship: body['relationship'] as string,
        phone: body['phone'] as string | null,
        active: body['active'] as boolean,
        version: old ? old.version + 1 : 0,
      };
      if (old) Object.assign(old, value);
      else records.push(value);
      return route.fulfill({ status: old ? 200 : 201, json: value });
    });
  }
  return {
    attach,
    records,
    writes,
    setFailList: (value: boolean) => {
      failList = value;
    },
  };
}

for (const edit of [false, true]) {
  test(`responsável mantém envio único com gravação lenta (${edit ? 'edição' : 'criação'})`, async ({
    page,
  }) => {
    await session(page);
    const guardian: Guardian = {
      id: guardianId,
      residentId,
      name: 'Responsável Sintético',
      relationship: 'Mãe',
      phone: null,
      active: true,
      version: 0,
    };
    const data = registry(edit ? [guardian] : []);
    await data.attach(page);
    await page.goto(edit ? `/responsaveis/${guardianId}/editar` : '/responsaveis/novo');
    await page.getByLabel('Residente *', { exact: true }).selectOption(residentId);
    await page.getByRole('textbox', { name: 'Nome completo *' }).fill('Responsável Sintético');
    await page.getByRole('textbox', { name: 'Parentesco com o residente *' }).fill('Mãe');
    await page.getByRole('textbox', { name: 'Telefone com DDD *' }).fill('(62) 99999-0000');
    // A navegação não volta mais a /auth/me; a espera fica na própria gravação.
    let held = 0;
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/v1/responsaveis**', async (route) => {
      if (route.request().method() === 'GET') return route.fallback();
      held++;
      await pending;
      await route.fallback();
    });
    const submit = page.getByRole('button', { name: 'Salvar responsável', exact: true });
    await submit.click();
    try {
      await expect.poll(() => held).toBe(1);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.locator('button[type="submit"]')).toBeDisabled();
      await page.locator('form.mg-form').dispatchEvent('submit');
      expect(held).toBe(1);
    } finally {
      release();
    }
    await expect(page).toHaveURL(`/responsaveis/${guardianId}?saved=1`);
    await expect(page.getByRole('heading', { name: guardian.name, exact: true })).toBeVisible();
    expect(data.writes).toHaveLength(1);
    expect(data.records).toHaveLength(1);
  });
}

test('Enter na busca do seletor não salva antes de escolher o residente', async ({ page }) => {
  await session(page);
  const residents = Array.from({ length: 9 }, (_, index) => ({
    ...resident,
    id:
      index === 0 ? residentId : `00000000-0000-0000-0000-${String(index + 41).padStart(12, '0')}`,
    name: `Estudante Sintético ${index + 1}`,
    enrollment: `TESTE-${index + 1}`,
  }));
  const guardian: Guardian = {
    id: guardianId,
    residentId,
    name: 'Responsável Sintético',
    relationship: 'Mãe',
    phone: null,
    active: true,
    version: 0,
  };
  const data = registry([guardian], residents);
  await data.attach(page);
  await page.goto(`/responsaveis/${guardianId}/editar`);
  const select = page.getByRole('combobox', { name: /^Residente/ });
  await expect(select).toHaveValue(residentId);
  await select.click();
  const search = page.getByRole('combobox', { name: 'Buscar em Residente' });
  await search.fill(residents[1].name);
  await search.press('Enter');
  await expect(search).toHaveCount(0);
  await expect(select).toBeFocused();
  await expect(select).toHaveValue(residents[1].id);
  await expect(page).toHaveURL(`/responsaveis/${guardianId}/editar`);
  expect(data.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Salvar responsável', exact: true }).click();
  await expect(page.getByRole('heading', { name: guardian.name, exact: true })).toBeVisible();
  expect(data.writes).toHaveLength(1);
  expect(data.writes[0]).toMatchObject({ residentId: residents[1].id, version: 0 });
});

test('gestor cadastra, consulta, edita e recarrega responsável sem autorização fictícia', async ({
  page,
}) => {
  await session(page);
  const data = registry();
  await data.attach(page);
  await page.goto('/responsaveis');
  await expect(page.getByRole('heading', { name: 'Nenhum responsável cadastrado' })).toBeVisible();
  await expect(page.getByText('Mariana Ribeiro')).toHaveCount(0);
  await page.getByRole('link', { name: 'Cadastrar responsável' }).click();
  await page.getByLabel('Residente *', { exact: true }).selectOption(residentId);
  await page.getByRole('textbox', { name: 'Nome completo *' }).fill('Responsável Sintético');
  await page
    .getByRole('textbox', { name: 'Parentesco com o residente *' })
    .fill('pessoa com guarda');
  await page.getByRole('button', { name: 'Salvar responsável' }).click();
  await expect(page.getByText('Digite o telefone com DDD.')).toBeVisible();
  expect(data.writes).toHaveLength(0);
  await page.getByRole('textbox', { name: 'Telefone com DDD *' }).fill('62 99999 0000');
  await page.getByRole('button', { name: 'Salvar responsável' }).click();
  await expect(page.getByRole('heading', { name: 'Responsável Sintético' })).toBeVisible();
  await expect(page.getByText('Autorização de saída longa')).toHaveCount(0);
  expect(data.writes[0]).toMatchObject({ residentId, phone: '(62) 99999-0000', active: true });
  expect(data.writes[0]).not.toHaveProperty('authorized');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Responsável Sintético' })).toBeVisible();
  await page.getByRole('link', { name: 'Editar responsável' }).click();
  await page.getByRole('textbox', { name: 'Telefone com DDD *' }).fill('62 98888 0000');
  await page.getByRole('button', { name: 'Salvar responsável' }).click();
  await expect(page.getByText('(62) 98888-0000')).toBeVisible();
  await page.goto(`/residentes/${residentId}`);
  await page.getByRole('button', { name: 'Responsáveis' }).click();
  await expect(page.getByRole('heading', { name: 'Responsável Sintético' })).toBeVisible();
  await expect(
    page.getByText('Cada saída longa precisa da autorização do responsável', { exact: false }),
  ).toBeVisible();
});

test('formulário valida nome e vínculo após remover espaços das pontas', async ({ page }) => {
  await session(page);
  const data = registry();
  await data.attach(page);
  await page.goto('/responsaveis/novo');
  await page.getByLabel('Residente *', { exact: true }).selectOption(residentId);
  await page.getByRole('textbox', { name: 'Nome completo *' }).fill('  AB  ');
  await page.getByRole('textbox', { name: 'Parentesco com o residente *' }).fill('  A  ');
  await page.getByRole('button', { name: 'Salvar responsável' }).click();
  await expect(page.getByText('Digite o nome completo, como no documento.')).toBeVisible();
  await expect(page.getByText('Escreva o vínculo, como mãe ou pai.')).toBeVisible();
  expect(data.writes).toHaveLength(0);

  await page.getByRole('textbox', { name: 'Nome completo *' }).fill('  Ana Li  ');
  await page.getByRole('textbox', { name: 'Parentesco com o residente *' }).fill('  AB  ');
  await page.getByRole('textbox', { name: 'Telefone com DDD *' }).fill('  (62) 3333-4444  ');
  await page.getByRole('button', { name: 'Salvar responsável' }).click();
  await expect(page.getByRole('heading', { name: 'Ana Li' })).toBeVisible();
  expect(data.writes[0]).toMatchObject({
    name: 'Ana Li',
    relationship: 'AB',
    phone: '(62) 3333-4444',
  });
});

test('conflito em duas abas exige recarregar antes de salvar', async ({ page, context }) => {
  await session(page);
  const data = registry([
    {
      id: guardianId,
      residentId,
      name: 'Responsável Original',
      relationship: 'pessoa com guarda',
      phone: null,
      active: true,
      version: 0,
    },
  ]);
  await data.attach(page);
  await page.goto(`/responsaveis/${guardianId}/editar`);
  await expect(page.getByRole('textbox', { name: 'Nome completo *' })).toHaveValue(
    'Responsável Original',
  );
  const other = await context.newPage();
  await session(other);
  await data.attach(other);
  await other.goto(`/responsaveis/${guardianId}/editar`);
  await expect(other.getByRole('textbox', { name: 'Nome completo *' })).toHaveValue(
    'Responsável Original',
  );
  await other.getByRole('textbox', { name: 'Nome completo *' }).fill('Outra Alteração');
  await other.getByRole('button', { name: 'Salvar responsável' }).click();
  await expect(other.getByRole('heading', { name: 'Outra Alteração' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Nome completo *' }).fill('Alteração Antiga');
  await page.getByRole('button', { name: 'Salvar responsável' }).click();
  await expect(page.getByRole('alert')).toContainText('Outra pessoa alterou este registro');
  await expect(page).toHaveURL(new RegExp(`/responsaveis/${guardianId}/editar$`));
  await page.getByRole('button', { name: 'Recarregar dados' }).click();
  await expect(page.getByRole('textbox', { name: 'Nome completo *' })).toHaveValue(
    'Outra Alteração',
  );
  await other.close();
});

test('erro local não carrega demo; supervisor edita; demonstração funciona offline', async ({
  page,
}) => {
  await session(page);
  const data = registry([
    {
      id: guardianId,
      residentId,
      name: 'Responsável Sintético',
      relationship: 'mãe',
      phone: null,
      active: true,
      version: 0,
    },
  ]);
  data.setFailList(true);
  await data.attach(page);
  await page.goto('/responsaveis');
  await expect(
    page.getByRole('heading', { name: 'Não foi possível carregar responsáveis' }),
  ).toBeVisible();
  await expect(page.getByText('Mariana Ribeiro')).toHaveCount(0);
  data.setFailList(false);
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByRole('heading', { name: 'Responsável Sintético' })).toBeVisible();
  const supervisor = await page.context().newPage();
  await session(supervisor, 'supervisor');
  await data.attach(supervisor);
  await supervisor.goto('/responsaveis');
  await expect(supervisor.getByRole('heading', { name: 'Responsável Sintético' })).toBeVisible();
  await expect(supervisor.getByRole('link', { name: 'Cadastrar responsável' })).toBeVisible();
  await supervisor.goto(`/responsaveis/${guardianId}/editar`);
  await expect(supervisor.getByRole('heading', { name: 'Editar responsável' })).toBeVisible();
  await supervisor.close();
  const demo = await page.context().newPage();
  await demo.route('**/api/**', (route) => route.abort('failed'));
  await demo.goto('/demonstracao');
  await demo.getByRole('button', { name: /Entrar como gestor/i }).click();
  await expect(demo).toHaveURL(/\/inicio$/);
  await demo.goto('/responsaveis');
  await expect(demo.getByText('Mariana Ribeiro')).toBeVisible();
  await demo.goto('/responsaveis/g-1');
  await expect(demo.getByRole('heading', { name: 'Mariana Ribeiro' })).toBeVisible();
  await demo.goto('/responsaveis/novo');
  await expect(demo.getByRole('heading', { name: 'Cadastrar responsável' })).toBeVisible();
  await demo.close();
});

test('formulário local é acessível e não transborda em celular', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await session(page);
  await registry().attach(page);
  await page.goto('/responsaveis/novo');
  await expect(page.getByRole('heading', { name: 'Cadastrar responsável' })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(1);
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? '')),
  ).toEqual([]);
});
