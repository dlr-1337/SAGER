import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const PASSWORD_HELP = 'Use pelo menos 8 caracteres. Pode ser uma frase fácil de lembrar.';
export const PASSWORD_MISMATCH = 'Repita a mesma senha nos dois campos.';

// Mantenha igual a LocalAccountProvisioningService: o erro 400 do servidor não diz qual regra falhou.
const COMMON_PASSWORDS = new Set([
  'senha123',
  'password',
  'qwertyui',
  'ifgoiano',
  'sager123',
  '1234567890',
  '0987654321',
]);

function isSequenceOrRepetition(value: string): boolean {
  const step = value.charCodeAt(1) - value.charCodeAt(0);
  if (Math.abs(step) > 1) return false;
  for (let i = 2; i < value.length; i++) {
    if (value.charCodeAt(i) - value.charCodeAt(i - 1) !== step) return false;
  }
  return true;
}

export function passwordProblem(
  password: string,
  enrollment: string,
  sameAsLogin = 'A senha não pode ser igual à matrícula.',
): string | null {
  if (password.length < 8) return 'A senha precisa ter pelo menos 8 letras ou números.';
  if (new TextEncoder().encode(password).length > 72) {
    return 'Essa senha é longa demais. Use uma mais curta.';
  }
  const lower = password.toLowerCase();
  if (lower === enrollment.trim().toLowerCase()) return sameAsLogin;
  if (COMMON_PASSWORDS.has(lower) || isSequenceOrRepetition(lower)) {
    return 'Essa senha é fácil demais. Escolha outra.';
  }
  return null;
}

/**
 * Guarda a mensagem em `errors.passwordRules`; a matrícula (ou o usuário) vem do controle irmão
 * indicado, e `sameAsLogin` troca a mensagem da senha igual a ele.
 */
export function passwordRules(
  enrollmentControl: string,
  normalize: (enrollment: string) => string = (enrollment) => enrollment,
  sameAsLogin?: string,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const enrollment = control.parent?.get(enrollmentControl)?.value ?? '';
    const problem = passwordProblem(control.value, normalize(enrollment), sameAsLogin);
    return problem ? { passwordRules: problem } : null;
  };
}
