import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function chooseProfile(page: import('@playwright/test').Page, profile: 'Supervisor' | 'Gestor' | 'Residente') {
  await page.goto('/demonstracao');
  await page.locator('.role-card').filter({ hasText: profile }).click();
  await expect(page).toHaveURL(/\/inicio$/);
}

test('acesso e painéis de cada perfil', async ({ page }) => {
  await page.goto('/acesso');
  await expect(page.getByRole('heading', { name: 'Acessar o SAGER' })).toBeVisible();
  await page.getByRole('link', { name: 'Explorar demonstração' }).click();
  await page.locator('.role-card').filter({ hasText: 'Supervisor' }).click();
  await expect(page.getByRole('heading', { name: /Olá, supervisora/ })).toBeVisible();
  await expect(page.getByText('Pendências para revisar')).toBeVisible();
  await page.getByLabel('Perfil', { exact: true }).selectOption('gestor');
  await expect(page.getByRole('heading', { name: 'Olá, gestor' })).toBeVisible();
  await page.goto('/residentes');
  await expect(page.getByRole('heading', { name: /Residentes/ }).first()).toBeVisible();
  await page.getByLabel('Perfil', { exact: true }).selectOption('residente');
  await expect(page.getByRole('heading', { name: 'Olá, residente' })).toBeVisible();
  await page.goto('/supervisores');
  await expect(page).toHaveURL(/\/acesso-negado$/);
  await expect(page.getByRole('heading', { name: /Acesso não disponível/ })).toBeVisible();
});

test('aprovação longa bloqueada até assinatura simulada', async ({ page }) => {
  await page.goto('/saidas/S-1048');
  await expect(page.getByRole('button', { name: 'Aprovar' })).toBeDisabled();
  await page.getByRole('link', { name: /Abrir link de assinatura simulada/ }).click();
  await expect(page.getByText('Simulação sem validade jurídica.')).toBeVisible();
  await page.getByRole('button', { name: /Revisar documento/ }).click();
  await page.getByRole('button', { name: 'Continuar para confirmação' }).click();
  await page.getByRole('checkbox', { name: /Entendi que esta é uma confirmação/ }).check();
  await page.getByRole('button', { name: 'Confirmar simulação' }).click();
  await expect(page.getByRole('heading', { name: 'Confirmação simulada registrada' })).toBeVisible();
  await page.getByRole('link', { name: 'Acompanhar solicitação' }).click();
  await page.locator('.op-row').filter({ hasText: 'S-1048' }).getByRole('link', { name: /Ver solicitação/ }).click();
  await expect(page.getByRole('button', { name: 'Aprovar' })).toBeEnabled();
});

test('chamada exige revisão e permite cancelar', async ({ page }) => {
  await page.goto('/chamada');
  const groups = page.getByRole('group', { name: /Presença de/ });
  const count = await groups.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index++) await groups.nth(index).getByRole('button', { name: 'Presente' }).click();
  await page.getByRole('button', { name: /Revisar e confirmar chamada/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('button', { name: /Revisar e confirmar chamada/ })).toBeVisible();
  await page.getByRole('button', { name: /Revisar e confirmar chamada/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar chamada' }).click();
  await expect(page.getByText(/Chamada demonstrativa confirmada/)).toBeVisible();
});

test('abrir aviso não equivale a registrar ciência', async ({ page }) => {
  await chooseProfile(page, 'Residente');
  await page.goto('/avisos');
  await page.getByRole('button', { name: /Orientação sobre a chamada noturna/ }).click();
  await expect(page.getByText('Lido · ciência pendente')).toBeVisible();
  await page.getByRole('button', { name: 'Marcar como ciente' }).click();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByText('Lido · ciência pendente')).toBeVisible();
  await page.getByRole('button', { name: 'Marcar como ciente' }).click();
  await page.getByRole('button', { name: 'Confirmar ciência' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Ciente' })).toBeVisible();
});

test('relatório combina filtros, valida datas e simula exportação', async ({ page }) => {
  await chooseProfile(page, 'Gestor');
  await page.goto('/relatorios');
  await page.getByLabel('Tipo de relatório').selectOption('saidas');
  await page.getByLabel('Residente').selectOption('Ana Luísa Ribeiro');
  await page.getByLabel('Ocorrência').selectOption('Saída longa');
  await page.getByLabel('Status').selectOption('Aprovada');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByText('1 registro encontrado')).toBeVisible();
  await page.getByRole('button', { name: 'Simular exportação PDF' }).click();
  await expect(page.getByRole('dialog', { name: 'Exportação de PDF simulada' })).toBeVisible();
  await page.getByRole('button', { name: 'Entendi' }).click();
  await page.getByLabel('Data inicial').fill('2026-09-30');
  await page.getByLabel('Data final').fill('2026-09-01');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByRole('alert')).toContainText('A data inicial não pode ser posterior à data final');
});

test('telas no celular de 320 px sem rolagem horizontal da página', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await chooseProfile(page, 'Residente');
  for (const path of ['/inicio', '/saidas', '/saidas/nova', '/avisos', '/ranking']) {
    await page.goto(path);
    await expect(page.locator('main').last()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `overflow em ${path}`).toBeLessThanOrEqual(1);
  }
});

