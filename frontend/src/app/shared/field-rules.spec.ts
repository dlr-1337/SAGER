import { FormControl } from '@angular/forms';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  birthDateProblem,
  changedProblem,
  entryYearProblem,
  fieldRule,
  nameProblem,
  normalizeEnrollment,
  normalizeName,
  phoneDigits,
  phoneMask,
  phoneProblem,
  relationshipProblem,
  residentEmailProblem,
  residentEnrollmentProblem,
  supervisorIdProblem,
  trimmedLength,
  validCapacity,
} from './field-rules';

// Mesmos exemplos de backend/src/test/java/.../management/FieldRulesTest.java.
describe('nome completo', () => {
  it.each([
    'Ana Li',
    'Jó Sá',
    'Maria do Ó',
    "Ana D'Ávila",
    'Ana D’Ávila',
    'Ana-Clara dos Santos',
    'João da Silva Filho',
    'João Silva Jr',
    '  ana   li  ',
    'MARIA DA SILVA',
  ])('aceita %s', (name) => expect(nameProblem(name)).toBeNull());

  it.each([
    'Maria',
    'Maria de',
    'Da Silva',
    'DA SILVA',
    'Maria S',
    'Ana2 Silva',
    'J. Silva',
    'João Silva Jr.',
    'Maria e',
    'de da',
    '',
  ])('recusa %s', (name) =>
    expect(nameProblem(name)).toBe('Digite o nome completo, como no documento.'),
  );

  it('normaliza espaços, apóstrofo e acentos', () => {
    expect(normalizeName('  Ana   D’Ávila ')).toBe("Ana D'Ávila");
  });
});

describe('matrícula de residente', () => {
  beforeEach(() => vi.setSystemTime(new Date('2026-06-15T12:00:00-03:00')));
  afterEach(() => vi.useRealTimers());

  it.each(['20171ABCD000123', '2017.1-abcd/000 123', '2024100000000001', '20151000000000001'])(
    'aceita %s',
    (value) => expect(residentEnrollmentProblem(value)).toBeNull(),
  );

  it.each([
    '123',
    'SAGER-QA-2026-001',
    'TESTE-RESIDENTE',
    'DEMO-A',
    '20171ABCD00012',
    '202610000000000001',
    '19991000000000000',
    '20271ABCD000123',
  ])('recusa %s', (value) =>
    expect(residentEnrollmentProblem(value)).toBe('Confira a matrícula no SUAP.'),
  );

  it('ignora o que foi digitado entre os números', () => {
    expect(normalizeEnrollment(' 2017 1.abcd/000-123 ')).toBe('20171ABCD000123');
  });
});

describe('identificação de supervisor', () => {
  it.each(['0123456', 'DEMO-SUP-001', 'abcd', 'A'.repeat(20)])('aceita %s', (value) =>
    expect(supervisorIdProblem(value)).toBeNull(),
  );
  it.each(['abc', 'A'.repeat(21), 'ana@ifgoiano', 'SIAPE 123'])('recusa %s', (value) =>
    expect(supervisorIdProblem(value)).not.toBeNull(),
  );
});

describe('e-mail de residente', () => {
  it.each([
    '',
    'maria.silva@estudante.ifgoiano.edu.br',
    'Ana.Clara.Dias2@ESTUDANTE.ifgoiano.edu.br',
    'a@estudante.ifgoiano.edu.br',
  ])('aceita "%s"', (value) => expect(residentEmailProblem(value)).toBeNull());

  it.each([
    'maria@gmail.com',
    'maria@ifgoiano.edu.br',
    'maria..silva@estudante.ifgoiano.edu.br',
    '@estudante.ifgoiano.edu.br',
  ])('recusa %s', (value) =>
    expect(residentEmailProblem(value)).toBe(
      'Use o e-mail institucional, que termina em @estudante.ifgoiano.edu.br.',
    ),
  );
});

