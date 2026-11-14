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

test('rota interna exige sessão ou entrada explícita na demonstração', async ({ page }) => {
  await page.route('**/api/v1/auth/me', (route) => route.abort('failed'));

  await page.goto('/inicio');
  await expect(page).toHaveURL(/\/acesso$/);
  await page.goto('/demonstracao');
  await page.getByRole('button', { name: /Entrar como supervisor/i }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Olá, supervisora/ })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('sager.demo.active'))).toBe('true');
});

test('aba nova encerra cookie de sessão local antes de abrir a demonstração', async ({
  context,
}) => {
  await context.addCookies([
    {
      name: 'SESSION',
      value: 'sessao-de-teste',
      url: 'http://127.0.0.1:4200',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const requests: string[] = [];
  await context.route('**/api/v1/auth/**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    requests.push(path);
    expect(request.headers().cookie).toContain('SESSION=sessao-de-teste');
    if (path.endsWith('/me')) {
      return route.fulfill({
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
      });
    }
    if (path.endsWith('/csrf')) {
      return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-test' } });
    }
    if (path.endsWith('/logout')) {
      expect(request.headers()['x-csrf-token']).toBe('csrf-test');
      return route.fulfill({
        status: 204,
        headers: { 'Set-Cookie': 'SESSION=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax' },
      });
    }
    return route.fulfill({ status: 404 });
  });

  const newTab = await context.newPage();
  await newTab.goto('/demonstracao');
  expect(await newTab.evaluate(() => sessionStorage.getItem('sager.demo.active'))).toBeNull();
  await newTab.getByRole('button', { name: /Entrar como supervisor/i }).click();
  await expect(newTab).toHaveURL(/\/inicio$/);
  expect(requests).toEqual(['/api/v1/auth/me', '/api/v1/auth/csrf', '/api/v1/auth/logout']);
  expect((await context.cookies()).some((cookie) => cookie.name === 'SESSION')).toBe(false);
  await expect(newTab.locator('.demo-flag')).toContainText('Demonstração');
});

test('demonstração não começa com a conta aberta e o servidor com erro', async ({
  context,
  page,
}) => {
  let me: 'conta' | 'erro' | 'sem sessão' = 'conta';
  const requests: string[] = [];
  await context.route('**/api/v1/auth/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    if (path.endsWith('/csrf'))
      return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-test' } });
    if (path.endsWith('/login')) return route.fulfill({ status: 204 });
    if (path.endsWith('/me'))
      return route.fulfill(
        me === 'conta'
          ? {
              json: {
                id: '00000000-0000-0000-0000-000000000001',
                nome: 'Operadora Exemplo',
                email: null,
                matricula: 'TESTE-LOGIN',
                fotoUrl: null,
                perfis: ['gestor'],
                residenteId: null,
                supervisorId: null,
              },
            }
          : { status: me === 'erro' ? 503 : 401 },
      );
    return route.fulfill({ status: 404 });
  });
  await page.goto('/acesso');
  await page.getByRole('textbox', { name: 'Matrícula' }).fill('TESTE-LOGIN');
  await page.getByLabel('Senha', { exact: true }).fill('senha de teste');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);

  me = 'erro';
  const newTab = await context.newPage();
  await newTab.goto('/demonstracao');
  requests.length = 0;
  await newTab.getByRole('button', { name: /Entrar como gestor/i }).click();
  await expect(newTab.getByRole('alert')).toContainText('tente de novo');
  await expect(newTab).toHaveURL(/\/demonstracao$/);
  expect(requests).toEqual(['/api/v1/auth/me']);
  expect(await newTab.evaluate(() => sessionStorage.getItem('sager.demo.active'))).toBeNull();

  me = 'sem sessão';
  await newTab.getByRole('button', { name: /Entrar como gestor/i }).click();
  await expect(newTab).toHaveURL(/\/inicio$/);
  expect(requests).not.toContain('/api/v1/auth/logout');
  await expect(newTab.locator('.demo-flag')).toContainText('Demonstração');
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
  await expect(page.locator('.demo-flag')).toContainText('Login local');
  await expect(page.getByLabel('Perfil', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => Object.keys(sessionStorage))).not.toContain('sager.demo.active');

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

test('senha inválida mantém o usuário fora do sistema e não impede a demonstração', async ({
  page,
}) => {
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
  await page.getByRole('link', { name: 'Explorar demonstração' }).click();
  await page.getByRole('button', { name: /Entrar como residente/i }).click();
  await expect(page.getByRole('heading', { name: 'Olá, residente' })).toBeVisible();
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
