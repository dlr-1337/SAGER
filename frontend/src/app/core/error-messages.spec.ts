import { ERROR_GENERIC, readableError } from './error-messages';

describe('readableError', () => {
  it('mostra a mensagem escrita pelo sistema', () => {
    expect(readableError(new Error('Confira os campos.'))).toBe('Confira os campos.');
  });

  it('esconde o texto em inglês de falha de rede e de leitura', () => {
    expect(readableError(new TypeError('Failed to fetch'))).toBe(ERROR_GENERIC);
    expect(readableError(new SyntaxError('Unexpected token'))).toBe(ERROR_GENERIC);
    expect(readableError('qualquer coisa', 'Tente depois.')).toBe('Tente depois.');
  });
});
