import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OperationsApiError } from '../operations/operations-local-api.service';
import { ConversationsApiService } from './conversations-api.service';
import { resetSession } from '../../core/api';

const id = '00000000-0000-0000-0000-000000000001';
const message = {
  id,
  conversationId: id,
  direction: 'OUT',
  origin: 'SUPERVISOR',
  kind: 'TEXT',
  body: 'Bom dia',
  mediaState: 'NONE',
  mediaFailureCode: null,
  mediaType: null,
  mediaFilename: null,
  mediaSize: 0,
  deliveryStatus: 'QUEUED',
  failureCode: null,
  sentAt: '2026-10-30T12:00:00Z',
  linkable: false,
};
const conversation = {
  id,
  chatId: '5562999990000@c.us',
  phone: '+5562999990000',
  linked: false,
  guardians: [],
  lastMessage: null,
  unreadCount: 0,
  lastMessageAt: null,
};
const session = {
  available: true,
  status: 'ESTADO_NOVO_DO_GATEWAY',
  linkedAt: null,
  lastEventAt: null,
  canSend: false,
  unavailableReason: 'session_not_ready',
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

describe('ConversationsApiService', () => {
  let service: ConversationsApiService;
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    service = TestBed.inject(ConversationsApiService);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetSession();
  });

  const withCsrf = (answer: Response) =>
    fetchMock
      .mockResolvedValueOnce(json({ headerName: 'X-CSRF-TOKEN', token: 'sintetico' }))
      .mockResolvedValueOnce(answer);

  it('envia texto com CSRF e chave de idempotência', async () => {
    withCsrf(json(message, 201));
    await expect(service.sendText(id, 'Bom dia', 'chave-1234')).resolves.toEqual(message);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`/api/v1/conversas/${id}/mensagens`);
    expect(init.headers).toMatchObject({
      'X-CSRF-TOKEN': 'sintetico',
      'Idempotency-Key': 'chave-1234',
      'Content-Type': 'application/json',
    });
    expect(init.body).toBe(JSON.stringify({ text: 'Bom dia' }));
  });

  it('envia arquivo em multipart sem fixar o Content-Type', async () => {
    withCsrf(json(message, 201));
    const file = new File(['pdf'], 'termo.pdf', { type: 'application/pdf' });
    await service.sendFile(id, file, 'Segue', 'chave-1234');
    const [, init] = fetchMock.mock.calls[1];
    expect(init.headers).not.toHaveProperty('Content-Type');
    expect(init.headers).toMatchObject({ 'X-CSRF-TOKEN': 'sintetico' });
    expect(init.body.get('file').name).toBe('termo.pdf');
    expect(init.body.get('text')).toBe('Segue');
  });

  it('omite a legenda vazia, porque áudio não aceita legenda', async () => {
    withCsrf(json(message, 201));
    const file = new File(['a'], 'audio.webm', { type: 'audio/webm' });
    await service.sendFile(id, file, '', 'chave-1234');
    expect(fetchMock.mock.calls[1][1].body.has('text')).toBe(false);
  });

  it('repassa código e mensagem de conflito', async () => {
    withCsrf(json({ code: 'idempotency_conflict', message: 'Chave já usada.' }, 409));
    const error = await service.sendText(id, 'x', 'chave-1234').catch((value) => value);
    expect(error).toBeInstanceOf(OperationsApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'idempotency_conflict',
      message: 'Chave já usada.',
    });
  });

  it('explica o 413 do proxy, que responde sem o JSON da API', async () => {
    withCsrf(new Response('<html>Too large</html>', { status: 413 }));
    const file = new File(['x'], 'grande.pdf', { type: 'application/pdf' });
    await expect(service.sendFile(id, file, '', 'chave-1234')).rejects.toMatchObject({
      status: 413,
      message: 'O arquivo passa do limite de 10 MB.',
    });
  });

  it('marca leitura com resposta 204 sem corpo', async () => {
    withCsrf(new Response(null, { status: 204 }));
    await expect(service.markRead(id)).resolves.toBeUndefined();
  });

  it('repassa o cursor sem alteração', async () => {
    fetchMock.mockResolvedValueOnce(json({ items: [message], nextCursor: null }));
    await service.messages(id, '2026-10-30T12:00:00Z~' + id);
    const url = new URL(fetchMock.mock.calls[0][0], 'http://x');
    expect(url.searchParams.get('before')).toBe('2026-10-30T12:00:00Z~' + id);
  });

  it('aceita o PDF enviado pelo pedido de saída', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ items: [{ ...message, origin: 'AUTHORIZATION' }], nextCursor: null }),
    );
    await expect(service.messages(id)).resolves.toMatchObject({
      items: [{ origin: 'AUTHORIZATION' }],
    });
  });

  it('recusa formatos fora do contrato', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ items: [{ ...message, deliveryStatus: 'ENVIADO' }], nextCursor: null }),
    );
    await expect(service.messages(id)).rejects.toThrow('dados inválidos');
    fetchMock.mockResolvedValueOnce(
      json({ items: [{ ...conversation, unreadCount: -1 }], nextCursor: null }),
    );
    await expect(service.list()).rejects.toThrow('dados inválidos');
    fetchMock.mockResolvedValueOnce(json({ ...session, canSend: 'nao' }));
    await expect(service.session()).rejects.toThrow('dados inválidos');
  });

  it('aceita estado de sessão desconhecido, sem aceitar motivo desconhecido', async () => {
    fetchMock.mockResolvedValueOnce(json(session));
    await expect(service.session()).resolves.toMatchObject({ status: 'ESTADO_NOVO_DO_GATEWAY' });
    fetchMock.mockResolvedValueOnce(json({ ...session, unavailableReason: 'outro' }));
    await expect(service.session()).rejects.toThrow('dados inválidos');
  });

  it('não coloca extensão de arquivo nas URLs de mídia e QR', () => {
    expect(service.mediaUrl(id)).toBe(`/api/v1/conversas/mensagens/${id}/midia`);
    expect(service.qrUrl(3)).toBe('/api/v1/conversas/sessao/qr?v=3');
  });
});
