import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { enterDemo } from './demo-session';

async function chooseProfile(
  page: import('@playwright/test').Page,
  profile: 'Supervisor' | 'Gestor' | 'Residente',
) {
  await enterDemo(page, profile);
}

test.beforeEach(async ({ page }) => enterDemo(page));

test('cartão de perfis do acesso entra direto na demonstração', async ({ page }) => {
  // Parte de uma sessão limpa: sem demonstração ativa e sem conta local.
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ status: 401 }));
  await page.evaluate(() => sessionStorage.clear());
  await page.goto('/acesso');
  expect(await page.evaluate(() => sessionStorage.getItem('sager.demo.active'))).toBeNull();
  await page.getByRole('button', { name: /^Gestor/ }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByRole('heading', { name: 'Olá, gestor' })).toBeVisible();
});

test('acesso e painéis de cada perfil', async ({ page }) => {
  await page.goto('/acesso');
  await expect(page.getByRole('heading', { name: 'Entrar no SAGER' })).toBeVisible();
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

test('aprovação longa bloqueada até a conferência simulada do arquivo recebido', async ({
  page,
}) => {
  await page.goto('/saidas/S-1048');
  await expect(page.getByRole('button', { name: 'Aprovar' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Rejeitar' })).toBeEnabled();
  await page.getByRole('button', { name: 'Simular arquivo recebido' }).click();
  await expect(
    page.getByText('Arquivo simulado recebido.', { exact: false }).first(),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aprovar' })).toBeDisabled();
  await page.getByRole('button', { name: 'Conferir autorização' }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByText('Simulação sem validade jurídica.', { exact: false }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirmar conferência' }).click();
  await expect(page.getByText('Simulada e conferida', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aprovar' })).toBeEnabled();
});

test('saída longa pode ser rejeitada antes da conferência com 10 a 2.000 caracteres', async ({
  page,
}) => {
  await page.goto('/saidas/S-1048');
  await expect(page.getByText('Você pode rejeitar antes da conferência')).toBeVisible();
  await page.getByRole('button', { name: 'Rejeitar' }).click();
  const dialog = page.getByRole('dialog');
  const reason = dialog.getByLabel('Justificativa');
  await expect(reason).toHaveAttribute('maxlength', '2000');
  await reason.fill('a'.repeat(9));
  await dialog.getByRole('button', { name: 'Confirmar rejeição' }).click();
  await expect(dialog.getByText('Escreva de 10 a 2.000 caracteres.')).toBeVisible();
  await reason.fill('Sem vaga.!');
  await dialog.getByRole('button', { name: 'Confirmar rejeição' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Rejeitada', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Sem vaga.!').first()).toBeVisible();
});

test('limpeza e ranking da demonstração descrevem a regra adotada com duas casas', async ({
  page,
}) => {
  await page.goto('/limpeza');
  await expect(page.getByRole('heading', { name: 'Regras da avaliação' })).toBeVisible();
  await expect(page.getByText('Critérios pendentes da AE')).toHaveCount(0);
  await page.getByLabel('Quarto').selectOption('A-102');
  await page.getByRole('button', { name: 'Simular avaliação' }).click();
  const summary = page.locator('.op-call-summary');
  await expect(summary).toContainText('7,50');
  await expect(summary).toContainText('8,00');
  await expect(summary).toContainText('0,50 ponto(s)');
  await page.getByRole('link', { name: 'Consultar ranking demonstrativo' }).click();
  await expect(page.getByRole('heading', { name: 'Como o ranking é calculado' })).toBeVisible();
  await expect(page.getByText('Fórmula pendente da AE')).toHaveCount(0);
  await expect(page.getByText('nota ilustrativa 8,00')).toBeVisible();
});

test('endereço antigo de convite mostra página não encontrada', async ({ page }) => {
  await page.goto('/assinatura/S-1048');
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible();
});

test('chamada exige revisão e permite cancelar', async ({ page }) => {
  await page.goto('/chamada');
  const groups = page.getByRole('group', { name: /Presença de/ });
  await expect(groups.first()).toBeVisible();
  const count = await groups.count();
  for (let index = 0; index < count; index++)
    await groups.nth(index).getByRole('button', { name: 'Presente' }).click();
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

test('relatório na demonstração segue o mesmo fluxo e não baixa arquivo', async ({ page }) => {
  await chooseProfile(page, 'Gestor');
  await page.goto('/relatorios');
  await page.getByRole('radio', { name: /Saídas e retornos/ }).check();
  await page.getByRole('radio', { name: 'Escolher datas', exact: true }).check();
  await page.getByLabel('Data inicial').fill('2026-09-30');
  await page.getByLabel('Data final').fill('2026-09-01');
  await page.getByRole('button', { name: 'Gerar relatório' }).click();
  await expect(page.getByRole('alert')).toContainText('A data inicial deve anteceder');
  await page.getByRole('radio', { name: 'Este mês', exact: true }).check();
  await page.getByRole('button', { name: 'Gerar relatório' }).click();
  await expect(page.getByText('3 registros', { exact: false })).toBeVisible();
  const download = page.getByRole('button', { name: 'Baixar PDF' });
  await expect(download).toBeVisible({ timeout: 8000 });
  await download.click();
  await expect(page.getByText('Na demonstração nenhum arquivo é baixado.')).toBeVisible();
  await page.getByRole('link', { name: 'Ver na tela' }).click();
  await expect(page.getByRole('heading', { name: 'Registros', exact: true })).toBeVisible();
  await expect(page.getByText('Ana Luísa Ribeiro').first()).toBeVisible();
});

test('telas no celular de 320 px sem rolagem horizontal da página', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await chooseProfile(page, 'Residente');
  for (const path of ['/inicio', '/saidas', '/saidas/nova', '/avisos', '/ranking']) {
    await page.goto(path);
    await expect(page.locator('main').last()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `overflow em ${path}`).toBeLessThanOrEqual(1);
  }
});

test('acesso, painel e avisos sem violações axe graves', async ({ page }) => {
  await page.goto('/acesso');
  let result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    result.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? '')),
  ).toEqual([]);
  await chooseProfile(page, 'Residente');
  result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    result.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? '')),
  ).toEqual([]);
  await page.goto('/avisos');
  result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    result.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? '')),
  ).toEqual([]);
});

test('foco por teclado usa anel duplo: amarelo por fora e verde-escuro por dentro', async ({
  page,
}) => {
  await page.goto('/residentes');
  await page.keyboard.press('Tab');
  // O atalho não anima box-shadow; um .btn teria transição e leitura instável do estilo.
  await expect(page.locator('.skip-link')).toBeFocused();
  const ring = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement as Element);
    return { outline: style.outlineColor, shadow: style.boxShadow };
  });
  // O amarelo sozinho fica abaixo de 3:1 sobre fundos claros; o anel interno garante o contraste.
  expect(ring.outline).toBe('rgb(244, 186, 53)');
  expect(ring.shadow).toContain('rgb(7, 59, 45)');
});

