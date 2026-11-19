import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test, TestInfo } from '@playwright/test';
import type {
  Conversation,
  ConversationMessage,
  OpenExit,
  SessionView,
} from '../src/app/features/communications/conversations.models';
import { enterDemo } from './demo-session';

// Launch options force a new worker, so Playwright only accepts them at the top of the file.
test.use({
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
});

const uuid = (number: number) => `00000000-0000-0000-0000-${String(number).padStart(12, '0')}`;
const linkedId = uuid(1);
const unlinkedId = uuid(2);
const guardianId = uuid(10);
const exitA = uuid(21);
const exitB = uuid(22);
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const picture = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#cfe3d5"/><circle cx="90" cy="70" r="30" fill="#f4ba35"/><path d="M0 200 120 90l70 70 50-40 80 80z" fill="#20704e"/></svg>`;
const qrPicture = `<svg xmlns="http://www.w3.org/2000/svg" width="264" height="264"><rect width="264" height="264" fill="#fff"/><path d="M16 16h72v72H16zM176 16h72v72h-72zM16 176h72v72H16z" fill="#182735"/><path d="M104 104h24v24h-24zM152 128h24v24h-24zM200 176h24v24h-24zM128 200h24v24h-24z" fill="#182735"/></svg>`;

function message(id: number, values: Partial<ConversationMessage>): ConversationMessage {
  return {
    id: uuid(100 + id),
    conversationId: linkedId,
    direction: 'IN',
    origin: 'WEBHOOK',
    kind: 'TEXT',
    body: null,
    mediaState: 'NONE',
    mediaFailureCode: null,
    mediaType: null,
    mediaFilename: null,
    mediaSize: 0,
    deliveryStatus: null,
    failureCode: null,
    sentAt: minutesAgo(200 - id),
    linkable: false,
    linkedExit: null,
    ...values,
  };
}
const linkedConversation = (): Conversation => ({
  id: linkedId,
  chatId: '5562999990001@c.us',
  phone: '+5562999990001',
  linked: true,
  guardians: [
    {
      id: guardianId,
      name: 'Maria Sintética',
      relationship: 'Mãe',
      phone: '+5562999990001',
      residentId: uuid(30),
      residentName: 'Ana Sintética',
    },
  ],
  lastMessage: {
    direction: 'IN',
    kind: 'IMAGE',
    body: 'Segue a autorização assinada',
    deliveryStatus: null,
    sentAt: minutesAgo(5),
  },
  unreadCount: 2,
  lastMessageAt: minutesAgo(5),
});
const unlinkedConversation = (): Conversation => ({
  id: unlinkedId,
  chatId: '5562988880002@c.us',
  phone: '+5562988880002',
  linked: false,
  guardians: [],
  lastMessage: {
    direction: 'OUT',
    kind: 'TEXT',
    body: 'Bom dia, quem fala?',
    deliveryStatus: 'READ',
    sentAt: minutesAgo(3000),
  },
  unreadCount: 0,
  lastMessageAt: minutesAgo(3000),
});
const history = (): ConversationMessage[] => [
  message(1, {
    body: 'Bom dia. A Ana pode sair na sexta?',
    sentAt: minutesAgo(1500),
  }),
  message(2, {
    direction: 'OUT',
    origin: 'SUPERVISOR',
    body: 'Bom dia, Maria. Pode sim. Enviei o documento para a senhora assinar.',
    deliveryStatus: 'READ',
    sentAt: minutesAgo(1495),
  }),
  // Two files the automatic link already put in the only open exit: no "Vincular" button.
  message(12, {
    kind: 'DOCUMENT',
    mediaState: 'STORED',
    mediaType: 'application/pdf',
    mediaFilename: 'autorizacao-1.pdf',
    mediaSize: 90_000,
    sentAt: minutesAgo(1490),
    linkedExit: { id: exitA, residentName: 'Ana Sintética', fileState: 'CANDIDATE' },
  }),
  message(13, {
    kind: 'DOCUMENT',
    mediaState: 'STORED',
    mediaType: 'application/pdf',
    mediaFilename: 'autorizacao-2.pdf',
    mediaSize: 91_000,
    sentAt: minutesAgo(1489),
    linkedExit: { id: exitA, residentName: 'Ana Sintética', fileState: 'ACCEPTED' },
  }),
  message(3, {
    kind: 'IMAGE',
    body: 'Segue a autorização assinada',
    mediaState: 'STORED',
    mediaType: 'image/jpeg',
    mediaFilename: 'autorizacao.jpg',
    mediaSize: 245_000,
    linkable: true,
  }),
  message(4, {
    kind: 'AUDIO',
    mediaState: 'STORED',
    mediaType: 'audio/ogg',
    mediaSize: 48_000,
  }),
  message(5, {
    kind: 'DOCUMENT',
    mediaState: 'STORED',
    mediaType: 'application/pdf',
    mediaFilename: 'termo-assinado.pdf',
    mediaSize: 1_300_000,
    linkable: true,
  }),
  message(6, { kind: 'DOCUMENT', mediaState: 'PENDING' }),
  message(7, {
    kind: 'IMAGE',
    mediaState: 'FAILED',
    mediaFailureCode: 'media_too_large',
  }),
  message(8, { body: '<script>window.__injected = true</script><b>texto</b>' }),
  message(9, {
    direction: 'OUT',
    origin: 'DEVICE',
    body: 'Respondi pelo celular também.',
    deliveryStatus: 'DELIVERED',
  }),
  message(10, {
    direction: 'OUT',
    origin: 'SUPERVISOR',
    body: 'Mensagem que o WhatsApp recusou.',
    deliveryStatus: 'FAILED',
    failureCode: 'provider_http_rejected',
  }),
  message(11, {
    direction: 'OUT',
    origin: 'SUPERVISOR',
    body: 'Mensagem sem confirmação.',
    deliveryStatus: 'UNCERTAIN',
  }),
];
const workingSession = (): SessionView => ({
  available: true,
  status: 'WORKING',
  linkedAt: '2026-10-01T12:00:00Z',
  lastEventAt: '2026-10-30T12:00:00Z',
  canSend: true,
  unavailableReason: null,
});
const longExit = (id: string) => ({
  id,
  residentId: uuid(30),
  residentName: 'Ana Sintética',
  enrollment: 'TESTE-001',
  guardianId,
  guardianName: 'Maria Sintética',
  guardianRelationship: 'Mãe',
  reason: 'Consulta sintética',
  zone: 'America/Sao_Paulo',
  version: 4,
  departureMode: 'SCHEDULED',
  status: 'AGUARDANDO_ANALISE',
  signatureStatus: 'PENDING',
  messageStatus: 'READ',
  requestedDepartureAt: '2026-11-06T12:00:00Z',
  expectedReturnAt: '2026-11-08T20:00:00Z',
  now: '2026-10-31T12:00:00Z',
  capabilities: {
    canEdit: false,
    canApprove: false,
    canReject: true,
    canCancel: true,
    canDepart: false,
    canReturn: false,
    canResend: true,
    canAttachAuthorization: true,
    canDownloadOriginal: true,
    canDownloadSigned: false,
  },
  currentDocument: null,
  remainingResends: 3,
  resendAvailableAt: null,
  bindings: [],
  authorizationFiles: [],
  whatsappAvailable: true,
  deliveryUnconfirmed: false,
  history: [],
});
const openExit = (id: string, residentName: string, version: number): OpenExit => ({
  id,
  version,
  residentId: uuid(30),
  residentName,
  guardianId,
  guardianName: 'Maria Sintética',
  requestedDepartureAt: '2026-11-06T12:00:00Z',
  expectedReturnAt: '2026-11-08T20:00:00Z',
});

