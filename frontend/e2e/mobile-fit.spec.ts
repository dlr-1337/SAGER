import { expect, type Page, test } from '@playwright/test';
import { enterDemo } from './demo-session';
import { openCollapsed, overflowIssues, phoneSizes } from './mobile-fit';

// Rotas do menu de cada perfil na demonstração, com os detalhes e formulários principais.
const routes = {
  Gestor: [
    '/inicio',
    '/residentes',
    '/residentes/novo',
    '/residentes/r-ana',
    '/responsaveis',
    '/responsaveis/novo',
    '/responsaveis/g-1',
    '/cursos',
    '/supervisores',
    '/supervisores/novo',
    '/supervisores/s-1',
    '/quartos',
    '/quartos/novo',
    '/quartos/q-102',
    '/relatorios',
    '/relatorios/individual/ana',
    '/perfil',
    '/ajuda',
  ],
  Supervisor: [
    '/inicio',
    '/residentes',
    '/residentes/r-ana',
    '/residentes/r-ana/editar',
    '/saidas',
    '/saidas/S-1048',
    '/saidas/S-1047',
    '/saidas/S-1046',
    '/saidas/S-1045',
    '/notificacoes',
    '/notificacoes/N-201',
    '/responsaveis',
    '/responsaveis/g-1/editar',
    '/cursos',
    '/alojamentos',
    '/alojamentos/novo',
    '/quartos',
    '/quartos/q-102/editar',
    '/chamada',
    '/limpeza',
    '/ranking',
    '/relatorios',
    '/ajuda',
  ],
  Residente: [
    '/inicio',
    '/saidas',
    '/saidas/nova',
    '/saidas/S-1048',
    '/avisos',
    '/ranking',
    '/perfil',
    '/ajuda',
  ],
} as const;

async function visit(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator('main h1').first(), path).toBeVisible();
  await openCollapsed(page);
}

test('a varredura acha campo, texto e caixa que passam do card e da tela', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.setContent(`
    <main style="margin:0">
      <section class="panel" style="width:200px">
        <input style="width:260px" />
        <p style="white-space:nowrap">Texto-que-não-quebra-e-passa-do-card</p>
      </section>
      <div class="card" style="width:400px">Caixa larga</div>
    </main>`);
  const issues = await overflowIssues(page);
  expect(issues).toContainEqual(expect.stringMatching(/^a página rola na horizontal/));
  expect(issues).toContainEqual(expect.stringMatching(/^input passa \d+ px de section\.panel/));
  expect(issues).toContainEqual(expect.stringMatching(/^p "Texto-que-não-quebra.* passa \d+ px/));
  expect(issues).toContainEqual(
    expect.stringMatching(/^div\.card "Caixa larga" passa \d+ px de a tela/),
  );
});

for (const [profile, paths] of Object.entries(routes)) {
  for (const size of phoneSizes) {
    test(`${profile} em ${size.width}×${size.height}: nada vaza da tela nem das caixas`, async ({
      page,
    }) => {
      test.setTimeout(150_000);
      await page.setViewportSize(size);
      await enterDemo(page, profile as keyof typeof routes);
      const issues: string[] = [];
      for (const path of paths) {
        await visit(page, path);
        for (const issue of await overflowIssues(page)) issues.push(`${path}: ${issue}`);
      }
      // A gaveta do menu, com perfil e cenário da demonstração. /ajuda é pública e não tem menu.
      await visit(page, '/inicio');
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      const drawer = page.getByRole('dialog', { name: 'SAGER' });
      await expect(drawer.getByRole('link', { name: 'Início' })).toBeInViewport();
      await expect
        .poll(() =>
          page
            .locator('.sidebar')
            .evaluate((element) => Math.round(element.getBoundingClientRect().left)),
        )
        .toBe(0);
      for (const issue of await overflowIssues(page)) issues.push(`menu: ${issue}`);
      expect(issues).toEqual([]);
    });
  }
}

for (const size of phoneSizes) {
  test(`diálogos e filtros da demonstração cabem em ${size.width}×${size.height}`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(size);
    await enterDemo(page, 'Supervisor');
    const issues: string[] = [];
    const collect = async (label: string) => {
      for (const issue of await overflowIssues(page)) issues.push(`${label}: ${issue}`);
    };
    const dialog = page.getByRole('dialog');

    // Aprovar e rejeitar saída.
    for (const action of ['Aprovar', 'Rejeitar']) {
      await page.goto('/saidas/S-1047');
      const button = page.locator('main').getByRole('button', { name: action, exact: true });
      if (!(await button.count())) continue;
      await button.first().click();
      await expect(dialog).toBeVisible();
      await collect(`saída: ${action}`);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    }

    // Decisões da notificação de ocorrência.
    await page.goto('/notificacoes/N-201');
    await expect(page.locator('main h1')).toBeVisible();
    await collect('notificação');
    const archive = page.getByRole('button', { name: 'Arquivar com justificativa' });
    if (await archive.count()) {
      await archive.click();
      await openCollapsed(page);
      await collect('notificação: arquivar');
    }

    // Revisão da chamada noturna.
    await page.goto('/chamada');
    await expect(page.locator('main h1')).toBeVisible();
    await openCollapsed(page);
    await collect('chamada');

    // Filtros do relatório com período escolhido.
    await page.goto('/relatorios');
    const custom = page.getByRole('radio', { name: /Escolher datas|Outro período|Personalizado/ });
    if (await custom.count()) {
      await custom.first().check();
      await openCollapsed(page);
      await expect(page.getByLabel('Data inicial')).toBeVisible();
    }
    await openCollapsed(page);
    await collect('relatórios: filtros');

    // Ciência do aviso, na conta do residente.
    await enterDemo(page, 'Residente');
    await page.goto('/avisos');
    await page.locator('#notice-row-av-1').click();
    const acknowledge = page.getByRole('button', { name: 'Marcar como ciente' });
    if (await acknowledge.count()) {
      await acknowledge.click();
      await collect('aviso: confirmar ciência');
    }
    expect(issues).toEqual([]);
  });
}

for (const size of phoneSizes) {
  test(`${size.width}×${size.height}: o cabeçalho com pendências mostra SAGER, a etiqueta e o Menu sem se cobrirem`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await enterDemo(page, 'Supervisor');
    const toggle = page.getByRole('button', { name: 'Menu', exact: true });
    await expect(toggle.locator('.pending-badge')).toBeVisible();
    await expect(toggle.getByText('Menu', { exact: true })).toBeVisible();
    const boxes = await Promise.all(
      ['.brand-product strong', '.demo-flag strong', '.menu-toggle'].map(
        async (selector) => (await page.locator(selector).boundingBox())!,
      ),
    );
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    }
    for (let i = 1; i < boxes.length; i++)
      expect(boxes[i - 1].x + boxes[i - 1].width).toBeLessThanOrEqual(boxes[i].x);
    // O botão continua alvo de toque de 48 px e dentro do cabeçalho.
    const masthead = (await page.locator('.masthead').boundingBox())!;
    const button = boxes[2];
    expect(button.height).toBeGreaterThanOrEqual(48);
    expect(button.y).toBeGreaterThanOrEqual(masthead.y);
    expect(button.y + button.height).toBeLessThanOrEqual(masthead.y + masthead.height);
  });
}
