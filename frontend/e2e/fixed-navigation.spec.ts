import { expect, type Page, test } from '@playwright/test';
import { enterDemo } from './demo-session';

async function scrollToEnd(page: Page): Promise<void> {
  await page.evaluate(() =>
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }),
  );
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
}

// O servidor de desenvolvimento marca a página como local; o gateway de produção troca o marcador.
async function productionAccess(page: Page): Promise<void> {
  await page.route('**/acesso', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      'name="sager-environment" content="local"',
      'name="sager-environment" content="production"',
    );
    await route.fulfill({ response, body });
  });
  await page.goto('/acesso');
  await expect(page.getByRole('heading', { name: 'Entrar no SAGER' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ajuda para acessar' })).toBeVisible();
}

const pageScrolls = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);

test('no computador, cabeçalho e menu ficam à vista até o fim da página', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await enterDemo(page);
  await page.goto('/ranking');
  await expect(page.locator('main h1')).toBeVisible();
  await scrollToEnd(page);
  const masthead = page.locator('.app-shell > .masthead');
  expect((await masthead.boundingBox())?.y).toBe(0);
  await expect(masthead.getByRole('button', { name: 'Sair da demonstração' })).toBeInViewport({
    ratio: 1,
  });
  const menu = page.getByRole('complementary', { name: 'Navegação principal' });
  await expect(menu.getByRole('link', { name: 'Início' })).toBeInViewport({ ratio: 1 });
  await expect(menu.getByRole('button', { name: 'Sair da demonstração' })).toBeInViewport({
    ratio: 1,
  });
  // O foco num item do topo para abaixo do cabeçalho, não por baixo dele.
  const heading = page.locator('main h1');
  await heading.evaluate((element) => {
    element.setAttribute('tabindex', '-1');
    element.focus();
  });
  const header = (await masthead.boundingBox())!;
  // A rolagem do html é suave: espera a página parar.
  await expect
    .poll(async () => (await heading.boundingBox())!.y)
    .toBeGreaterThanOrEqual(header.y + header.height);
});

test('no celular, Menu fica à vista e abre a gaveta com o botão de sair', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await enterDemo(page);
  await page.goto('/ranking');
  await expect(page.locator('main h1')).toBeVisible();
  await scrollToEnd(page);
  const toggle = page.getByRole('button', { name: 'Menu' });
  await expect(toggle).toBeInViewport({ ratio: 1 });
  await toggle.click();
  const drawer = page.getByRole('dialog', { name: 'SAGER' });
  await expect(drawer.getByRole('link', { name: 'Início' })).toBeInViewport();
  await drawer.getByRole('button', { name: 'Sair da demonstração' }).scrollIntoViewIfNeeded();
  await expect(drawer.getByRole('button', { name: 'Sair da demonstração' })).toBeInViewport();
});

for (const size of [
  { width: 360, height: 640 },
  { width: 1366, height: 617 },
]) {
  test(`acesso cabe sem rolar em ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await productionAccess(page);
    expect(await pageScrolls(page)).toBe(false);
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeInViewport({ ratio: 1 });
  });
}

test('acesso em tela menor que o formulário ainda rola até Entrar', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await productionAccess(page);
  expect(await pageScrolls(page)).toBe(true);
  await scrollToEnd(page);
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('link', { name: 'Ajuda para acessar' })).toBeInViewport({
    ratio: 1,
  });
});