interface Sent {
  key: string | null;
  contentType: string;
  csrf: string | null;
  body: string;
}
async function mockApi(page: Page, role = 'supervisor') {
  const state = {
    role,
    conversations: [linkedConversation(), unlinkedConversation()],
    messages: history() as ConversationMessage[],
    older: [] as ConversationMessage[],
    session: workingSession(),
    sendFailure: null as null | { status: number; code: string; message: string },
    sent: [] as Sent[],
    reads: [] as string[],
    links: [] as unknown[],
    starts: [] as unknown[],
    startFailure: null as null | { status: number; code: string; message: string },
    sessionStarts: 0,
    qrReads: 0,
    qrAvailable: true,
    exits: [
      openExit(exitA, 'Ana Sintética', 4),
      openExit(exitB, 'Bruno Sintético', 7),
    ] as OpenExit[],
    listQueries: [] as string[],
  };
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const ok = (value: unknown, status = 200) => route.fulfill({ status, json: value });
    if (path === '/api/v1/auth/me')
      return ok({
        id: uuid(1000),
        nome: 'Supervisora Sintética',
        email: 'sessao@example.test',
        matricula: 'TESTE-LOGIN',
        fotoUrl: null,
        perfis: [state.role],
        residenteId: null,
        supervisorId: state.role === 'supervisor' ? uuid(1001) : null,
      });
    if (path === '/api/v1/auth/csrf')
      return ok({ headerName: 'X-CSRF-TOKEN', token: 'synthetic-csrf' });
    if (path === '/api/v1/responsaveis')
      return route.fulfill({
        headers: { 'X-Total-Count': '2' },
        json: [
          {
            id: guardianId,
            residentId: uuid(30),
            name: 'Maria Sintética',
            relationship: 'Mãe',
            phone: '+5562999990001',
            active: true,
            version: 1,
          },
          {
            id: uuid(11),
            residentId: uuid(31),
            name: 'João Sintético',
            relationship: 'Pai',
            phone: null,
            active: true,
            version: 1,
          },
        ],
      });
    if (!path.startsWith('/api/v1/conversas')) return ok([]);
    const rest = path.slice('/api/v1/conversas'.length);
    if (rest === '' && method === 'GET') {
      state.listQueries.push(url.searchParams.get('q') ?? '');
      return ok({ items: state.conversations, nextCursor: null });
    }
    if (rest === '' && method === 'POST') {
      state.starts.push(request.postDataJSON());
      if (state.startFailure)
        return route.fulfill({ status: state.startFailure.status, json: state.startFailure });
      return ok(linkedConversation(), 200);
    }
    if (rest === '/sessao') return ok(state.session);
    if (rest === '/sessao/inicio') {
      state.sessionStarts++;
      state.session = { ...state.session, status: 'STARTING' };
      return ok(state.session);
    }
    if (rest === '/sessao/qr') {
      state.qrReads++;
      if (!state.qrAvailable)
        return route.fulfill({ status: 409, json: { code: 'qr_unavailable', message: 'Sem QR.' } });
      return route.fulfill({ contentType: 'image/svg+xml', body: qrPicture });
    }
    const media = /^\/mensagens\/([^/]+)\/midia$/.exec(rest);
    if (media) {
      if (media[1] === uuid(103))
        return route.fulfill({ contentType: 'image/svg+xml', body: picture });
      return route.fulfill({ contentType: 'application/octet-stream', body: 'synthetic' });
    }
    const link = /^\/mensagens\/([^/]+)\/vinculo$/.exec(rest);
    if (link) {
      state.links.push({ messageId: link[1], ...request.postDataJSON() });
      const { exitId } = request.postDataJSON();
      const residentName = exitId === exitB ? 'Bruno Sintético' : 'Ana Sintética';
      state.messages = state.messages.map((item) =>
        item.id === link[1]
          ? {
              ...item,
              linkable: false,
              linkedExit: { id: exitId, residentName, fileState: 'CANDIDATE' as const },
            }
          : item,
      );
      return ok(longExit(request.postDataJSON().exitId));
    }
    const conversation = state.conversations.find((item) => rest.startsWith(`/${item.id}`));
    if (!conversation)
      return route.fulfill({
        status: 404,
        json: { code: 'not_found', message: 'Não encontrada.' },
      });
    const action = rest.slice(`/${conversation.id}`.length);
    if (action === '') return ok(conversation);
    if (action === '/leitura') {
      state.reads.push(conversation.id);
      return route.fulfill({ status: 204 });
    }
    if (action === '/saidas-abertas') return ok(state.exits);
    if (action === '/mensagens' && method === 'GET') {
      if (url.searchParams.get('before')) return ok({ items: state.older, nextCursor: null });
      const items = conversation.id === linkedId ? state.messages : [];
      return ok({ items, nextCursor: state.older.length ? 'cursor~sintetico' : null });
    }
    if (action === '/mensagens' && method === 'POST') {
      const headers = request.headers();
      state.sent.push({
        key: headers['idempotency-key'] ?? null,
        contentType: headers['content-type'] ?? '',
        csrf: headers['x-csrf-token'] ?? null,
        body: request.postDataBuffer()?.toString('latin1') ?? '',
      });
      if (state.sendFailure)
        return route.fulfill({ status: state.sendFailure.status, json: state.sendFailure });
      const multipart = (headers['content-type'] ?? '').startsWith('multipart/');
      const created = message(500 + state.sent.length, {
        direction: 'OUT',
        origin: 'SUPERVISOR',
        kind: multipart ? 'DOCUMENT' : 'TEXT',
        mediaState: multipart ? 'STORED' : 'NONE',
        mediaFilename: multipart ? 'enviado.pdf' : null,
        mediaSize: multipart ? 1000 : 0,
        body: multipart ? null : (request.postDataJSON().text as string),
        deliveryStatus: 'QUEUED',
        sentAt: new Date().toISOString(),
      });
      state.messages = [...state.messages, created];
      return ok(created, 201);
    }
    return route.fulfill({ status: 404, json: { code: 'not_found', message: 'Não encontrada.' } });
  });
  return state;
}
const axe = async (page: Page) =>
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((node) => node.target.join(' ')),
    })),
  ).toEqual([]);
