import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';

interface Accommodation {
  id: string;
  code: string;
  name: string;
  version: number;
}
interface Unit extends Accommodation {
  accommodationId: string;
}
const firstId = '00000000-0000-0000-0000-000000000031';
const unitId = '00000000-0000-0000-0000-000000000032';

async function mockSession(page: Page, profile = 'gestor') {
  await page.route('**/api/v1/auth/**', (route) => {
    if (route.request().url().endsWith('/me'))
      return route.fulfill({
        json: {
          id: '00000000-0000-0000-0000-000000000001',
          nome: 'Conta Fictícia',
          email: 'ficticia@example.invalid',
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

function mockRegistry(page: Page, initial: Accommodation[] = []) {
  const accommodations = [...initial];
  const units: Unit[] = [];
  const writes: { method: string; version: unknown }[] = [];
  const ready = page.route('**/api/v1/alojamentos**', (route) => {
    const request = route.request();
    const parts = new URL(request.url()).pathname.split('/').filter(Boolean);
    const isUnit = parts[4] === 'unidades';
    const id = parts[isUnit ? 5 : 3];
    const collection = isUnit ? units : accommodations;
    if (request.method() === 'GET') {
      const result = id ? collection.find((entry) => entry.id === id) : collection;
      return route.fulfill(result ? { json: result } : { status: 404 });
    }
    expect(request.headers()['x-csrf-token']).toBe('csrf-synthetic');
    const body = request.postDataJSON();
    writes.push({ method: request.method(), version: body.version });
    const prior = collection.find((entry) => entry.id === id);
    if (prior && body.version !== prior.version)
      return route.fulfill({ status: 409, json: { code: 'stale_version' } });
    if (
      collection.some(
        (entry) => entry.id !== id && entry.code.toLowerCase() === body.code.toLowerCase(),
      )
    ) {
      return route.fulfill({ status: 409, json: { code: 'duplicate_code' } });
    }
    const result = {
      ...body,
      id: id ?? (isUnit ? unitId : firstId),
      version: prior ? prior.version + 1 : 0,
      ...(isUnit ? { accommodationId: parts[3] } : {}),
    };
    if (prior) Object.assign(prior, result);
    else collection.push(result);
    return route.fulfill({ status: prior ? 200 : 201, json: result });
  });
  return { ready, accommodations, units, writes };
}

test('cadastro de alojamento e casa, edição e recarga com CSRF e versão', async ({ page }) => {
  await mockSession(page);
  const registry = mockRegistry(page);
  await registry.ready;
  await page.goto('/alojamentos');
  await expect(page.getByRole('heading', { name: 'Nenhum alojamento cadastrado' })).toBeVisible();
  await page.getByRole('link', { name: 'Cadastrar alojamento' }).click();
  await page.getByRole('textbox', { name: /Código do alojamento/ }).fill('TESTE-A');
  await page.getByRole('textbox', { name: /Nome do alojamento/ }).fill('Alojamento Sintético');
  await page.getByRole('button', { name: 'Salvar alojamento' }).click();
  await expect(page.getByRole('heading', { name: 'Alojamento Sintético' })).toBeVisible();
  await page.getByRole('button', { name: 'Adicionar casa ou bloco' }).click();
  await page.getByRole('textbox', { name: /Código da casa ou bloco/ }).fill('CASA-01');
  await page.getByRole('textbox', { name: /Nome da casa ou bloco/ }).fill('Casa Sintética');
  await page.getByRole('button', { name: 'Salvar casa ou bloco' }).click();
  await expect(page.getByRole('heading', { name: 'Casa Sintética', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Editar Casa Sintética', exact: true }).click();
  await page.getByRole('textbox', { name: /Nome da casa ou bloco/ }).fill('Casa Atualizada');
  await page.getByRole('button', { name: 'Salvar casa ou bloco' }).click();
  await page.getByRole('link', { name: 'Editar alojamento' }).click();
  await page.getByRole('textbox', { name: /Nome do alojamento/ }).fill('Alojamento Atualizado');
  await page.getByRole('button', { name: 'Salvar alojamento' }).click();
  await expect(page.getByRole('heading', { name: 'Alojamento Atualizado' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Alojamento Atualizado' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Casa Atualizada' })).toBeVisible();
  expect(registry.writes).toEqual([
    { method: 'POST', version: undefined },
    { method: 'POST', version: undefined },
    { method: 'PUT', version: 0 },
    { method: 'PUT', version: 0 },
  ]);
});

test('duplicidade, conflito em duas abas e recarga não perdem a edição nem geram sucesso falso', async ({
  page,
  context,
}) => {
  await mockSession(page);
  const registry = mockRegistry(page, [
    { id: firstId, code: 'TESTE-A', name: 'Original', version: 0 },
  ]);
  await registry.ready;
  await page.goto('/alojamentos/novo');
  await page.getByRole('textbox', { name: /Código do alojamento/ }).fill('teste-a');
  await page.getByRole('textbox', { name: /Nome do alojamento/ }).fill('Duplicado');
  await page.getByRole('button', { name: 'Salvar alojamento' }).click();
  await expect(page.getByRole('alert')).toContainText('Já existe um cadastro');
  await expect(page).toHaveURL(/\/alojamentos\/novo$/);
  await page.goto(`/alojamentos/${firstId}/editar`);
  const second = await context.newPage();
  await mockSession(second);
  await second.route('**/api/v1/alojamentos**', (route) =>
    route.fulfill({ json: registry.accommodations[0] }),
  );
  await second.goto(`/alojamentos/${firstId}/editar`);
  await expect(second.getByRole('textbox', { name: /Nome do alojamento/ })).toHaveValue('Original');
  registry.accommodations[0] = {
    ...registry.accommodations[0],
    name: 'Versão Externa',
    version: 1,
  };
  await page.getByRole('textbox', { name: /Nome do alojamento/ }).fill('Minha Edição');
  await page.getByRole('button', { name: 'Salvar alojamento' }).click();
  await expect(page.getByRole('alert')).toContainText('Outra pessoa alterou este registro');
  await expect(page.getByRole('textbox', { name: /Nome do alojamento/ })).toHaveValue(
    'Minha Edição',
  );
  await page.getByRole('button', { name: 'Recarregar dados' }).click();
  await expect(page.getByRole('textbox', { name: /Nome do alojamento/ })).toHaveValue(
    'Versão Externa',
  );
});

test('supervisor gerencia alojamentos; API indisponível não traz demo', async ({ page }) => {
  await mockSession(page, 'supervisor');
  const registry = mockRegistry(page, [
    { id: firstId, code: 'TESTE-A', name: 'Somente Leitura', version: 0 },
  ]);
  await registry.ready;
  await page.goto('/alojamentos');
  await expect(page.getByRole('heading', { name: 'Somente Leitura' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cadastrar alojamento' })).toBeVisible();
  await page.getByRole('link', { name: 'Ver alojamento' }).click();
  await expect(page.getByRole('link', { name: 'Editar alojamento' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adicionar casa ou bloco' })).toBeVisible();
  await page.goto('/alojamentos/novo');
  await expect(page.getByRole('heading', { name: 'Cadastrar alojamento' })).toBeVisible();
  await page.unroute('**/api/v1/alojamentos**');
  await page.route('**/api/v1/alojamentos**', (route) => route.abort('failed'));
  await page.goto('/alojamentos');
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar');
  await expect(page.getByRole('heading', { name: 'Somente Leitura' })).toHaveCount(0);
});

test('alojamentos são utilizáveis na demonstração offline e acessíveis em desktop e celular', async ({
  page,
}) => {
  await page.route('**/api/**', (route) => route.abort('failed'));
  await page.goto('/demonstracao');
  await page.getByRole('button', { name: /Entrar como gestor/i }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  await page.goto('/alojamentos/novo');
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole('heading', { name: 'Cadastrar alojamento' })).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.getByRole('textbox', { name: /Código do alojamento/ }).fill('DEMO');
  await page.getByRole('textbox', { name: /Nome do alojamento/ }).fill('Alojamento Fictício');
  await page.getByRole('button', { name: 'Salvar alojamento' }).click();
  await expect(page.getByRole('status')).toContainText('Alojamento salvo nesta demonstração');
  await expect(page.getByRole('heading', { name: 'Alojamento Fictício' })).toBeVisible();
});

test('aguarda um salvamento pendente antes de sair do formulário', async ({ page }) => {
  await mockSession(page);
  const record = {
    id: firstId,
    code: 'TESTE-A',
    name: 'Alojamento Sintético',
    version: 0,
  };
  let releaseSave!: () => void;
  let announceSave!: () => void;
  const heldSave = new Promise<void>((resolve) => (releaseSave = resolve));
  const saveStarted = new Promise<void>((resolve) => (announceSave = resolve));
  await page.route('**/api/v1/alojamentos**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'POST') {
      announceSave();
      await heldSave;
      return route.fulfill({ status: 201, json: record });
    }
    return route.fulfill({ json: path.endsWith('/alojamentos') ? [] : record });
  });

  await page.goto('/alojamentos/novo');
  await page.getByRole('textbox', { name: /Código do alojamento/ }).fill(record.code);
  await page.getByRole('textbox', { name: /Nome do alojamento/ }).fill(record.name);
  await page.getByRole('button', { name: 'Salvar alojamento' }).click();
  await saveStarted;
  await page.getByRole('link', { name: 'Cancelar', exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Salvamento em andamento');
  await dialog.getByRole('button', { name: 'Aguardar' }).click();
  await expect(page).toHaveURL(/\/alojamentos\/novo$/);
  releaseSave();
  await expect(page).toHaveURL(new RegExp(`/alojamentos/${firstId}`));
});