describe('data de nascimento', () => {
  const INVALID = 'Confira a data de nascimento.';
  beforeEach(() => vi.setSystemTime(new Date('2026-06-15T12:00:00-03:00')));
  afterEach(() => vi.useRealTimers());

  it('aceita idade de 10 a 100 anos', () => {
    expect(birthDateProblem('2016-06-15')).toBeNull();
    expect(birthDateProblem('1926-06-15')).toBeNull();
  });

  it.each(['2016-06-16', '1925-06-14', '2026-06-15', '2026-06-16', '1900-01-01', '2010-02-30'])(
    'recusa %s',
    (value) => expect(birthDateProblem(value)).toBe(INVALID),
  );

  it('pede a data quando vazia', () => {
    expect(birthDateProblem('')).toBe('Informe a data de nascimento.');
  });

  it('usa o dia de São Paulo, não o do navegador', () => {
    vi.setSystemTime(new Date('2026-06-16T01:00:00Z'));
    expect(birthDateProblem('2016-06-16')).toBe(INVALID);
    expect(birthDateProblem('2016-06-15')).toBeNull();
  });
});

describe('telefone', () => {
  it.each([
    '(62) 91234-5678',
    '62912345678',
    '+55 62 91234-5678',
    '(62) 3333-4444',
    '062912345678',
  ])('aceita %s', (value) => expect(phoneProblem(value)).toBeNull());

  it.each(['', '91234-5678', '(00) 00000-0000', '(62) 81234-5678', 'ligar à noite'])(
    'recusa "%s"',
    (value) => expect(phoneProblem(value)).toBe('Digite o telefone com DDD.'),
  );

  it('mostra com máscara e guarda só o DDD e o número', () => {
    expect(phoneMask('+5562912345678')).toBe('(62) 91234-5678');
    expect(phoneMask('6233334444')).toBe('(62) 3333-4444');
    expect(phoneMask('(00) 00000-0000')).toBe('(00) 00000-0000');
    expect(phoneMask('ligar à noite')).toBe('ligar à noite');
    expect(phoneMask(null)).toBe('');
    expect(phoneDigits('+55 (62) 91234-5678')).toBe('62912345678');
  });

  it.each(['+1 919 555 1234', '+1 919 555 123', '62 31234-5678'])(
    'não reescreve o legado %s, para o servidor reconhecer o valor salvo',
    (value) => expect(phoneMask(value)).toBe(value),
  );
});

describe('demais campos', () => {
  it('vínculo precisa de letras', () => {
    expect(relationshipProblem('Mãe')).toBeNull();
    expect(relationshipProblem('12')).not.toBeNull();
    expect(relationshipProblem('   ')).not.toBeNull();
  });

  it('capacidade fica entre 1 e 20', () => {
    expect([1, 20].every(validCapacity)).toBe(true);
    expect([0, 21, 500, 1.5].some(validCapacity)).toBe(false);
  });

  it('ano de ingresso é obrigatório e vai de 1990 ao ano seguinte', () => {
    vi.setSystemTime(new Date('2026-06-15T12:00:00-03:00'));
    expect(entryYearProblem('')).toBe('Informe o ano de ingresso.');
    expect(entryYearProblem('2025')).toBeNull();
    expect(entryYearProblem('2027')).toBeNull();
    expect(entryYearProblem('1989')).toBe('Informe um ano de 1990 a 2027.');
    expect(entryYearProblem('2028')).not.toBeNull();
    vi.useRealTimers();
  });

  it('texto só com espaços não conta', () => {
    expect(trimmedLength(3, 10)(new FormControl('     '))).toEqual({ trimmedLength: true });
    expect(trimmedLength(3, 10)(new FormControl(' ok! '))).toBeNull();
  });
});

describe('só vale para valor alterado', () => {
  it('deixa passar o valor salvo e recusa a alteração', () => {
    expect(changedProblem(nameProblem, 'Maria', 'Maria')).toBeNull();
    expect(changedProblem(nameProblem, 'Mariana', 'Maria')).not.toBeNull();
    expect(changedProblem(nameProblem, 'Maria', undefined)).not.toBeNull();
    expect(changedProblem(phoneProblem, '', '')).toBeNull();
    expect(changedProblem(phoneProblem, '', undefined)).not.toBeNull();
  });

  it('guarda a mensagem no controle', () => {
    const rule = fieldRule(residentEnrollmentProblem, () => 'SAGER-QA-2026-001');
    expect(rule(new FormControl('SAGER-QA-2026-001'))).toBeNull();
    expect(rule(new FormControl('123'))).toEqual({ fieldRule: 'Confira a matrícula no SUAP.' });
  });
});
