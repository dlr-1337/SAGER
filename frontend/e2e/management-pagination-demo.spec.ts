import { expect, test } from '@playwright/test';
import { enterDemo } from './demo-session';

for (const config of [
  { resource: 'residentes', entity: 'residente', search: 'search', field: 'name' },
  { resource: 'responsaveis', entity: 'responsável', search: null, field: 'name' },
  { resource: 'supervisores', entity: 'supervisor', search: null, field: 'name' },
  { resource: 'alojamentos', entity: 'alojamento', search: null, field: 'name' },
  { resource: 'quartos', entity: 'quarto', search: 'search', field: 'number' },
]) {
  test(`demo de ${config.resource}: corrige a página ao retornar após uma edição`, async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const apiWrites: string[] = [];
    await page.route('**/api/**', (route) => {
      if (route.request().method() !== 'GET') apiWrites.push(route.request().url());
      return route.abort('failed');
    });
    await enterDemo(page, 'Gestor');
    await page.goto(`/${config.resource}`);
    for (let index = 1; index <= 26; index++) {
      const name = `Sintético A${'abcdefghijklmnopqrstuvwxyz'[index - 1]}`;
      await page.getByRole('link', { name: `Cadastrar ${config.entity}`, exact: true }).click();
      await page.locator(`[formControlName="${config.field}"]`).fill(name);
      if (config.resource === 'residentes') {
        await page
          .locator('[formControlName="enrollment"]')
          .fill(`20261PAG${String(index).padStart(7, '0')}`);
        await page.locator('[formControlName="birthDate"]').fill('2009-01-15');
        await page.locator('[formControlName="courseId"]').selectOption('course-1');
        await page.locator('[formControlName="password"]').fill('Senha sintética 123!');
        await page.locator('[formControlName="passwordConfirmation"]').fill('Senha sintética 123!');
      } else if (config.resource === 'responsaveis') {
        await page.locator('[formControlName="residentId"]').selectOption('r-ana');
        await page.locator('[formControlName="relationship"]').fill('Mãe');
        await page.locator('[formControlName="phone"]').fill('62999990000');
      } else if (config.resource === 'supervisores') {
        await page.locator('[formControlName="institutionalId"]').fill(`PAG-${index}`);
        await page.locator('[formControlName="email"]').fill(`${index}@example.invalid`);
        await page.locator('[formControlName="password"]').fill('Senha sintética 123!');
        await page.locator('[formControlName="passwordConfirmation"]').fill('Senha sintética 123!');
      } else if (config.resource === 'alojamentos') {
        await page.locator('[formControlName="code"]').fill(`PAG-${index}`);
      } else {
        await page.locator('[formControlName="block"]').selectOption('A');
        await page.locator('[formControlName="floor"]').selectOption('Térreo');
        await page.locator('[formControlName="situation"]').selectOption('Disponível');
      }
      await page.getByRole('button', { name: `Salvar ${config.entity}`, exact: true }).click();
      await expect(
        page.getByRole('heading', {
          name: config.resource === 'quartos' ? `Quarto ${name}` : name,
          exact: true,
        }),
      ).toBeVisible();
      await page.locator('main a.mg-back').first().click();
    }
    const search = config.search
      ? page.locator(`[formControlName="${config.search}"]`)
      : page.getByRole('searchbox');
    await expect(search).toHaveClass(/ng-valid/);
    await search.fill('Sintético');
    if (config.resource === 'residentes') {
      await page.locator('[formControlName="courseId"]').selectOption('course-1');
    } else if (config.resource === 'responsaveis') {
      await page.getByRole('combobox', { name: 'Situação', exact: true }).selectOption('true');
      await page.getByRole('combobox', { name: 'Residente', exact: true }).selectOption('r-ana');
    } else if (config.resource === 'quartos') {
      await page.locator('[formControlName="block"]').selectOption('A');
      await page.locator('[formControlName="floor"]').selectOption('Térreo');
    }
    await expect(page.getByText('1–25 de 26', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Próxima', exact: true }).click();
    await expect(page.getByText('26–26 de 26', { exact: true })).toBeVisible();
    const rows = page.locator(config.resource === 'quartos' ? 'a.mg-room-tile' : 'article.mg-row');
    await expect(rows).toHaveCount(1);
    if (config.resource === 'quartos') await rows.click();
    else await rows.locator('a.mg-row-link').click();
    await page
      .getByRole('link', {
        name: config.resource === 'residentes' ? 'Editar cadastro' : `Editar ${config.entity}`,
        exact: true,
      })
      .click();
    await page.locator(`[formControlName="${config.field}"]`).fill('Fora do filtro');
    await page.getByRole('button', { name: `Salvar ${config.entity}`, exact: true }).click();
    await expect(
      page.getByRole('heading', {
        name:
          config.resource === 'quartos'
            ? 'Quarto Fora do filtro'
            : config.resource === 'residentes'
              ? 'Fora Do Filtro'
              : 'Fora do filtro',
        exact: true,
      }),
    ).toBeVisible();
    await page.locator('main a.mg-back').first().click();
    await expect(page.getByRole('navigation', { name: 'Paginação' })).toHaveCount(0);
    await expect(rows).toHaveCount(25);
    await expect(search).toHaveValue('Sintético');
    if (config.resource === 'residentes')
      await expect(page.locator('[formControlName="courseId"]')).toHaveValue('course-1');
    if (config.resource === 'responsaveis') {
      await expect(page.getByRole('combobox', { name: 'Situação', exact: true })).toHaveValue(
        'true',
      );
      await expect(page.getByRole('combobox', { name: 'Residente', exact: true })).toHaveValue(
        'r-ana',
      );
    }
    if (config.resource === 'quartos') {
      await expect(page.locator('[formControlName="block"]')).toHaveValue('A');
      await expect(page.locator('[formControlName="floor"]')).toHaveValue('Térreo');
    }
    expect(apiWrites).toEqual([]);
  });
}
