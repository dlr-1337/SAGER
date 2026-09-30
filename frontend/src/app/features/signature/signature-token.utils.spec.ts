import { describe, expect, it, vi } from 'vitest';
import { consumeSignatureToken } from './signature-token.utils';
import { approvedClicksignEndpoint } from './clicksign-widget.service';

describe('Acesso individual de assinatura', () => {
  it('extrai token somente do fragmento e remove a URL antes de usar a capability', () => {
    const token = 'A'.repeat(43);
    const history = { state: { navigationId: 4 }, replaceState: vi.fn() };
    expect(
      consumeSignatureToken(
        { hash: `#token=${token}`, pathname: '/assinatura/acesso', search: '' },
        history,
      ),
    ).toBe(token);
    expect(history.replaceState).toHaveBeenCalledWith(
      { navigationId: 4 },
      '',
      '/assinatura/acesso',
    );
  });
  it('remove fragmento inválido e rejeita token ausente, duplicado ou recebido no query', () => {
    for (const hash of [
      '',
      '#token=curto',
      `#token=${'A'.repeat(43)}&token=${'B'.repeat(43)}`,
      `#token=${'A'.repeat(43)}&extra=valor`,
    ]) {
      const history = { state: null, replaceState: vi.fn() };
      expect(
        consumeSignatureToken({ hash, pathname: '/assinatura/acesso', search: '' }, history),
      ).toBeNull();
      if (hash) expect(history.replaceState).toHaveBeenCalledWith(null, '', '/assinatura/acesso');
    }
    expect(
      consumeSignatureToken(
        { hash: '', pathname: '/assinatura/acesso', search: '?token=nao-aceito' },
        { state: null, replaceState: vi.fn() },
      ),
    ).toBeNull();
    const history = { state: null, replaceState: vi.fn() };
    expect(
      consumeSignatureToken(
        {
          hash: `#token=${'A'.repeat(43)}`,
          pathname: '/assinatura/acesso',
          search: `?token=${'B'.repeat(43)}&origem=convite`,
        },
        history,
      ),
    ).toBeNull();
    expect(history.replaceState).toHaveBeenCalledWith(
      null,
      '',
      '/assinatura/acesso?origem=convite',
    );
  });
  it('aceita somente as origens oficiais do widget v3 e rejeita URLs ambíguas', () => {
    expect(approvedClicksignEndpoint('https://sandbox.clicksign.com')).toBe(
      'https://sandbox.clicksign.com',
    );
    expect(approvedClicksignEndpoint('https://app.clicksign.com/')).toBe(
      'https://app.clicksign.com',
    );
    for (const endpoint of [
      'http://sandbox.clicksign.com',
      'https://app.clicksign.com.evil.test',
      'https://evil.test',
      'https://user@app.clicksign.com',
      'https://app.clicksign.com/api/v1',
      'https://app.clicksign.com?token=secret',
      'javascript:alert(1)',
    ])
      expect(approvedClicksignEndpoint(endpoint)).toBeNull();
  });
});
