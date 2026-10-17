import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { enterDemo } from './demo-session';

const account = {
  id: '00000000-0000-0000-0000-000000000001',
  nome: 'Gestor Sintético',
  email: null,
  matricula: 'TESTE-GESTOR',
  fotoUrl: null,
  perfis: ['gestor'],
  residenteId: null,
  supervisorId: null,
};

for (const demo of [false, true]) {
  for (const initiallyActive of [false, true]) {
    test(`curso em edição preserva situação e rascunho (demo=${demo}, ativo=${initiallyActive})`, async ({
      page,
    }) => {
      const course = {
        id: '00000000-0000-0000-0000-000000000201',
        name: 'Informática',
        active: initiallyActive,
        version: 0,
      };
      const writes: { name: string; active: boolean; version: number }[] = [];
      if (demo) {
        await page.route('**/api/**', (route) => route.abort('failed'));
        await enterDemo(page, 'Gestor');
      } else {
        await page.route('**/api/v1/auth/**', (route) =>
          route.fulfill({
            json: route.request().url().endsWith('/me')
              ? account
              : { headerName: 'X-CSRF-TOKEN', token: 'synthetic' },
          }),
        );
        await page.route('**/api/v1/cursos**', (route) => {
          if (route.request().method() === 'GET') return route.fulfill({ json: [course] });
          const body = route.request().postDataJSON();
          writes.push(body);
          if (body.version !== course.version) return route.fulfill({ status: 409 });
          Object.assign(course, {
            name: body.name,
            active: body.active,
            version: course.version + 1,
          });
          return route.fulfill({ json: course });
        });
      }
      await page.goto('/cursos');
      const row = page
        .locator('.course-row')
        .filter({ has: page.getByText('Informática', { exact: true }) });
      if (demo && !initiallyActive) {
        await row.getByRole('button', { name: 'Desativar', exact: true }).click();
        await expect(row).toContainText('Inativo · mantido nos cadastros existentes');
      }
      await row.getByRole('button', { name: 'Editar', exact: true }).click();
      const name = page.getByLabel('Nome do curso', { exact: true });
      await expect(name).toHaveValue('Informática');
      await name.fill('Informática revisada');
      await row
        .getByRole('button', { name: initiallyActive ? 'Desativar' : 'Reativar', exact: true })
        .click();
      await expect(row).toContainText(
        initiallyActive ? 'Inativo · mantido nos cadastros existentes' : 'Ativo',
      );
      await expect(name).toHaveValue('Informática revisada');
      const save = page.getByRole('button', { name: 'Salvar curso', exact: true });
      await expect(save).toBeEnabled();
      await save.click();
      await expect(page.getByRole('status').filter({ hasText: 'Curso salvo.' })).toBeVisible();
      const revised = page
        .locator('.course-row')
        .filter({ has: page.getByText('Informática revisada', { exact: true }) });
      await expect(revised).toContainText(
        initiallyActive ? 'Inativo · mantido nos cadastros existentes' : 'Ativo',
      );
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expect(page.getByRole('alertdialog')).toHaveCount(0);
      if (!demo) {
        expect(writes).toEqual([
          { name: 'Informática', active: !initiallyActive, version: 0 },
          { name: 'Informática revisada', active: !initiallyActive, version: 1 },
        ]);
        expect(course.version).toBe(2);
      }
    });
  }
}

test('recuperação confere dados, exige confirmação e volta ao acesso sem autenticar', async ({
  page,
}) => {
  let writes = 0;
  await page.route('**/api/v1/auth/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/me')) return route.fulfill({ status: 401 });
    if (path.endsWith('/csrf'))
      return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'synthetic' } });
    if (path.endsWith('/recover')) {
      writes++;
      const body = new URLSearchParams(route.request().postData() ?? '');
      expect(body.get('matricula')).toBe('00123');
      expect(body.get('name')).toBe('Pessoa Sintética');
      expect(body.get('guardianName')).toBe('Responsável Sintética');
      expect(body.get('birthDate')).toBe('2009-01-15');
      expect(body.get('password')).toBe(body.get('passwordConfirmation'));
      expect(route.request().headers()['x-csrf-token']).toBe('synthetic');
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ status: 404 });
  });
  await page.goto('/recuperar-senha');
  const audit = await new AxeBuilder({ page }).include('main').analyze();
  expect(audit.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual(
    [],
  );
  await page.getByLabel('Matrícula', { exact: true }).fill('00123');
  await page.getByLabel('Nome completo', { exact: true }).fill('Pessoa Sintética');
  await page.getByLabel('Data de nascimento', { exact: true }).fill('2009-01-15');
  await page.getByLabel('Nome completo do responsável ativo').fill('Responsável Sintética');
  await page.getByLabel(/^Nova senha/).fill('Senha sintética 123!');
  await page.getByLabel('Confirmar nova senha', { exact: true }).fill('Senha diferente 123!');
  await page.getByRole('button', { name: 'Redefinir senha' }).click();
  await expect(page.getByRole('alert')).toContainText('mesma senha');
  expect(writes).toBe(0);
  await page.getByLabel('Confirmar nova senha', { exact: true }).fill('Senha sintética 123!');
  await page.getByRole('button', { name: 'Redefinir senha' }).click();
  await expect(page.getByRole('heading', { name: 'Senha redefinida' })).toBeVisible();
  expect(writes).toBe(1);
  await expect(page).toHaveURL(/recuperar-senha$/);
  await page.getByRole('link', { name: 'Voltar ao acesso' }).click();
  await expect(page.getByRole('heading', { name: 'Acessar o SAGER' })).toBeVisible();
});

