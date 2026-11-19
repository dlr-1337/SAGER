import { expect, type Page } from '@playwright/test';

/** Tamanhos de celular da varredura: um comum e o menor que o SAGER atende. */
export const phoneSizes = [
  { width: 360, height: 740 },
  { width: 320, height: 568 },
] as const;

/**
 * Caixas onde nada pode vazar: painéis, cartões, diálogos, avisos, campos e itens de lista.
 * A tela inteira (`main`) também conta.
 */
const containers = [
  'main',
  '.panel',
  '[class*="-panel"]',
  '[class*="card"]',
  'dialog',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '.mat-mdc-dialog-surface',
  'mat-dialog-content',
  'mat-dialog-actions',
  'fieldset',
  'details',
  'form',
  'section',
  'article',
  'li',
  'label',
  '.field',
  '.confirm-box',
  '.home-hero',
  '.op-help',
  '.op-warning',
  '.op-error',
  '.op-empty',
  '.op-state',
  '.op-actions',
  '.action-row',
  '.step-actions',
].join(',');

/**
 * Lista o que sai da tela ou do seu container: rolagem horizontal da página, rolagem horizontal
 * dentro de uma caixa que não é tabela e elementos visíveis que passam da borda direita.
 */
export function overflowIssues(page: Page): Promise<string[]> {
  return page.evaluate((selector) => {
    const issues: string[] = [];
    const viewport = window.innerWidth;
    const root = document.documentElement;
    if (root.scrollWidth > viewport)
      issues.push(`a página rola na horizontal (${root.scrollWidth} px em ${viewport} px)`);

    const describe = (element: Element) => {
      const classes = [...element.classList].slice(0, 3).join('.');
      const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 50);
      return `${element.tagName.toLowerCase()}${classes ? '.' + classes : ''}${text ? ` "${text}"` : ''}`;
    };
    const visible = (element: Element) => {
      const box = element.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) return false;
      const style = getComputedStyle(element);
      return style.visibility !== 'hidden' && style.display !== 'none';
    };
    const hidden = (element: Element) =>
      !!element.closest('.sr-only, .cdk-visually-hidden, [aria-hidden="true"][hidden]');
    // Tabelas e gráficos largos rolam dentro da própria caixa, de propósito (`.table-scroll`).
    const allowedScroll = (element: Element) =>
      element.matches('.table-scroll, [class*="table"], [role="tablist"]') ||
      !!element.querySelector(':scope > table, :scope > canvas');
    const scrolls = (element: Element) => {
      const overflow = getComputedStyle(element).overflowX;
      return overflow === 'auto' || overflow === 'scroll';
    };

    for (const element of document.querySelectorAll('body *')) {
      if (!scrolls(element) || !visible(element) || allowedScroll(element)) continue;
      if (element.scrollWidth > element.clientWidth + 1)
        issues.push(
          `${describe(element)} rola na horizontal (${element.scrollWidth} px em ${element.clientWidth} px)`,
        );
    }

    // Diálogo aberto cabe inteiro na altura da tela: o conteúdo rola por dentro.
    for (const dialog of document.querySelectorAll('.mat-mdc-dialog-container')) {
      const box = dialog.getBoundingClientRect();
      if (box.top < -1 || box.bottom > window.innerHeight + 1)
        issues.push(
          `o diálogo passa da altura da tela (${Math.round(box.top)} a ${Math.round(box.bottom)} px em ${window.innerHeight} px)`,
        );
    }

    const reported = new Set<Element>();
    const insideScroll = (element: Element, stop: Element) => {
      for (let node = element.parentElement; node && node !== stop; node = node.parentElement)
        if (scrolls(node)) return true;
      return false;
    };
    const check = (element: Element, edge: number, where: string) => {
      for (let node: Element | null = element; node; node = node.parentElement)
        if (reported.has(node)) return;
      const box = element.getBoundingClientRect();
      let right = box.right;
      const style = getComputedStyle(element);
      // Texto que não quebra passa da própria caixa sem mudar o retângulo do elemento.
      const hasText = [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      );
      if (
        hasText &&
        style.display !== 'inline' &&
        style.overflowX === 'visible' &&
        element.scrollWidth > element.clientWidth + 1
      )
        right = Math.max(right, box.left + element.scrollWidth);
      if (right > edge + 1) {
        reported.add(element);
        issues.push(`${describe(element)} passa ${Math.round(right - edge)} px de ${where}`);
      }
    };

    for (const element of document.querySelectorAll('body *')) {
      if (!visible(element) || hidden(element) || insideScroll(element, document.body)) continue;
      check(element, viewport, 'a tela');
    }
    for (const container of document.querySelectorAll(selector)) {
      if (!visible(container) || hidden(container)) continue;
      const edge = container.getBoundingClientRect().right;
      for (const element of container.querySelectorAll('*')) {
        if (!visible(element) || hidden(element) || insideScroll(element, container)) continue;
        check(element, edge, describe(container).slice(0, 40));
      }
    }
    return [...new Set(issues)];
  }, containers);
}

/** Abre as áreas recolhidas ("Mais filtros", "Saiba mais", legendas): o que está nelas também conta. */
export async function openCollapsed(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const details of document.querySelectorAll('main details')) details.open = true;
  });
}

/** Falha com a lista do que vazou, para corrigir de uma vez. */
export async function expectFits(page: Page, label: string): Promise<void> {
  expect(await overflowIssues(page), label).toEqual([]);
}

/**
 * Captura para comparar antes e depois de uma mudança de layout, só em 360×740 e só com
 * SAGER_MOBILE_CAPTURE (pasta) e SAGER_MOBILE_CAPTURE_TAG (por exemplo, "antes") definidos.
 */
export async function capture(page: Page, name: string): Promise<void> {
  const folder = process.env['SAGER_MOBILE_CAPTURE'];
  const tag = process.env['SAGER_MOBILE_CAPTURE_TAG'];
  const size = page.viewportSize();
  if (!folder || !tag || size?.width !== 360 || size.height !== 740) return;
  await page.screenshot({ path: `${folder}/celular-${name}-${tag}.png` });
}