const capture = (page: Page, info: TestInfo, name: string) =>
  page.screenshot({ path: info.outputPath(`${name}.png`) });
const expectNoHorizontalOverflow = async (page: Page) =>
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
/** Every visible control inside the screen keeps the 44 px target of DESIGN.md. */
const expectTargets = async (page: Page, scope: string) => {
  const small = await page.locator(scope).evaluate((root) =>
    [...root.querySelectorAll('a, button, input:not([type=radio]), textarea, audio')]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && (box.height < 44 || box.width < 44);
      })
      .map((element) => element.outerHTML.slice(0, 120)),
  );
  expect(small).toEqual([]);
};

test.describe('desktop', () => {
  test.use({ viewport: { width: 1366, height: 860 } });

  test('lista e conversa ficam lado a lado, com aviso de saúde e sem interpretar HTML', async ({
    page,
  }, info) => {
    const state = await mockApi(page);
    await page.goto('/conversas');
    await expect(page.getByRole('heading', { name: 'Conversas', exact: true })).toBeVisible();
    await expect(page.getByText('Não trate dados de saúde por aqui.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Conversas', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const rows = page.locator('.conv-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('Maria Sintética');
    await expect(rows.first()).toContainText('Responsável por Ana Sintética');
    await expect(rows.first()).toContainText('2 não lidas');
    await expect(rows.nth(1)).toContainText('Não vinculada');
    await expect(rows.nth(1)).toContainText('Você: Bom dia, quem fala?');
    await expect(page.getByRole('heading', { name: 'Escolha uma conversa' })).toBeVisible();
    await axe(page);

    await rows.first().click();
    await expect(page).toHaveURL(new RegExp(`/conversas/${linkedId}$`));
    await expect(rows.first()).toBeVisible();
    await expect(rows.first()).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { name: 'Maria Sintética' })).toBeFocused();

    const log = page.getByRole('log', { name: 'Mensagens da conversa com Maria Sintética' });
    await expect(log).toContainText('Bom dia. A Ana pode sair na sexta?');
    await expect(log.locator('audio')).toHaveAttribute('controls', '');
    await expect(log.locator('audio')).toHaveAttribute(
      'src',
      `/api/v1/conversas/mensagens/${uuid(104)}/midia`,
    );
    await expect(log.getByRole('img', { name: 'Foto de Maria Sintética' })).toBeVisible();
    await expect(log.getByRole('link', { name: /termo-assinado.pdf/ })).toHaveAttribute(
      'href',
      `/api/v1/conversas/mensagens/${uuid(105)}/midia`,
    );
    await expect(log).toContainText('Documento sendo baixado');
    await expect(log).toContainText('passa do limite de 10 MB');
    await expect(log).toContainText('<script>window.__injected = true</script><b>texto</b>');
    expect(await page.evaluate(() => (window as { __injected?: boolean }).__injected)).toBeFalsy();
    await expect(log.locator('b')).toHaveCount(0);

    const received = log.locator('.conv-msg').first();
    const sent = log.locator('.conv-msg-out').first();
    await expect(received).toContainText('Maria Sintética');
    await expect(sent).toContainText('Supervisão');
    await expect(sent).toContainText('Lida');
    expect((await sent.boundingBox())!.x).toBeGreaterThan((await received.boundingBox())!.x);
    await expect(log).toContainText('Enviada pelo celular');
    await expect(log).toContainText('Não enviada');
    await expect(log).toContainText('Envio não confirmado');
    await expect.poll(() => state.reads).toEqual([linkedId]);
    await expect(rows.first()).not.toContainText('não lida');
    await capture(page, info, 'conversa-desktop');
    await log.getByRole('img').scrollIntoViewIfNeeded();
    await capture(page, info, 'midias-desktop');
    await axe(page);
    await expectTargets(page, '.conv-pane');
  });

  test('mensagem nova aparece sem recarregar e o estado de entrega evolui', async ({ page }) => {
    const state = await mockApi(page);
    await page.goto(`/conversas/${linkedId}`);
    const log = page.getByRole('log');
    await expect(log).toContainText('Bom dia');
    await page.getByLabel('Mensagem', { exact: true }).fill('Confirmado para sexta.');
    const send = page.getByRole('button', { name: 'Enviar' });
    await send.dblclick();
    await expect(log).toContainText('Confirmado para sexta.');
    const bubble = log.locator('.conv-msg', { hasText: 'Confirmado para sexta.' });
    await expect(bubble).toContainText('Na fila');
    expect(state.sent).toHaveLength(1);
    expect(state.sent[0].key).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    expect(state.sent[0].csrf).toBe('synthetic-csrf');
    await expect(page.getByLabel('Mensagem', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Mensagem', { exact: true })).toBeFocused();

    state.messages = state.messages.map((item) =>
      item.body === 'Confirmado para sexta.' ? { ...item, deliveryStatus: 'DELIVERED' } : item,
    );
    state.messages = [
      ...state.messages,
      message(600, { body: 'Obrigada pelo retorno.', sentAt: new Date().toISOString() }),
    ];
    const reads = state.reads.length;
    await expect(bubble).toContainText('Entregue');
    await expect(log).toContainText('Obrigada pelo retorno.');
    await expect.poll(() => state.reads.length).toBeGreaterThan(reads);
    await expect
      .poll(() => log.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight))
      .toBeLessThan(80);
  });

  test('falha no envio mantém o texto e repete com a mesma chave', async ({ page }) => {
    const state = await mockApi(page);
    await page.goto(`/conversas/${linkedId}`);
    const draft = page.getByLabel('Mensagem', { exact: true });
    await draft.fill('Texto que não pode sumir.');
    state.sendFailure = {
      status: 503,
      code: 'gateway_unreachable',
      message: 'O WhatsApp não respondeu.',
    };
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByRole('alert')).toHaveText('O WhatsApp não respondeu.');
    await expect(draft).toHaveValue('Texto que não pode sumir.');
    state.sendFailure = null;
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByRole('log')).toContainText('Texto que não pode sumir.');
    expect(state.sent).toHaveLength(2);
    expect(state.sent[1].key).toBe(state.sent[0].key);

    await draft.fill('Outro conteúdo');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByRole('log')).toContainText('Outro conteúdo');
    expect(state.sent[2].key).not.toBe(state.sent[0].key);

    await page.getByRole('button', { name: 'Usar o texto de novo' }).click();
    await expect(draft).toHaveValue('Mensagem que o WhatsApp recusou.');
  });

  test('envia anexo com legenda em multipart e protege o rascunho', async ({ page }) => {
    const state = await mockApi(page);
    await page.goto(`/conversas/${linkedId}`);
    await expect(page.getByRole('log')).toContainText('Bom dia');
    const picker = page.locator('input[type=file]');
    await expect(picker).toHaveAttribute('accept', /application\/pdf/);
    await picker.setInputFiles({
      name: 'termo.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7 sintético'),
    });
    await expect(page.locator('.conv-attachment')).toContainText('termo.pdf');
    await page.getByLabel('Legenda (opcional)').fill('Segue o termo');

    await page.locator('.conv-row').nth(1).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('Descartar alterações?');
    await dialog.getByRole('button', { name: 'Continuar preenchendo' }).click();
    await expect(page).toHaveURL(new RegExp(`/conversas/${linkedId}$`));
    await expect(page.getByLabel('Legenda (opcional)')).toHaveValue('Segue o termo');

    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.locator('.conv-attachment')).toHaveCount(0);
    expect(state.sent[0].contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(state.sent[0].body).toContain('filename="termo.pdf"');
    expect(state.sent[0].body).toContain('name="text"');
    expect(state.sent[0].key).toBeTruthy();

    await page.locator('.conv-row').nth(1).click();
    await expect(page).toHaveURL(new RegExp(`/conversas/${unlinkedId}$`));
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('log')).toContainText('Nenhuma mensagem nesta conversa ainda.');
    await expect(page.getByText('Número sem cadastro')).toBeVisible();

    await page.getByLabel('Mensagem', { exact: true }).fill('Rascunho');
    await page.getByRole('link', { name: 'Início', exact: true }).click();
    const leaving = page.getByRole('alertdialog');
    await leaving.getByRole('button', { name: 'Descartar e sair' }).click();
    // A single question, even though leaving crosses the thread and the page routes.
    await expect(page).toHaveURL(/\/inicio$/);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });

  test('gateway desligado mantém o histórico e informa o motivo do envio indisponível', async ({
    page,
  }) => {
    const state = await mockApi(page);
    state.session = {
      ...workingSession(),
      available: false,
      status: 'DISABLED',
      canSend: false,
      unavailableReason: 'gateway_disabled',
    };
    await page.goto(`/conversas/${linkedId}`);
    await expect(page.getByRole('log')).toContainText('Bom dia');
    await expect(page.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    await expect(page.locator('#conv-send-reason')).toContainText('WhatsApp está desligado');
    await expect(page.locator('.conv-banner[role=status]').first()).toContainText(
      'WhatsApp está desligado',
    );
    await expect(page.getByRole('link', { name: 'Ver conexão' })).toHaveAttribute(
      'href',
      '/conversas/conexao',
    );
    await axe(page);
  });

  test('vincula arquivo a uma das saídas abertas sem aprovar', async ({ page }) => {
    const state = await mockApi(page);
    await page.goto(`/conversas/${linkedId}`);
    const trigger = page
      .getByRole('log')
      .locator('.conv-msg', { hasText: 'Segue a autorização assinada' })
      .getByRole('button', { name: 'Vincular a uma saída longa' });
    await trigger.click();
    const panel = page.getByRole('region', { name: 'Vincular a uma saída longa' });
    await expect(panel.getByRole('radio')).toHaveCount(2);
    await expect(panel.getByRole('heading')).toBeFocused();
    await axe(page);
    await panel.getByRole('button', { name: 'Vincular arquivo' }).click();
    await expect(panel.getByRole('alert')).toHaveText('Escolha uma saída longa.');
    expect(state.links).toEqual([]);
    await panel.getByRole('radio', { name: /Bruno Sintético/ }).check();
    await panel.getByRole('button', { name: 'Vincular arquivo' }).click();
    const notice = page.locator('.conv-banner', { hasText: 'A autorização continua pendente' });
    await expect(notice).toBeVisible();
    await expect(notice.getByRole('link')).toHaveCount(0);
    expect(state.links).toEqual([{ messageId: uuid(103), exitId: exitB, version: 7 }]);
    const bubble = page
      .getByRole('log')
      .locator('.conv-msg', { hasText: 'Segue a autorização assinada' });
    await expect(bubble).toContainText(
      'Na saída longa de Bruno Sintético · aguardando conferência',
    );
    const open = bubble.getByRole('link', { name: 'Abrir saída' });
    await expect(open).toHaveAttribute('href', `/saidas/longas/${exitB}`);
    await expect(open).toBeFocused();
    await expect(trigger).toHaveCount(0);
  });

  test('arquivo já numa saída longa mostra a situação e Abrir saída, sem Vincular', async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto(`/conversas/${linkedId}`);
    const log = page.getByRole('log');
    for (const [file, state] of [
      ['autorizacao-1.pdf', 'aguardando conferência'],
      ['autorizacao-2.pdf', 'conferido'],
    ]) {
      const bubble = log.locator('.conv-msg', { hasText: file });
      await expect(bubble).toContainText(`Na saída longa de Ana Sintética · ${state}`);
      await expect(bubble.getByRole('link', { name: 'Abrir saída' })).toHaveAttribute(
        'href',
        `/saidas/longas/${exitA}`,
      );
      await expect(bubble.getByRole('button', { name: 'Vincular a uma saída longa' })).toHaveCount(
        0,
      );
      await expect(bubble).not.toContainText(exitA);
    }
    const free = log.locator('.conv-msg', { hasText: 'termo-assinado.pdf' });
    await expect(free.getByRole('button', { name: 'Vincular a uma saída longa' })).toBeVisible();
    await expect(free.getByRole('link', { name: 'Abrir saída' })).toHaveCount(0);
    await axe(page);
  });

  test('baixar arquivo e ações do balão sublinham só o texto no hover', async ({ page }) => {
    await mockApi(page);
    await page.goto(`/conversas/${linkedId}`);
    const bubble = page.getByRole('log').locator('.conv-msg', { hasText: 'termo-assinado.pdf' });
    for (const link of [
      bubble.locator('a.conv-download'),
      bubble.getByRole('button', { name: 'Vincular a uma saída longa' }),
    ]) {
      await link.scrollIntoViewIfNeeded();
      await link.hover();
      // Num link flex o ícone vira item e herda o sublinhado; inline-block, ele fica fora (D14).
      const layout = await link.evaluate((element) => ({
        link: getComputedStyle(element).display,
        icon: getComputedStyle(element.querySelector('.material-symbols-rounded')!).display,
        underline: getComputedStyle(element).textDecorationLine,
      }));
      expect(layout.link).not.toMatch(/flex|grid/);
      expect(layout).toMatchObject({ icon: 'inline-block', underline: 'underline' });
    }
  });

  test('inicia conversa só com responsável cadastrado e informa número inexistente', async ({
    page,
  }) => {
    const state = await mockApi(page);
    await page.goto('/conversas');
    await page.getByRole('button', { name: 'Nova conversa' }).click();
    await expect(page.getByRole('button', { name: /João Sintético/ })).toBeDisabled();
    state.startFailure = {
      status: 422,
      code: 'number_not_found',
      message: 'Este número não existe no WhatsApp. Nenhuma mensagem foi enviada.',
    };
    await page.getByRole('button', { name: /Maria Sintética/ }).click();
    await expect(page.getByRole('alert')).toHaveText(
      'Este número não existe no WhatsApp. Nenhuma mensagem foi enviada.',
    );
    await expect(page).toHaveURL(/\/conversas$/);
    await axe(page);
    state.startFailure = null;
    await page.getByRole('button', { name: /Maria Sintética/ }).click();
    await expect(page).toHaveURL(new RegExp(`/conversas/${linkedId}$`));
    expect(state.starts).toEqual([{ guardianId }, { guardianId }]);
    expect(state.sent).toEqual([]);
  });

  test('busca vem do link da saída longa e histórico carrega mensagens anteriores', async ({
    page,
  }) => {
    const state = await mockApi(page);
    state.older = [message(0, { body: 'Mensagem mais antiga.', sentAt: minutesAgo(5000) })];
    await page.goto(`/conversas?q=${encodeURIComponent('Maria Sintética')}`);
    await expect(page.getByLabel('Buscar por nome ou telefone')).toHaveValue('Maria Sintética');
    await expect.poll(() => state.listQueries[0]).toBe('Maria Sintética');
    await page.locator('.conv-row').first().click();
    const log = page.getByRole('log');
    await expect(log).toContainText('Bom dia');
    await page.getByRole('button', { name: 'Carregar mensagens anteriores' }).click();
    await expect(log.locator('.conv-msg').first()).toContainText('Mensagem mais antiga.');
    await expect(page.getByRole('button', { name: 'Carregar mensagens anteriores' })).toHaveCount(
      0,
    );
  });

  test('para de consultar após 30 minutos sem interação e oferece retomar', async ({ page }) => {
    const state = await mockApi(page);
    await page.clock.install();
    await page.goto(`/conversas/${linkedId}`);
    await expect(page.getByRole('log')).toContainText('Bom dia');
    await page.clock.fastForward('31:00');
    await page.clock.runFor(6000);
    const resume = page.getByRole('button', { name: 'Retomar', exact: true });
    await expect(resume).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Atualização pausada' })).toBeVisible();
    const queries = state.listQueries.length;
    await page.clock.runFor(60_000);
    expect(state.listQueries.length).toBe(queries);
    await resume.click();
    await expect(resume).toHaveCount(0);
  });

  test('a conexão mostra QR só aguardando leitura e aceita situação desconhecida', async ({
    page,
  }, info) => {
    const state = await mockApi(page);
    state.session = {
      ...workingSession(),
      status: 'STOPPED',
      canSend: false,
      unavailableReason: 'session_not_ready',
    };
    await page.goto('/conversas/conexao');
    await expect(page.getByRole('heading', { name: 'Conexão do WhatsApp' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Parado' })).toBeVisible();
    expect(state.qrReads).toBe(0);
    await axe(page);
    await page.getByRole('button', { name: 'Iniciar sessão' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Iniciando' })).toBeVisible();
    expect(state.sessionStarts).toBe(1);

    const steps: [Partial<SessionView>, string][] = [
      [{ status: 'PASSKEY_REQUIRED' }, 'Chave de acesso necessária'],
      [{ status: 'PASSKEY_CONFIRMATION_REQUIRED' }, 'Confirmação da chave de acesso'],
      [{ status: 'FAILED' }, 'Com falha'],
      [{ status: 'NOVO_ESTADO_DO_GATEWAY' }, 'Situação não reconhecida (NOVO_ESTADO_DO_GATEWAY)'],
      [{ status: 'WORKING', canSend: true, unavailableReason: null }, 'Conectado'],
    ];
    for (const [values, label] of steps) {
      state.session = { ...workingSession(), canSend: false, ...values };
      if (values.status !== 'WORKING') state.session.unavailableReason = 'session_not_ready';
      await expect(page.getByRole('status').filter({ hasText: label })).toBeVisible();
      await expect(page.getByRole('img', { name: /QR Code/ })).toHaveCount(0);
    }
    await expect(page.getByRole('button', { name: 'Iniciar sessão' })).toHaveCount(0);
    expect(state.qrReads).toBe(0);

    state.session = {
      ...workingSession(),
      status: 'SCAN_QR_CODE',
      canSend: false,
      unavailableReason: 'session_not_ready',
    };
    const code = page.getByRole('img', { name: /QR Code/ });
    await expect(code).toBeVisible();
    await expect(code).toHaveJSProperty('complete', true);
    expect(state.qrReads).toBe(1);
    await page.getByRole('button', { name: 'Gerar novo código' }).click();
    await expect.poll(() => state.qrReads).toBe(2);
    await expect(page.getByRole('status').filter({ hasText: 'Aguardando leitura' })).toBeVisible();
    await capture(page, info, 'conexao-desktop');
    await axe(page);

    state.qrAvailable = false;
    await page.getByRole('button', { name: 'Gerar novo código' }).click();
    await expect(page.getByText('O código ainda não está disponível')).toBeVisible();

    state.session = {
      ...workingSession(),
      status: 'SCAN_QR_CODE',
      canSend: false,
      unavailableReason: 'gateway_unreachable',
    };
    await expect(page.getByText('A situação abaixo é a última conhecida')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Leia o QR Code' })).toHaveCount(0);
  });

  test('só o supervisor acessa as telas e vê o item de menu', async ({ page }) => {
    const state = await mockApi(page);
    await page.goto('/inicio');
    await expect(page.getByRole('link', { name: 'Conversas', exact: true })).toBeVisible();
    for (const role of ['gestor', 'residente']) {
      state.role = role;
      for (const path of ['/conversas', `/conversas/${linkedId}`, '/conversas/conexao']) {
        await page.goto(path);
        await expect(page).toHaveURL(/\/acesso-negado$/);
        await expect(page.getByRole('link', { name: 'Conversas', exact: true })).toHaveCount(0);
      }
    }
  });

  test('a demonstração não consulta o WhatsApp', async ({ page }) => {
    const calls: string[] = [];
    await page.route('**/api/v1/conversas**', (route) => {
      calls.push(route.request().url());
      return route.abort();
    });
    await enterDemo(page);
    await page.goto('/conversas');
    await expect(
      page.getByRole('heading', { name: 'Conversas exigem o modo local' }),
    ).toBeVisible();
    await page.goto('/conversas/conexao');
    await expect(page.getByRole('heading', { name: 'Conexão exige o modo local' })).toBeVisible();
    expect(calls).toEqual([]);
  });
});

test.describe('celular de 320 px', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('lista e conversa ficam em rotas separadas, sem rolagem lateral', async ({ page }, info) => {
    await mockApi(page);
    await page.goto('/conversas');
    const rows = page.locator('.conv-row');
    await expect(rows).toHaveCount(2);
    await expect(page.locator('.conv-pane')).toBeHidden();
    await expectNoHorizontalOverflow(page);
    await capture(page, info, 'lista-320');
    await axe(page);
    await expectTargets(page, '.conv-list');

    await rows.first().click();
    await expect(page).toHaveURL(new RegExp(`/conversas/${linkedId}$`));
    await expect(page.locator('.conv-list')).toBeHidden();
    const log = page.getByRole('log');
    await expect(log).toContainText('Bom dia');
    await expect(page.getByText('Não trate dados de saúde por aqui.')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, info, 'conversa-320');
    await log.getByRole('img').scrollIntoViewIfNeeded();
    await capture(page, info, 'midias-320');
    await axe(page);
    await expectTargets(page, '.conv-pane');
    expect(await page.locator('.conv-composer').isVisible()).toBe(true);
    await page.getByRole('button', { name: 'Anexar arquivo' }).focus();
    await expect(page.getByRole('button', { name: 'Anexar arquivo' })).toBeFocused();

    await page.getByRole('link', { name: 'Voltar à lista' }).click();
    await expect(page).toHaveURL(/\/conversas$/);
    await expect(rows.first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Conversas recentes' })).toBeFocused();
    await expect(page.locator('.conv-pane')).toBeHidden();
  });

  test('a conexão cabe em 320 px com o QR Code', async ({ page }, info) => {
    const state = await mockApi(page);
    state.session = {
      ...workingSession(),
      status: 'SCAN_QR_CODE',
      canSend: false,
      unavailableReason: 'session_not_ready',
    };
    await page.goto('/conversas/conexao');
    await expect(page.getByRole('img', { name: /QR Code/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, info, 'conexao-320');
    await axe(page);
  });
});

test.describe('gravação de áudio', () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    permissions: ['microphone'],
  });

  const trackStreams = (page: Page) =>
    page.addInitScript(() => {
      const scope = window as unknown as { __streams: MediaStream[] };
      scope.__streams = [];
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const stream = await original(constraints);
        scope.__streams.push(stream);
        return stream;
      };
    });
  const liveTracks = (page: Page) =>
    page.evaluate(
      () =>
        (window as unknown as { __streams: MediaStream[] }).__streams
          .flatMap((stream) => stream.getTracks())
          .filter((track) => track.readyState === 'live').length,
    );

  test('grava com tempo decorrido, revisa e envia sem legenda', async ({ page }, info) => {
    const state = await mockApi(page);
    await trackStreams(page);
    await page.goto(`/conversas/${linkedId}`);
    await expect(page.getByRole('log')).toContainText('Bom dia');
    await page.getByLabel('Mensagem', { exact: true }).fill('Texto guardado');
    await page.getByRole('button', { name: 'Gravar áudio' }).click();
    const timer = page.getByRole('timer', { name: 'Tempo de gravação' });
    await expect(timer).toContainText('Gravando 0:0');
    await expect(timer).toContainText(/0:0[1-9]/);
    await expect(page.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    await capture(page, info, 'gravando-desktop');
    await axe(page);
    await page.getByRole('button', { name: 'Concluir gravação' }).click();
    await expect(timer).toHaveCount(0);
    const attachment = page.locator('.conv-attachment');
    await expect(attachment).toContainText('audio-gravado.webm');
    await expect(attachment.locator('audio')).toHaveAttribute('src', /^blob:/);
    await expect.poll(() => liveTracks(page)).toBe(0);
    await expect(page.getByText('O áudio é enviado sem legenda.')).toBeVisible();
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(attachment).toHaveCount(0);
    expect(state.sent).toHaveLength(1);
    expect(state.sent[0].contentType).toMatch(/^multipart\/form-data/);
    expect(state.sent[0].body).toContain('Content-Type: audio/webm');
    expect(state.sent[0].body).not.toContain('name="text"');
    await expect(page.getByLabel('Mensagem', { exact: true })).toHaveValue('Texto guardado');
  });

  test('descartar e sair da tela param as tracks do microfone', async ({ page }) => {
    await mockApi(page);
    await trackStreams(page);
    await page.goto(`/conversas/${linkedId}`);
    await expect(page.getByRole('log')).toContainText('Bom dia');
    await page.getByRole('button', { name: 'Gravar áudio' }).click();
    await expect(page.getByRole('timer')).toBeVisible();
    expect(await liveTracks(page)).toBe(1);
    await page.getByRole('button', { name: 'Descartar gravação' }).click();
    await expect(page.getByRole('timer')).toHaveCount(0);
    await expect.poll(() => liveTracks(page)).toBe(0);
    await expect(page.locator('.conv-attachment')).toHaveCount(0);

    await page.getByRole('button', { name: 'Gravar áudio' }).click();
    await expect(page.getByRole('timer')).toBeVisible();
    await page.getByRole('link', { name: 'Início', exact: true }).click();
    await expect(page).toHaveURL(/\/inicio$/);
    await expect.poll(() => liveTracks(page)).toBe(0);
  });

  test('microfone negado explica como permitir e o texto segue disponível', async ({ page }) => {
    const state = await mockApi(page);
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('Negado', 'NotAllowedError'));
    });
    await page.goto(`/conversas/${linkedId}`);
    await expect(page.getByRole('log')).toContainText('Bom dia');
    await page.getByRole('button', { name: 'Gravar áudio' }).click();
    await expect(page.getByRole('alert')).toContainText('negou o acesso ao microfone');
    await expect(page.getByRole('alert')).toContainText('libere o microfone');
    await page.getByLabel('Mensagem', { exact: true }).fill('Sigo por texto.');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByRole('log')).toContainText('Sigo por texto.');
    expect(state.sent).toHaveLength(1);
  });
});

