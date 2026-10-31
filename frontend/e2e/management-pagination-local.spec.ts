import { expect, test } from '@playwright/test';

for (const config of [
  {
    resource: 'supervisores',
    entity: 'supervisor',
    search: 'Nome, matrícula ou SIAPE',
    name: 'Nome completo *',
  },
  {
    resource: 'responsaveis',
    entity: 'responsável',
    search: 'Nome do responsável ou residente',
    name: 'Nome completo *',
  },
  {
    resource: 'alojamentos',
    entity: 'alojamento',
    search: 'Buscar por nome ou código',
    name: 'Nome do alojamento *',
  },
]) {
  test(`${config.resource}: edição reduz o total e corrige a página restaurada`, async ({
    page,
  }) => {
    const resident = {
      id: '00000000-0000-0000-0000-000000000041',
      name: 'Pessoa Vinculada',
      enrollment: 'TESTE-001',
      birthDate: '2009-05-14',
      course: null,
      version: 0,
    };
    const records = Array.from({ length: 26 }, (_, index) => ({
      id: `00000000-0000-0000-0000-${String(index + 101).padStart(12, '0')}`,
      name: `Registro Sintético ${String(index + 1).padStart(2, '0')}`,
      institutionalId: `TESTE-${index + 1}`,
      email: 'teste@example.invalid',
      code: `TESTE-${index + 1}`,
      residentId: resident.id,
      relationship: 'Mãe',
      phone: null,
      active: true,
      version: 0,
    }));
    const queries: URLSearchParams[] = [];
    let writes = 0;
    await page.route('**/api/v1/auth/**', (route) =>
      route.fulfill({
        json: route.request().url().endsWith('/me')
          ? {
              id: '00000000-0000-0000-0000-000000000001',
              nome: 'Gestor Sintético',
              matricula: 'TESTE-GESTOR',
              email: null,
              fotoUrl: null,
              perfis: ['gestor'],
              residenteId: null,
              supervisorId: null,
            }
          : { headerName: 'X-CSRF-TOKEN', token: 'synthetic' },
      }),
    );
    await page.route('**/api/v1/residentes**', (route) =>
      route.fulfill({
        json: new URL(route.request().url()).pathname.endsWith('/residentes')
          ? [resident]
          : resident,
      }),
    );
    await page.route(`**/api/v1/${config.resource}**`, (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.endsWith('/unidades')) return route.fulfill({ json: [] });
      if (url.pathname.endsWith(`/${config.resource}`)) {
        queries.push(url.searchParams);
        const search = (url.searchParams.get('search') ?? '').toLowerCase();
        const matching = records.filter((record) => record.name.toLowerCase().includes(search));
        const offset = Number(url.searchParams.get('offset') ?? 0);
        return route.fulfill({
          headers: { 'X-Total-Count': String(matching.length) },
          json: matching.slice(offset, offset + Number(url.searchParams.get('limit') ?? 25)),
        });
      }
      const item = records.find((record) => record.id === url.pathname.split('/').at(-1));
      if (!item) return route.fulfill({ status: 404 });
      if (request.method() === 'PUT') {
        expect(request.headers()['x-csrf-token']).toBe('synthetic');
        const body = request.postDataJSON();
        expect(body.version).toBe(item.version);
        Object.assign(item, body, { version: item.version + 1 });
        writes++;
      }
      return route.fulfill({ json: item });
    });
    await page.goto(`/${config.resource}`);
    const search = page.getByRole('searchbox', { name: config.search, exact: true });
    await search.fill('Sintético');
    if (config.resource === 'responsaveis') {
      await page.getByRole('combobox', { name: 'Situação', exact: true }).selectOption('true');
      await page
        .getByRole('combobox', { name: 'Residente', exact: true })
        .selectOption(resident.id);
      await expect.poll(() => queries.at(-1)?.get('residentId')).toBe(resident.id);
    }
    await expect.poll(() => queries.at(-1)?.get('search')).toBe('Sintético');
    await expect(page.getByText('1–25 de 26', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Próxima', exact: true }).click();
    await expect(page.getByText('26–26 de 26', { exact: true })).toBeVisible();
    await page.locator('article.mg-row a.mg-row-link').click();
    await page.getByRole('link', { name: `Editar ${config.entity}` }).click();
    await page.getByRole('textbox', { name: config.name, exact: true }).fill('Fora do filtro');
    await page.getByRole('button', { name: `Salvar ${config.entity}`, exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Fora do filtro', exact: true })).toBeVisible();
    expect(writes).toBe(1);
    await page.locator('main a.mg-back').first().click();
    await expect(page.getByText('1–25 de 25', { exact: true })).toBeVisible();
    await expect(page.locator('article.mg-row')).toHaveCount(25);
    await expect(search).toHaveValue('Sintético');
    expect(queries.slice(-2).map((params) => params.get('offset'))).toEqual(['25', '0']);
    expect(queries.at(-1)?.get('search')).toBe('Sintético');
    if (config.resource === 'responsaveis') {
      expect(queries.at(-1)?.get('active')).toBe('true');
      expect(queries.at(-1)?.get('residentId')).toBe(resident.id);
    }
  });
}