test('recuperação informa o limite de tentativas e preserva os campos para corrigir', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/**', (route) => {
    if (route.request().url().endsWith('/csrf'))
      return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'synthetic' } });
    return route.fulfill({
      status: route.request().url().endsWith('/recover') ? 429 : 401,
      headers: { 'Retry-After': '900' },
    });
  });
  await page.goto('/recuperar-senha');
  await page.getByLabel('Matrícula', { exact: true }).fill('00123');
  await page.getByLabel('Nome completo', { exact: true }).fill('Pessoa Sintética');
  await page.getByLabel('Data de nascimento', { exact: true }).fill('2009-01-15');
  await page.getByLabel(/^Nova senha/).fill('Senha sintética 123!');
  await page.getByLabel('Confirmar nova senha', { exact: true }).fill('Senha sintética 123!');
  await page.getByRole('button', { name: 'Redefinir senha' }).click();
  await expect(page.getByRole('alert')).toContainText('15 minutos');
  await expect(page.getByLabel('Matrícula', { exact: true })).toHaveValue('00123');
});

for (const action of ['desativar', 'renomear'] as const) {
  test(`catálogo volta à primeira página após ${action} o último resultado da segunda`, async ({
    page,
  }) => {
    const courses = Array.from({ length: 26 }, (_, index) => ({
      id: `00000000-0000-0000-0000-${String(index + 201).padStart(12, '0')}`,
      name: `Curso Sintético ${String(index + 1).padStart(2, '0')}`,
      active: true,
      version: 0,
    }));
    let writes = 0;
    await page.route('**/api/v1/auth/**', (route) =>
      route.fulfill({
        json: route.request().url().endsWith('/me')
          ? account
          : { headerName: 'X-CSRF-TOKEN', token: 'synthetic' },
      }),
    );
    await page.route('**/api/v1/cursos**', (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ json: courses });
      expect(route.request().method()).toBe('PUT');
      expect(route.request().headers()['x-csrf-token']).toBe('synthetic');
      const id = new URL(route.request().url()).pathname.split('/').at(-1);
      const item = courses.find((course) => course.id === id)!;
      const body = route.request().postDataJSON();
      expect(body.version).toBe(item.version);
      Object.assign(item, { name: body.name, active: body.active, version: item.version + 1 });
      writes++;
      return route.fulfill({ json: item });
    });
    await page.goto('/cursos');
    await page.getByLabel('Buscar curso', { exact: true }).fill('Sintético');
    const status = page.getByRole('combobox', { name: 'Situação', exact: true });
    await status.selectOption('active');
    await page.getByRole('button', { name: 'Próxima', exact: true }).click();
    await expect(page.locator('.course-row')).toHaveCount(1);
    await expect(page.getByText('Página 2', { exact: true })).toBeVisible();
    if (action === 'desativar')
      await page.getByRole('button', { name: 'Desativar', exact: true }).click();
    else {
      await page.getByRole('button', { name: 'Editar', exact: true }).click();
      await page.getByLabel('Nome do curso', { exact: true }).fill('Fora do filtro');
      await page.getByRole('button', { name: 'Salvar curso', exact: true }).click();
    }
    await expect(page.getByText('25 curso(s) encontrado(s)', { exact: true })).toBeVisible();
    await expect(page.getByText('Página 1', { exact: true })).toBeVisible();
    await expect(page.locator('.course-row')).toHaveCount(25);
    await expect(
      page.getByText('Nenhum curso corresponde aos filtros.', { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByLabel('Buscar curso', { exact: true })).toHaveValue('Sintético');
    await expect(status).toHaveValue('active');
    expect(writes).toBe(1);
  });
}

test('gestor cadastra e desativa curso, e pode continuar uma edição não salva', async ({
  page,
}) => {
  const courses: { id: string; name: string; active: boolean; version: number }[] = [];
  await page.route('**/api/v1/auth/**', (route) =>
    route.fulfill({
      json: route.request().url().endsWith('/me')
        ? account
        : { headerName: 'X-CSRF-TOKEN', token: 'synthetic' },
    }),
  );
  await page.route('**/api/v1/cursos**', (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: courses });
    expect(route.request().headers()['x-csrf-token']).toBe('synthetic');
    const body = route.request().postDataJSON();
    if (route.request().method() === 'POST') {
      const item = {
        id: '00000000-0000-0000-0000-000000000201',
        name: body.name.trim(),
        active: true,
        version: 0,
      };
      courses.push(item);
      return route.fulfill({ status: 201, json: item });
    }
    const item = courses[0];
    expect(body.version).toBe(item.version);
    Object.assign(item, { name: body.name, active: body.active, version: item.version + 1 });
    return route.fulfill({ json: item });
  });
  await page.goto('/cursos');
  await page.getByLabel('Nome do curso', { exact: true }).fill('Curso Sintético');
  await page.getByRole('button', { name: 'Salvar curso' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Curso salvo' })).toBeVisible();
  await expect(page.getByText('Curso Sintético', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Desativar', exact: true }).click();
  await expect(page.getByText('Inativo · mantido nos cadastros existentes')).toBeVisible();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByLabel('Nome do curso', { exact: true }).fill('Rascunho não salvo');
  await page.getByRole('button', { name: 'Cancelar edição' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Descartar alterações?');
  await dialog.getByRole('button', { name: 'Continuar preenchendo' }).click();
  await expect(page.getByLabel('Nome do curso', { exact: true })).toHaveValue('Rascunho não salvo');
  expect(courses[0].name).toBe('Curso Sintético');
});
