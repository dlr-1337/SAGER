import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';

const COURSES = [
  'Administração',
  'Agropecuária',
  'Agronomia',
  'Biologia',
  'Ciência da Computação',
  'Enfermagem',
  'Física',
  'Informática',
  'Química',
  'Zootecnia',
];

async function openResidentForm(page: Page, courses = COURSES) {
  await page.route('**/api/v1/auth/**', (route) =>
    route.request().url().endsWith('/me')
      ? route.fulfill({
          json: {
            id: '00000000-0000-0000-0000-000000000001',
            nome: 'Conta Sintética',
            email: 'conta@example.invalid',
            matricula: 'TESTE-LOGIN',
            fotoUrl: null,
            perfis: ['gestor'],
            residenteId: null,
            supervisorId: null,
          },
        })
      : route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-synthetic' } }),
  );
  await page.route('**/api/v1/cursos**', (route) =>
    route.fulfill({
      json: courses.map((name, index) => ({
        id: `00000000-0000-0000-0000-00000000020${index}`,
        name,
        active: true,
        version: 0,
      })),
    }),
  );
  await page.goto('/residentes/novo');
  const select = page.getByRole('combobox', { name: 'Curso *', exact: true });
  await expect(select.locator('option')).toHaveCount(courses.length + 1);
  return {
    select,
    search: page.getByRole('combobox', { name: 'Buscar em Curso *', exact: true }),
    listbox: page.getByRole('listbox', { name: 'Curso *' }),
    status: page.locator('.select-panel').getByRole('status'),
  };
}

test('clicar, digitar e escolher o curso dentro da lista', async ({ page }) => {
  const { select, search, listbox, status } = await openResidentForm(page);
  await expect(page.getByRole('combobox')).toHaveCount(1);
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  await expect(select.locator('option').first()).toHaveText('Selecione o curso');

  await select.click();
  await expect(search).toBeFocused();
  await expect(status).toHaveText('11 opções');
  await search.fill('agro');
  await expect(status).toHaveText('2 opções');
  await listbox.getByRole('option', { name: 'Agropecuária' }).click();

  await expect(search).toHaveCount(0);
  await expect(select).toHaveValue('00000000-0000-0000-0000-000000000201');
  await expect(select).toBeFocused();
  await expect(page.locator('form[sagerUnsaved]')).toHaveClass(/ng-dirty/);

  await select.click();
  await search.fill('quimíca');
  await expect(status).toHaveText('1 opção');
  await search.fill('zzz');
  await expect(status).toHaveText('Nada encontrado.');
  await page.getByRole('heading', { name: 'Dados do residente' }).click();
  await expect(search).toHaveCount(0);
  await expect(select).toHaveValue('00000000-0000-0000-0000-000000000201');
});

test('teclado abre, navega e escolhe sem enviar o formulário', async ({ page }) => {
  const { select, search, listbox } = await openResidentForm(page);
  await select.focus();
  await page.keyboard.press('ArrowDown');
  await expect(search).toBeFocused();
  await page.keyboard.type('i');
  await page.keyboard.press('ArrowDown');
  const active = await search.getAttribute('aria-activedescendant');
  await expect(listbox.locator(`[id="${active}"]`)).toHaveClass(/active/);
  await page.keyboard.press('Enter');
  await expect(search).toHaveCount(0);
  await expect(select).toBeFocused();
  const chosen = await select.inputValue();
  expect(chosen).not.toBe('');
  await expect(page).toHaveURL(/\/residentes\/novo$/);

  await page.keyboard.press(' ');
  await expect(search).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(search).toHaveCount(0);
  await expect(select).toBeFocused();
  await expect(select).toHaveValue(chosen);

  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Tab');
  await expect(search).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Novo curso', exact: true })).toBeFocused();
});

test('lista de até 8 opções não abre o painel', async ({ page }) => {
  const { select } = await openResidentForm(page, COURSES.slice(0, 7));
  await select.click();
  await expect(page.locator('.select-panel')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await select.selectOption({ label: 'Biologia' });
  await expect(select).toHaveValue('00000000-0000-0000-0000-000000000203');
});

test('painel no desktop e em 320 px: cabe na tela, alvos de 44 px e sem erro de axe', async ({
  page,
}) => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    const { select, search, listbox } = await openResidentForm(page);
    await select.scrollIntoViewIfNeeded();
    await select.click();
    await expect(search).toBeFocused();
    const box = (await page.locator('.select-panel').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    const option = (await listbox.getByRole('option').first().boundingBox())!;
    expect(option.height).toBeGreaterThanOrEqual(44);
    expect((await search.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await search.fill('zzz');
    await expect(listbox).toBeHidden();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});

test('o painel acompanha a rolagem e abre para cima sem espaço abaixo', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  const { select } = await openResidentForm(page);
  await select.evaluate((element) => {
    const spacer = window.document.createElement('div');
    spacer.style.height = '2000px';
    window.document.body.append(spacer);
    window.scrollTo({
      top: element.getBoundingClientRect().top + window.scrollY - 520,
      behavior: 'instant',
    });
  });
  await select.click();
  const panel = page.locator('.select-panel');
  const gapAbove = async () => {
    const panelBox = (await panel.boundingBox())!;
    return Math.round((await select.boundingBox())!.y - (panelBox.y + panelBox.height));
  };
  await expect.poll(gapAbove).toBe(8);
  await page.evaluate(() => window.scrollBy({ top: 100, behavior: 'instant' }));
  await expect.poll(gapAbove).toBe(8);
});