test.describe('rolagem da conversa', () => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 375, height: 667 },
  ]) {
    test(`em ${viewport.width} px a página fica parada e só as mensagens rolam`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const state = await mockApi(page);
      await page.goto(`/conversas/${linkedId}`);
      const log = page.getByRole('log');
      await expect(log).toContainText('Bom dia');
      const draft = page.getByLabel('Mensagem', { exact: true });
      const composer = page.locator('.conv-composer');
      const gap = () => log.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
      const composerVisible = async () => {
        const box = (await composer.boundingBox())!;
        return box.y + box.height <= viewport.height;
      };
      expect(await composerVisible()).toBe(true);
      await expect.poll(gap).toBeLessThan(2);

      await draft.fill('Mensagem nova.');
      await page.getByRole('button', { name: 'Enviar' }).click();
      await expect(log).toContainText('Mensagem nova.');
      await expect(draft).toBeFocused();
      await expect.poll(gap).toBeLessThan(2);
      expect(await page.evaluate(() => scrollY)).toBe(0);

      // A falha acrescenta aviso e botão: quem estava no fim continua no fim.
      state.messages = state.messages.map((item) =>
        item.body === 'Mensagem nova.' ? { ...item, deliveryStatus: 'FAILED' } : item,
      );
      await expect(log.getByText('Usar o texto de novo')).toHaveCount(2);
      await expect.poll(gap).toBeLessThan(2);

      // O campo cresce com o texto, a lista encolhe e o fim continua à vista.
      await draft.fill('a\nb\nc\nd\ne\nf');
      await expect.poll(gap).toBeLessThan(2);
      expect(await composerVisible()).toBe(true);
      await draft.fill('');

      // Quem subiu para ler não é puxado de volta pela atualização automática.
      await log.evaluate((el) => (el.scrollTop = 100));
      state.messages = [
        ...state.messages,
        message(700, { body: 'Chegou agora.', sentAt: new Date().toISOString() }),
      ];
      await expect(log).toContainText('Chegou agora.');
      expect(Math.abs((await log.evaluate((el) => el.scrollTop)) - 100)).toBeLessThan(2);
      expect(await page.evaluate(() => scrollY)).toBe(0);
    });
  }
});

