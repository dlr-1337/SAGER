import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LongExitApiService } from './long-exit-api.service';
import { LongExit } from './long-exit.models';
import { documentShortCode } from './long-exit.utils';
import { resetSession } from '../../core/api';

const at = '2026-09-30T16:00:00Z';
const documentId = '00000000-0000-0000-0000-000000000811';

function exit(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '00000000-0000-0000-0000-000000000801',
    residentId: '00000000-0000-0000-0000-000000000041',
    residentName: 'Estudante Sintético',
    enrollment: 'TESTE-001',
    guardianId: '00000000-0000-0000-0000-000000000051',
    guardianName: 'Responsável Sintético',
    guardianRelationship: 'Mãe',
    reason: 'Visita à família',
    zone: 'America/Sao_Paulo',
    version: 3,
    departureMode: 'NOW',
    status: 'AGUARDANDO_ANALISE',
    signatureStatus: 'PENDING',
    messageStatus: 'READ',
    requestedDepartureAt: at,
    expectedReturnAt: at,
    now: at,
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
    currentDocument: {
      documentVersionId: documentId,
      revisionNumber: 1,
      originalState: 'STORED',
      signedState: 'MISSING',
    },
    remainingResends: 3,
    resendAvailableAt: null,
    bindings: [
      {
        id: '00000000-0000-0000-0000-000000000821',
        documentVersionId: documentId,
        guardianId: '00000000-0000-0000-0000-000000000051',
        guardianName: 'Responsável Sintético',
        status: 'PENDING',
        messageStatus: 'READ',
        expiresAt: at,
        createdAt: at,
        verifiedAt: null,
        verifiedBy: null,
        verifiedByName: null,
      },
    ],
    authorizationFiles: [
      {
        id: '00000000-0000-0000-0000-000000000831',
        documentVersionId: documentId,
        bindingId: '00000000-0000-0000-0000-000000000821',
        origin: 'WHATSAPP',
        state: 'CANDIDATE',
        mediaType: 'image/jpeg',
        size: 10,
        sha256: 'a'.repeat(64),
        senderPhone: null,
        senderDivergent: false,
        receivedAt: at,
        decidedBy: null,
        decidedByName: null,
        decidedAt: null,
        decisionReason: null,
      },
    ],
    whatsappAvailable: true,
    deliveryUnconfirmed: false,
    history: [],
    ...overrides,
  };
}
const json = (value: unknown) =>
  new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });

describe('LongExitApiService', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const api = new LongExitApiService();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetSession();
  });

  it('aceita o contrato de autorização e recusa campos ausentes ou do fluxo antigo', async () => {
    fetchMock.mockImplementation(async () => json(exit()));
    await expect(api.get('x')).resolves.toMatchObject({ whatsappAvailable: true });
    const invalid = [
      { whatsappAvailable: undefined },
      { deliveryUnconfirmed: 'não' },
      { authorizationFiles: undefined },
      { authorizationFiles: [{ id: 'x' }] },
      { signatureStatus: 'SIGNED' },
      {
        capabilities: { ...(exit()['capabilities'] as object), canAttachAuthorization: undefined },
      },
    ];
    for (const overrides of invalid) {
      fetchMock.mockImplementation(async () => json(exit(overrides)));
      await expect(api.get('x')).rejects.toThrow('Não deu certo');
    }
  });

  it('aceita o evento EXPIRE do sistema, gravado sem perfil', async () => {
    const expire = {
      id: '00000000-0000-0000-0000-000000000841',
      event: 'EXPIRE',
      actorId: null,
      actorProfile: null,
      status: 'EXPIRADA',
      guardianId: '00000000-0000-0000-0000-000000000811',
      version: 2,
      recordedAt: at,
    };
    fetchMock.mockImplementation(async () => json(exit({ history: [expire] })));
    await expect(api.get('x')).resolves.toMatchObject({ history: [{ actorProfile: null }] });
    fetchMock.mockImplementation(async () =>
      json(exit({ history: [{ ...expire, actorProfile: 3 }] })),
    );
    await expect(api.get('x')).rejects.toThrow();
  });

  it('valida a elegibilidade só com o WhatsApp como provedor', async () => {
    const eligibility = {
      residentId: 'r',
      residentName: 'n',
      enrollment: 'e',
      currentDate: '2026-09-30',
      zone: 'z',
      now: at,
      eligible: true,
      blockers: [],
      guardians: [],
      providers: { whatsappEnabled: false },
    };
    fetchMock.mockImplementation(async () => json(eligibility));
    await expect(api.eligibility()).resolves.toMatchObject({ eligible: true });
    fetchMock.mockImplementation(async () => json({ ...eligibility, providers: {} }));
    await expect(api.eligibility()).rejects.toThrow('Não deu certo');
  });

  it('envia o anexo em multipart com CSRF e sem definir Content-Type', async () => {
    fetchMock.mockImplementation(async (url) =>
      String(url).endsWith('/auth/csrf')
        ? json({ headerName: 'X-CSRF-TOKEN', token: 't' })
        : json(exit()),
    );
    const file = new File(['foto'], 'foto.jpg', { type: 'image/jpeg' });
    await api.attachAuthorization(exit() as unknown as LongExit, file);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toContain('/autorizacao/arquivos');
    const headers = init!.headers as Record<string, string>;
    expect(headers['X-CSRF-TOKEN']).toBe('t');
    expect(headers).not.toHaveProperty('Content-Type');
    const body = init!.body as FormData;
    expect(body.get('version')).toBe('3');
    expect((body.get('file') as File).name).toBe('foto.jpg');
  });

  it('valida arquivos sem vínculo', async () => {
    const received = {
      messageId: 'm',
      senderPhone: null,
      fromGuardian: true,
      mediaState: 'FAILED',
      failureCode: 'too_large',
      mediaType: null,
      size: 0,
      receivedAt: at,
    };
    fetchMock.mockImplementationOnce(async () => json([received]));
    await expect(api.unlinkedFiles('x')).resolves.toEqual([received]);
    fetchMock.mockImplementationOnce(async () => json([{ ...received, mediaState: 'OUTRO' }]));
    await expect(api.unlinkedFiles('x')).rejects.toThrow('Não deu certo');
  });

  it('o arquivo conferido pode ser imagem, mas o original continua só PDF', async () => {
    const file = (type: string) =>
      new Response(new Blob(['x']), { headers: { 'content-type': type } });
    fetchMock.mockImplementationOnce(async () => file('image/jpeg'));
    await expect(api.document('x', documentId, 'assinado')).resolves.toMatchObject({
      type: 'image/jpeg',
    });
    fetchMock.mockImplementationOnce(async () => file('text/html'));
    await expect(api.document('x', documentId, 'assinado')).rejects.toThrow('não é permitido');
    fetchMock.mockImplementationOnce(async () => file('image/jpeg'));
    await expect(api.document('x', documentId, 'original')).rejects.toThrow('não é um documento');
  });

  it('calcula o mesmo código curto impresso no PDF', () => {
    expect(documentShortCode('a1b2c3d4-0000-4000-8000-000000000000')).toBe('A1B2C3D4');
  });
});
