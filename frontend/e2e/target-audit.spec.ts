import { expect, test } from '@playwright/test';
import { enterDemo } from './demo-session';

test.beforeEach(async ({ page }) => enterDemo(page));

test('alvos de ação visíveis têm pelo menos 44 × 44 px nas telas centrais', async ({ page }) => {
  test.setTimeout(60_000);
  const failures: string[] = [];
  const routeSets: { role: 'supervisor' | 'gestor' | 'residente'; paths: string[] }[] = [
    {
      role: 'supervisor',
      paths: ['/inicio', '/chamada', '/saidas', '/saidas/S-1048', '/notificacoes', '/limpeza'],
    },
    {
      role: 'gestor',
      paths: [
        '/residentes',
        '/residentes/r-ana',
        '/responsaveis',
        '/responsaveis/novo',
        '/responsaveis/g-1',
        '/supervisores/s-1',
        '/quartos',
        '/relatorios',
      ],
    },
    { role: 'residente', paths: ['/inicio', '/saidas/nova', '/avisos', '/ranking'] },
  ];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const set of routeSets) {
      await page.goto('/demonstracao');
      await page
        .locator('.role-card')
        .filter({
          hasText:
            set.role === 'supervisor'
              ? 'Supervisor'
              : set.role === 'gestor'
                ? 'Gestor'
                : 'Residente',
        })
        .click();
      for (const path of set.paths) {
        await page.goto(path);
        const small = await page.evaluate(() =>
          Array.from(
            document.querySelectorAll<HTMLElement>(
              'button,a[href],input:not([type=hidden]),select,summary',
            ),
          )
            .filter((element) => {
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return (
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                rect.width > 0 &&
                rect.height > 0 &&
                !element.closest('[aria-hidden="true"]')
              );
            })
            .map((element) => {
              const target =
                element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)
                  ? (element.closest('label') ?? element)
                  : element;
              const rect = target.getBoundingClientRect();
              return {
                label: (
                  target.getAttribute('aria-label') ||
                  target.textContent ||
                  target.getAttribute('placeholder') ||
                  target.tagName
                )
                  .trim()
                  .replace(/\s+/g, ' ')
                  .slice(0, 55),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              };
            })
            .filter((item) => item.width < 44 || item.height < 44),
        );
        for (const item of small)
          failures.push(
            `${width}px ${set.role} ${path}: ${item.label} (${item.width}×${item.height})`,
          );
      }
    }
  }
  expect(failures).toEqual([]);
});
