import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SignatureAccessApiService,
  SignatureAccessError,
  signatureAccessError,
} from './signature-access-api.service';
import { SignatureAccess } from './signature-access.models';

const token = 'A'.repeat(43);
const invitation: SignatureAccess = {
  bindingId: '00000000-0000-0000-0000-000000000901',
  documentVersionId: '00000000-0000-0000-0000-000000000902',
  revisionNumber: 2,
  residentName: 'Estudante Sintético',
  enrollment: 'TESTE-001',
  guardianName: 'Responsável Sintético',
  guardianRelationship: 'Mãe',
  requestedDepartureAt: '2026-09-30T16:00:00Z',
  expectedReturnAt: '2026-09-30T22:00:00Z',
  reason: 'Visita familiar',
  notes: null,
  signatureStatus: 'PENDING',
  expiresAt: '2026-09-30T22:00:00Z',
  now: '2026-09-30T16:00:00Z',
  widget: {
    available: true,
    signerId: '00000000-0000-0000-0000-000000000903',
    environment: 'sandbox',
    libraryVersion: '2.1.0',
  },
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
describe('Capability individual de assinatura', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('consulta sem sessão, cache ou referer e transporta capability somente no header', async () => {
    const fetch = vi.fn().mockResolvedValue(json(invitation));
    vi.stubGlobal('fetch', fetch);
    expect(await TestBed.inject(SignatureAccessApiService).access(token)).toEqual(invitation);
    expect(fetch.mock.calls[0]).toEqual([
      '/api/v1/assinaturas/acesso',
      {
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      },
    ]);
  });
  it('rejeita configuração desconhecida e dados incompletos antes de exibir o convite', async () => {
    for (const invalid of [
      { ...invitation, signatureStatus: 'CLIENT_SIGNED' },
      { ...invitation, notes: undefined },
      { ...invitation, widget: { ...invitation.widget, environment: 'https://evil.test' } },
      { ...invitation, widget: { ...invitation.widget, libraryVersion: '1.0' } },
    ]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(invalid)));
      await expect(TestBed.inject(SignatureAccessApiService).access(token)).rejects.toThrow(
        'não puderam ser confirmados',
      );
    }
  });
  it('aceita confirmação sem widget, cujo ambiente e signatário são nulos no contrato real', async () => {
    const valid = {
      ...invitation,
      signatureStatus: 'VALID',
      widget: { available: false, signerId: null, environment: null, libraryVersion: '2.1.0' },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(valid)));
    expect(await TestBed.inject(SignatureAccessApiService).access(token)).toEqual(valid);
  });
  it('exige PDF privado e nunca tenta escrita ou CSRF', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('%PDF-1.7\n%%EOF', { headers: { 'Content-Type': 'application/pdf' } }),
      )
      .mockResolvedValueOnce(new Response('<html/>', { headers: { 'Content-Type': 'text/html' } }));
    vi.stubGlobal('fetch', fetch);
    const api = TestBed.inject(SignatureAccessApiService);
    expect((await api.document(token)).size).toBeGreaterThan(0);
    await expect(api.document(token)).rejects.toThrow('documento original');
    expect(
      fetch.mock.calls.every(
        ([url, options]) =>
          url === '/api/v1/assinaturas/documento' &&
          options.credentials === 'omit' &&
          !options.body &&
          !options.method,
      ),
    ).toBe(true);
  });
  it('não consulta tokens inválidos e não propaga detalhes ou segredos do erro HTTP', async () => {
    const fetch = vi.fn().mockResolvedValue(json({ message: `secret=${token}` }, 410));
    vi.stubGlobal('fetch', fetch);
    await expect(TestBed.inject(SignatureAccessApiService).access('curto')).rejects.toBeInstanceOf(
      SignatureAccessError,
    );
    expect(fetch).not.toHaveBeenCalled();
    try {
      await TestBed.inject(SignatureAccessApiService).access(token);
    } catch (error) {
      expect(signatureAccessError(error)).toContain('expirou ou foi revogado');
      expect(String(error)).not.toContain(token);
    }
  });
});