// A tela cabe na altura visível: a janela não tem o que rolar e a roda do mouse só move a lista e
// as mensagens, sem arrastar a página nem o menu lateral.
const windowScrolls = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
async function wheelOver(page: Page, selector: string, deltaY: number) {
  const box = (await page.locator(selector).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let turn = 0; turn < 6; turn++) await page.mouse.wheel(0, deltaY);
}
const manyConversations = () => [
  linkedConversation(),
  ...Array.from({ length: 11 }, (_, index) => ({
    ...unlinkedConversation(),
    id: uuid(600 + index),
  })),
];

test.describe('tela na altura da janela', () => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
  ]) {
    test(`em ${viewport.width}×${viewport.height} a janela e o menu ficam parados`, async ({
      page,
    }, info) => {
      await page.setViewportSize(viewport);
      const state = await mockApi(page);
      state.conversations = manyConversations();
      await page.goto('/conversas');
      await expect(page.locator('.conv-row')).toHaveCount(12);
      const menu = page.getByRole('complementary', { name: 'Navegação principal' });
      const menuTop = (await menu.boundingBox())!.y;
      expect(await windowScrolls(page)).toBe(false);
      await wheelOver(page, '.conv-rows', 600);
      await wheelOver(page, '.conv-pane', 600);
      expect(await page.evaluate(() => scrollY)).toBe(0);
      expect((await menu.boundingBox())!.y).toBe(menuTop);
      await capture(page, info, `lista-${viewport.width}`);

      await page.locator('.conv-row').first().click();
      const log = page.getByRole('log');
      await expect(log).toContainText('Bom dia');
      expect(await windowScrolls(page)).toBe(false);
      await wheelOver(page, '.conv-log', 600);
      await log.evaluate((element) => (element.scrollTop = 0));
      await wheelOver(page, '.conv-log', -600);
      expect(await page.evaluate(() => scrollY)).toBe(0);
      expect((await menu.boundingBox())!.y).toBe(menuTop);
      await expect(page.locator('.conv-composer')).toBeInViewport({ ratio: 1 });
      await capture(page, info, `conversa-${viewport.width}`);
    });
  }

  test('sem conversas, a área vazia também não rola a janela', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const state = await mockApi(page);
    state.conversations = [];
    await page.goto('/conversas');
    await expect(page.getByText('Nenhuma conversa ainda.')).toBeVisible();
    expect(await windowScrolls(page)).toBe(false);
    await wheelOver(page, '.conv-pane', 600);
    expect(await page.evaluate(() => scrollY)).toBe(0);
  });

  test('no monitor grande, lista e conversa usam a largura e letras maiores', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await mockApi(page);
    await page.goto(`/conversas/${linkedId}`);
    await expect(page.getByRole('log')).toContainText('Bom dia');
    const area = (await page.locator('.app-main').boundingBox())!;
    expect((await page.locator('.conv-shell').boundingBox())!.width).toBeGreaterThan(
      area.width - 100,
    );
    expect((await page.locator('.conv-list').boundingBox())!.width).toBeGreaterThanOrEqual(400);
    const size = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    expect(await size('.conv-row-top strong')).toBeGreaterThanOrEqual(18);
    expect(await size('.conv-msg-body')).toBeGreaterThanOrEqual(18);
    expect(await size('.conv-thread-title h2')).toBeGreaterThanOrEqual(20);
  });

  test('recolher a lista dá a largura toda à conversa e o navegador lembra', async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 1366, height: 860 });
    await mockApi(page);
    await page.goto(`/conversas/${linkedId}`);
    await expect(page.getByRole('log')).toContainText('Bom dia');
    const collapse = page.getByRole('button', { name: 'Recolher conversas' });
    await expect(collapse).toHaveAttribute('aria-expanded', 'true');
    await expect(collapse).toHaveAttribute('aria-controls', 'conv-list');
    await collapse.click();
    const show = page.getByRole('button', { name: 'Mostrar conversas' });
    await expect(show).toHaveAttribute('aria-expanded', 'false');
    await expect(show).toBeFocused();
    await expect(page.locator('.conv-list')).toBeHidden();
    const shell = (await page.locator('.conv-shell').boundingBox())!;
    expect((await page.locator('.conv-pane').boundingBox())!.width).toBeGreaterThan(
      shell.width - 4,
    );
    await capture(page, info, 'lista-recolhida');
    await axe(page);
    await expectTargets(page, '.conv-pane');

    await page.reload();
    await expect(page.getByRole('log')).toContainText('Bom dia');
    await expect(page.locator('.conv-list')).toBeHidden();

    // Sem conversa aberta, a lista volta; a escolha vale de novo na próxima conversa.
    await page
      .getByRole('complementary', { name: 'Navegação principal' })
      .getByRole('link', { name: 'Conversas', exact: true })
      .click();
    await expect(page).toHaveURL(/\/conversas$/);
    await expect(page.locator('.conv-row').first()).toBeVisible();
    await page.locator('.conv-row').first().click();
    await expect(page.locator('.conv-list')).toBeHidden();
    await page.getByRole('button', { name: 'Mostrar conversas' }).click();
    await expect(page.locator('.conv-row').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Recolher conversas' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  test('no celular, a conversa cabe na janela e não oferece recolher', async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockApi(page);
    await page.goto('/conversas');
    await expect(page.locator('.conv-row')).toHaveCount(2);
    await capture(page, info, 'lista-390');
    await page.locator('.conv-row').first().click();
    await expect(page.getByRole('log')).toContainText('Bom dia');
    expect(await windowScrolls(page)).toBe(false);
    await expect(page.locator('.conv-composer')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.conv-collapse')).toBeHidden();
    await expectNoHorizontalOverflow(page);
    await capture(page, info, 'conversa-390');
  });
});
