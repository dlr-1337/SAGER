import { expect, type Page } from '@playwright/test';

/** No cabeçalho da tela, no máximo uma frase de orientação com até 20 palavras. */
export async function expectShortGuidance(page: Page): Promise<void> {
  const heading = page.locator('main').locator('header, .mg-heading, .op-heading').first();
  const paragraphs = heading.locator(':scope > p, :scope > div > p');
  expect(await paragraphs.count()).toBeLessThanOrEqual(1);
  if (await paragraphs.count()) {
    const words = (await paragraphs.first().innerText()).trim().split(/\s+/).filter(Boolean);
    expect(words.length).toBeLessThanOrEqual(20);
  }
}
