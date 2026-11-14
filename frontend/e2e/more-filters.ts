import { expect, type Page } from '@playwright/test';

/** Abre "Mais filtros" só se estiver fechado: clicar de novo fecharia o painel. */
export async function openMoreFilters(page: Page): Promise<void> {
  const closed = page.locator('sager-filter-panel details:not([open]) > summary');
  if (await closed.count()) await closed.first().click();
  await expect(page.locator('sager-filter-panel details').first()).toHaveAttribute('open', '');
}
