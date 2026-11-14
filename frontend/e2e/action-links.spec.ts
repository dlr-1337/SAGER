import { expect, test, type Locator } from '@playwright/test';
import { enterDemo } from './demo-session';

const underline = (link: Locator) =>
  link.evaluate((element) => getComputedStyle(element).textDecorationLine);
const color = (link: Locator) => link.evaluate((element) => getComputedStyle(element).color);

async function expectUnderlineOnlyOnHover(link: Locator): Promise<void> {
  await link.scrollIntoViewIfNeeded();
  await link.page().mouse.move(0, 0);
  expect(await underline(link)).toBe('none');
  const restColor = await color(link);

  await link.hover();
  expect(await underline(link)).toBe('underline');
  expect(await color(link)).not.toBe(restColor);
}

// Num link flex o ícone vira item e herda o sublinhado; inline-block, ele fica fora da linha.
async function expectIconOutsideUnderline(link: Locator): Promise<void> {
  await link.hover();
  const layout = await link.evaluate((element) => {
    const icon = element.querySelector('.material-symbols-rounded, .material-symbols-outlined');
    if (!icon) throw new Error('Link sem ícone.');
    const box = icon.getBoundingClientRect();
    const range = document.createRange();
    const crossing = [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
      .flatMap((node) => {
        range.selectNode(node);
        return [...range.getClientRects()];
      })
      .some(
        (line) =>
          line.left < box.right &&
          box.left < line.right &&
          line.top < box.bottom &&
          box.top < line.bottom,
      );
    return {
      link: getComputedStyle(element).display,
      icon: getComputedStyle(icon).display,
      crossing,
    };
  });
  expect(layout.link).not.toMatch(/flex|grid/);
  expect(layout.icon).toBe('inline-block');
  expect(layout.crossing).toBe(false);
}

test('link de ação com ícone sublinha só no hover', async ({ page }) => {
  await enterDemo(page);
  await expectUnderlineOnlyOnHover(
    page.getByRole('link', { name: 'Abrir ajuda', exact: true }).first(),
  );

  await page.goto('/saidas');
  const row = page.locator('a.op-row-link').first();
  await expectUnderlineOnlyOnHover(row);
  await expectIconOutsideUnderline(row);
});

test('ícone antes do texto: só a palavra do link de voltar fica sublinhada', async ({ page }) => {
  await enterDemo(page, 'Gestor');
  await page.goto('/responsaveis');
  const row = page.locator('a.mg-row-link').first();
  await expectUnderlineOnlyOnHover(row);
  await expectIconOutsideUnderline(row);

  // O formulário tem o mesmo link de voltar do detalhe, que a demonstração abre sem alojamentos.
  await page.goto('/alojamentos/novo');
  const back = page.locator('a.mg-back', { hasText: 'Alojamentos' });
  await expectUnderlineOnlyOnHover(back);
  await expectIconOutsideUnderline(back);
});

test('link de texto, sem ícone, continua sublinhado em repouso', async ({ page }) => {
  await page.goto('/acesso');
  const link = page.getByRole('link', { name: 'Esqueci minha senha' });
  await expect(link).toBeVisible();
  expect(await underline(link)).toBe('underline');
});