test('acesso, painel e avisos sem violações axe graves', async ({ page }) => {
  await page.goto('/acesso');
  let result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations.filter(item => ['critical', 'serious'].includes(item.impact ?? ''))).toEqual([]);
  await chooseProfile(page, 'Residente');
  result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations.filter(item => ['critical', 'serious'].includes(item.impact ?? ''))).toEqual([]);
  await page.goto('/avisos');
  result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations.filter(item => ['critical', 'serious'].includes(item.impact ?? ''))).toEqual([]);
});

test('atalho de conteúdo, menu móvel e abas funcionam pelo teclado', async ({ page }) => {
  await page.goto('/inicio');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#conteudo-principal')).toBeFocused();
  await expect(page).toHaveURL(/\/inicio$/);

  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button', {name:'Menu', exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', {name:'Menu', exact:true})).toHaveAttribute('aria-expanded','true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', {name:'Menu', exact:true})).toHaveAttribute('aria-expanded','false');

  await page.getByRole('button', {name:'Menu', exact:true}).click();
  await page.locator('#profile-select-mobile').selectOption('residente');
  await page.goto('/avisos');
  await page.getByRole('tab', {name:/Avisos/}).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', {name:/Advertências/})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('tab', {name:/Advertências/})).toBeFocused();
});

test('seletor de cenários mostra vazio, erro e carregamento', async ({ page }) => {
  await page.goto('/saidas');
  await page.getByLabel('Cenário').selectOption('vazio');
  await expect(page.getByText('Nenhuma solicitação neste cenário')).toBeVisible();
  await page.getByLabel('Cenário').selectOption('erro');
  await expect(page.getByText('Não foi possível carregar as saídas')).toBeVisible();
  await page.getByLabel('Cenário').selectOption('carregando');
  await expect(page.getByText('Carregando solicitações')).toBeVisible();
  await page.getByLabel('Cenário').selectOption('padrao');
  await expect(page.locator('.op-row').first()).toBeVisible();

  await page.getByLabel('Perfil', {exact:true}).selectOption('residente');
  await page.goto('/avisos');
  await page.getByLabel('Cenário').selectOption('vazio');
  await expect(page.getByText('Nenhum item nesta aba')).toBeVisible();
  await page.getByLabel('Cenário').selectOption('erro');
  await expect(page.getByText('Não foi possível carregar as comunicações')).toBeVisible();
});

test('gestor cadastra e edita responsável e consulta detalhe do supervisor', async ({ page }) => {
  await chooseProfile(page, 'Gestor');
  await page.goto('/responsaveis');
  await expect(page.getByRole('heading', { name: 'Responsáveis legais' })).toBeVisible();
  await page.getByRole('link', { name: /Cadastrar responsável/ }).click();
  await page.getByLabel(/Residente vinculado/).selectOption('r-ana');
  await page.getByLabel(/Nome completo/).fill('Carla Ribeiro');
  await page.getByLabel(/Vínculo com o residente/).fill('Tia');
  await page.getByLabel(/Telefone com DDD/).fill('62999990011');
  await page.getByRole('button', { name: /Salvar responsável/ }).click();
  await expect(page.getByRole('heading', { name: 'Carla Ribeiro' })).toBeVisible();
  await expect(page.getByText('Responsável salvo nesta demonstração.')).toBeVisible();
  await page.getByRole('link', { name: /Editar responsável/ }).click();
  await page.getByLabel(/Telefone com DDD/).fill('62999990012');
  await page.getByRole('button', { name: /Salvar responsável/ }).click();
  await expect(page.getByText('62999990012')).toBeVisible();
  await page.getByRole('link', { name: 'Responsáveis', exact: true }).first().click();
  await expect(page.getByText('Carla Ribeiro')).toBeVisible();
  await page.getByRole('link', { name: 'Supervisores', exact: true }).first().click();
  await page.getByRole('link', { name: /Ver detalhes/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Helena Supervisora Exemplo' })).toBeVisible();
});
