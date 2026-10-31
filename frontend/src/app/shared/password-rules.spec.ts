import { FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { normalizeEnrollment } from './field-rules';
import { passwordProblem, passwordRules } from './password-rules';

const SHORT = 'A senha precisa ter pelo menos 8 letras ou números.';
const LONG = 'Essa senha é longa demais. Use uma mais curta.';
const EASY = 'Essa senha é fácil demais. Escolha outra.';

describe('passwordProblem', () => {
  it.each(['gato azul', 'gatoazul', '12345679', 'abcdefgj'])('aceita %s', (password) => {
    expect(passwordProblem(password, 'TESTE-1')).toBeNull();
  });

  it('mede o mínimo em caracteres e o máximo em bytes', () => {
    expect(passwordProblem('gatoazu', '')).toBe(SHORT);
    expect(passwordProblem('gato az1', '')).toBeNull();
    expect(passwordProblem('çã'.repeat(18), '')).toBeNull();
    expect(passwordProblem('çã'.repeat(18) + 'x', '')).toBe(LONG);
  });

  it.each([
    '12345678',
    '87654321',
    '123456789',
    '1234567890',
    '0987654321',
    'abcdefgh',
    'ABCDEFGH',
    'hgfedcba',
    'aaaaaaaa',
    '11111111',
    '        ',
    'senha123',
    'SENHA123',
    'password',
    'qwertyui',
    'ifgoiano',
    'sager123',
  ])('recusa "%s" como fácil demais', (password) => {
    expect(passwordProblem(password, 'TESTE-1')).toBe(EASY);
  });

  it('recusa a própria matrícula, ignorando maiúsculas', () => {
    expect(passwordProblem('teste-abc1', ' TESTE-ABC1 ')).toBe(
      'A senha não pode ser igual à matrícula.',
    );
  });
});

describe('passwordRules', () => {
  it('compara com a matrícula normalizada, como o servidor do cadastro', () => {
    const form = new FormGroup({
      enrollment: new FormControl('2017.1-ABCD.000123', { nonNullable: true }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [passwordRules('enrollment', normalizeEnrollment)],
      }),
    });
    form.controls.password.setValue('20171abcd000123');
    expect(form.controls.password.errors?.['passwordRules']).toBe(
      'A senha não pode ser igual à matrícula.',
    );
  });

  it('usa a matrícula do controle irmão', () => {
    const form = new FormGroup({
      enrollment: new FormControl('TESTE-ABC1', { nonNullable: true }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [passwordRules('enrollment')],
      }),
    });
    form.controls.password.setValue('teste-abc1');
    expect(form.controls.password.errors?.['passwordRules']).toBe(
      'A senha não pode ser igual à matrícula.',
    );
    form.controls.enrollment.setValue('OUTRA');
    form.controls.password.updateValueAndValidity();
    expect(form.controls.password.valid).toBe(true);
  });
});
