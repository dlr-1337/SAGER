import { expect, type Page } from '@playwright/test';

export async function enterDemo(
  page: Page,
  profile: 'Supervisor' | 'Gestor' | 'Residente' = 'Supervisor',
): Promise<void> {
  await page.goto('/demonstracao');
  await page.locator('.role-card').filter({ hasText: profile }).click();
  await expect(page).toHaveURL(/\/inicio$/);
}
