import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const fontFile = 'src/fonts/material-symbols-rounded-subset.woff2';
const listFile = 'src/fonts/material-symbols-rounded.json';
const regenerate =
  'Acrescente o ícone em src/fonts/material-symbols-rounded.json e gere a fonte de novo com ' +
  '"python scripts/subset-icons.py" em frontend/ (pip install fonttools brotli).';

// Elementos com a classe da fonte: o texto é o nome do ícone; numa interpolação, valem os
// literais que são resultado de ?: (não os valores comparados).
const iconElement =
  /<([a-z][\w-]*)\b[^>]*\bclass="[^"]*\bmaterial-symbols-(?:rounded|outlined)\b[^"]*"[^>]*>([\s\S]*?)<\/\1\s*>/g;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(ts|html)$/.test(entry.name) && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}

function usedIcons(): Map<string, string> {
  const icons = new Map<string, string>();
  for (const file of sources('src/app')) {
    const text = readFileSync(file, 'utf8');
    for (const [, , body] of text.matchAll(iconElement)) {
      const content = body.trim();
      if (!content.includes('{{')) icons.set(content, file);
      else for (const [, name] of content.matchAll(/[?:]\s*'([^']*)'/g)) icons.set(name, file);
    }
    for (const [, name] of text.matchAll(/\bicon:\s*'([^']*)'/g)) icons.set(name, file);
  }
  return icons;
}

test.describe('fonte de ícones', () => {
  test('tem todo ícone usado nas telas e menos de 100 kB', () => {
    const { icons, sha256 } = JSON.parse(readFileSync(listFile, 'utf8')) as {
      icons: string[];
      sha256: string;
    };
    const used = usedIcons();
    expect(used.size, 'nenhum ícone encontrado nos templates').toBeGreaterThan(20);
    const missing = [...used].filter(([name]) => !icons.includes(name));
    expect(
      missing.map(([name, file]) => `${name} (${file})`),
      `Ícones fora da fonte. ${regenerate}`,
    ).toEqual([]);
    const font = readFileSync(fontFile);
    const digest = createHash('sha256')
      .update(Buffer.concat([font, Buffer.from(icons.join('\n'))]))
      .digest('hex');
    expect(digest, `A fonte não corresponde à lista de ícones. ${regenerate}`).toBe(sha256);
    expect(statSync(fontFile).size, `A fonte passou de 100 kB. ${regenerate}`).toBeLessThan(
      100_000,
    );
  });

  test('desenha o ícone em vez de escrever o nome', async ({ page }) => {
    await page.goto('/acesso');
    const icon = page.locator('.password-toggle .material-symbols-rounded');
    await expect(icon).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect((await icon.boundingBox())?.width ?? Infinity).toBeLessThanOrEqual(30);
  });
});
