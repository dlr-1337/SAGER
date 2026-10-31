import { expect, test } from '@playwright/test';

test('a página traz ícones e prévia de link, e mantém a marca oficial', async ({
  page,
  request,
}) => {
  await page.goto('/acesso');

  const hrefs = await page
    .locator('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  expect(hrefs).toEqual([
    '/favicon.ico',
    '/favicon.svg',
    '/apple-touch-icon.png',
    '/manifest.webmanifest',
  ]);
  for (const href of [...hrefs, '/og-image.png']) {
    expect((await request.get(href as string)).ok(), href as string).toBe(true);
  }

  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.short_name).toBe('SAGER');
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
  }

  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    /\/og-image\.png$/,
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /SAGER/);

  const mark = page.getByRole('banner').locator('img[src="/if-goiano-urutai.png"]');
  await expect(mark).toBeVisible();
  expect(await mark.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
});
