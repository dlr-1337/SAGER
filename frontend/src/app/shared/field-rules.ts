import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Mantenha igual a FieldRules.java: o erro 400 do servidor não diz qual regra falhou.
const WORD = "\\p{L}[\\p{L}\\p{M}]*(?:['-]\\p{L}[\\p{L}\\p{M}]*)*";
const NAME = new RegExp(`^${WORD}(?: ${WORD})+$`, 'u');
const PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
const RESIDENT_ENROLLMENT = /^20\d{3}[0-9A-Z]{10,12}$/;
const SUPERVISOR_ID = /^[0-9A-Za-z-]{4,20}$/;
const RESIDENT_EMAIL = /^[a-z0-9]+(?:[._-][a-z0-9]+)*@estudante\.ifgoiano\.edu\.br$/;
/** Igual a SupervisorService.EMAIL: Validators.email aceita domínio sem ponto. */
export const SUPERVISOR_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const civilDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });

type Problem = (value: string) => string | null;

export function civilToday(): string {
  return civilDate.format(new Date());
}

export function normalizeName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().replace(/’/g, "'").normalize('NFC');
}

function significant(word: string): boolean {
  const lower = word.toLowerCase();
  return !PARTICLES.has(lower) && (lower === 'ó' || (lower.match(/\p{L}/gu)?.length ?? 0) >= 2);
}

export const nameProblem: Problem = (value) => {
  const name = normalizeName(value);
  return NAME.test(name) && name.split(' ').filter(significant).length >= 2
    ? null
    : 'Digite o nome completo, como no documento.';
};

export function normalizeEnrollment(value: string): string {
  return value.replace(/[\s./-]/g, '').toUpperCase();
}

export const residentEnrollmentProblem: Problem = (value) => {
  const enrollment = normalizeEnrollment(value);
  return RESIDENT_ENROLLMENT.test(enrollment) && enrollment.slice(0, 4) <= civilToday().slice(0, 4)
    ? null
    : 'Confira a matrícula no SUAP.';
};

export const supervisorIdProblem: Problem = (value) =>
  SUPERVISOR_ID.test(value.trim()) ? null : 'Use de 4 a 20 letras, números ou hífen.';

export const residentEmailProblem: Problem = (value) => {
  const email = value.trim().toLowerCase();
  return !email || RESIDENT_EMAIL.test(email)
    ? null
    : 'Use o e-mail institucional, que termina em @estudante.ifgoiano.edu.br.';
};

export const birthDateProblem: Problem = (value) => {
  if (!value) return 'Informe a data de nascimento.';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const [nowYear, nowMonth, nowDay] = civilToday().split('-').map(Number);
  const age = nowYear - year - (nowMonth < month || (nowMonth === month && nowDay < day) ? 1 : 0);
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day && age >= 10 && age <= 100
    ? null
    : 'Confira a data de nascimento.';
};

/** Opcional; de 1990 até o ano seguinte, como FieldRules.validEntryYear. */
export const entryYearProblem: Problem = (value) => {
  const last = Number(civilToday().slice(0, 4)) + 1;
  return !value || (/^\d{4}$/.test(value) && Number(value) >= 1990 && Number(value) <= last)
    ? null
    : `Informe um ano de 1990 a ${last}.`;
};

export const extraSemestersProblem: Problem = (value) =>
  /^(?:\d|10)$/.test(value) ? null : 'Use um número de 0 a 10.';

/** Sem o +55 e sem o zero da operadora: DDD e número. */
export function phoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^0/, '');
  return digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
}

export const phoneProblem: Problem = (value) => {
  const digits = phoneDigits(value);
  return /^[+\d().\s-]+$/.test(value) &&
    /^[1-9]\d{9,10}$/.test(digits) &&
    (digits.length === 10 || digits[2] === '9')
    ? null
    : 'Digite o telefone com DDD.';
};

/** Mostra (62) 91234-5678; o que não for telefone brasileiro aparece como foi salvo. */
export function phoneMask(value: string | null | undefined): string {
  if (!value) return '';
  // Estrangeiro ou fora do padrão volta igual: o servidor só preserva o legado sem alteração.
  const foreign = /^\+(?!55)/.test(value.trim());
  return foreign || phoneProblem(value)
    ? value
    : phoneDigits(value).replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
}

export const relationshipProblem: Problem = (value) => {
  const relationship = value.trim();
  return relationship.length >= 2 && relationship.length <= 80 && /\p{L}/u.test(relationship)
    ? null
    : 'Escreva o vínculo, como mãe ou pai.';
};

export function validCapacity(capacity: number): boolean {
  return Number.isInteger(capacity) && capacity >= 1 && capacity <= 20;
}

/** Valor igual ao salvo não é validado: um cadastro antigo não trava por dado que não mudou. */
export function changedProblem(
  problem: Problem,
  value: string,
  saved: string | null | undefined,
): string | null {
  return saved != null && value === saved ? null : problem(value);
}

/** Guarda a mensagem em `errors.fieldRule`, como `passwordRules`. */
export function fieldRule(problem: Problem, saved?: () => string | null | undefined): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const message = changedProblem(problem, String(control.value ?? ''), saved?.());
    return message ? { fieldRule: message } : null;
  };
}

export function trimmedLength(min: number, max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const length = String(control.value ?? '').trim().length;
    return length < min || length > max ? { trimmedLength: true } : null;
  };
}