test('atalho de conteúdo, menu móvel e abas funcionam pelo teclado', async ({ page }) => {
  await page.goto('/inicio');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#conteudo-principal')).toBeFocused();
  await expect(page).toHaveURL(/\/inicio$/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Menu', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );

  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.locator('#profile-select-mobile').selectOption('residente');
  await page.goto('/avisos');
  await page.getByRole('tab', { name: /Avisos/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Advertências/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('tab', { name: /Advertências/ })).toBeFocused();
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

  await page.getByLabel('Perfil', { exact: true }).selectOption('residente');
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
  await page.getByLabel(/^Residente/).selectOption('r-ana');
  await page.getByLabel(/Nome completo/).fill('Carla Ribeiro');
  await page.getByLabel(/Parentesco com o residente/).fill('Tia');
  await page.getByLabel(/Telefone com DDD/).fill('62999990011');
  await page.getByRole('button', { name: /Salvar responsável/ }).click();
  await expect(page.getByRole('heading', { name: 'Carla Ribeiro' })).toBeVisible();
  await expect(page.getByText('Responsável salvo nesta demonstração.')).toBeVisible();
  await page.getByRole('link', { name: /Editar responsável/ }).click();
  await page.getByLabel(/Telefone com DDD/).fill('62999990012');
  await page.getByRole('button', { name: /Salvar responsável/ }).click();
  await expect(page.getByText('(62) 99999-0012')).toBeVisible();
  await page.getByRole('link', { name: 'Responsáveis', exact: true }).first().click();
  await expect(page).toHaveURL(/\/responsaveis$/);
  await expect(page.getByRole('heading', { name: 'Carla Ribeiro' })).toBeVisible();
  await page.getByRole('link', { name: 'Supervisores', exact: true }).first().click();
  // A tela anterior também tem "Ver detalhes": sem esperar, o clique abre um responsável.
  await expect(page.getByRole('heading', { name: 'Buscar supervisores' })).toBeVisible();
  await page
    .getByRole('link', { name: /Ver detalhes/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Helena Supervisora Exemplo' })).toBeVisible();
});
