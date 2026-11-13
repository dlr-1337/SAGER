import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('login permite conferir a senha e volta a ocultá-la ao enviar', async ({ page }) => {
  await page.route('**/api/v1/auth/**', (route) =>
    route.request().url().endsWith('/csrf')
      ? route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-test' } })
      : route.fulfill({ status: 401 }),
  );
  await page.goto('/acesso');
  const password = page.getByLabel('Senha', { exact: true });
  await password.fill('senha de teste');
  await expect(password).toHaveAttribute('type', 'password');

  await page.getByRole('button', { name: 'Mostrar senha' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('senha de teste');
  const hide = page.getByRole('button', { name: 'Ocultar senha' });
  const box = (await hide.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  const audit = await new AxeBuilder({ page }).include('main').analyze();
  expect(audit.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual(
    [],
  );

  await page.getByRole('textbox', { name: 'Matrícula' }).fill('TESTE-LOGIN');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await expect(page.getByRole('button', { name: 'Mostrar senha' })).toBeVisible();
});

test('rota interna exige sessão e o acesso só oferece login', async ({ page }) => {
  await page.route('**/api/v1/auth/me', (route) => route.abort('failed'));

  await page.goto('/inicio');
  await expect(page).toHaveURL(/\/acesso$/);
  await expect(page.getByRole('link', { name: 'Ajuda para acessar' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Esqueci minha senha' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Explorar/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Entrar como/ })).toHaveCount(0);

  // Endereço antigo: cai na rota pública de página inexistente, sem abrir sessão.
  await page.goto('/demonstracao');
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible();
  await expect(page.locator('.masthead .session-user')).toHaveCount(0);
});

test('login local restaura a sessão, respeita o perfil do servidor e permite sair', async ({
  page,
}) => {
  let authenticated = false;
  const requests: string[] = [];
  await page.route('**/api/v1/auth/**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    requests.push(path);
    if (path.endsWith('/csrf')) {
      return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-test' } });
    }
    if (path.endsWith('/login')) {
      expect(request.headers()['x-csrf-token']).toBe('csrf-test');
      expect(new URLSearchParams(request.postData() ?? '').get('matricula')).toBe('TESTE-LOGIN');
      authenticated = true;
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith('/me')) {
      return route.fulfill(
        authenticated
          ? {
              json: {
                id: '00000000-0000-0000-0000-000000000001',
                nome: 'Operadora Exemplo',
                email: 'operadora@example.test',
                matricula: 'TESTE-LOGIN',
                fotoUrl: null,
                perfis: ['gestor'],
                residenteId: null,
                supervisorId: null,
              },
            }
          : { status: 401 },
      );
    }
    if (path.endsWith('/logout')) {
      expect(request.headers()['x-csrf-token']).toBe('csrf-test');
      authenticated = false;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ status: 404 });
  });

  await page.goto('/acesso');
  await page.getByRole('textbox', { name: 'Matrícula' }).fill('TESTE-LOGIN');
  await page.getByLabel('Senha', { exact: true }).fill('senha de teste');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByRole('heading', { name: 'Atividades do SAGER' })).toBeVisible();
  await expect(page.getByText('Operadora Exemplo · Acesso local')).toBeVisible();
  await expect(page.locator('.environment-flag')).toContainText('Login local');
  await expect(page.locator('#profile-select-desktop')).toHaveCount(0);
  await expect(page.getByLabel('Perfil', { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Atividades do SAGER' })).toBeVisible();
  await page.goto('/chamada');
  await expect(page).toHaveURL(/\/acesso-negado$/);
  await page.locator('.exit-link').click();
  await expect(page).toHaveURL(/\/acesso$/);
  await page.goto('/inicio');
  await expect(page).toHaveURL(/\/acesso$/);
  expect(requests).toContain('/api/v1/auth/logout');
});

test('senha inválida mantém o usuário fora do sistema', async ({ page }) => {
  await page.route('**/api/v1/auth/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill(
      path.endsWith('/csrf')
        ? { json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-test' } }
        : { status: 401 },
    );
  });

  await page.goto('/acesso');
  await page.getByRole('textbox', { name: 'Matrícula' }).fill('TESTE-LOGIN');
  await page.getByLabel('Senha', { exact: true }).fill('senha incorreta');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Matrícula ou senha errada');
  await expect(page).toHaveURL(/\/acesso$/);
});

for (const profile of ['residente', 'supervisor'] as const) {
  test(`perfil ${profile} apresenta vínculo do servidor e perde acesso quando a sessão é revogada`, async ({
    page,
  }) => {
    const recordId = '00000000-0000-0000-0000-000000000002';
    let active = true;
    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill(
        active
          ? {
              json: {
                id: '00000000-0000-0000-0000-000000000001',
                nome: 'Pessoa Sintética',
                email: `${profile}@example.test`,
                matricula: 'TESTE-LOGIN',
                fotoUrl: null,
                perfis: [profile],
                residenteId: profile === 'residente' ? recordId : null,
                supervisorId: profile === 'supervisor' ? recordId : null,
              },
            }
          : { status: 401 },
      ),
    );
    await page.goto('/perfil');
    await expect(page.getByRole('heading', { name: 'Meu perfil' })).toBeVisible();
    await expect(
      page.getByText(`Sua conta está ligada ao seu cadastro de ${profile}.`),
    ).toBeVisible();
    await expect(page.locator('main')).not.toContainText(recordId);
    await expect(page.getByRole('link', { name: 'Trocar perfil' })).toHaveCount(0);
    active = false;
    await page.reload();
    await expect(page).toHaveURL(/\/acesso$/);
    await expect(page.locator('main')).not.toContainText(recordId);
  });
}
