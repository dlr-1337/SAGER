export const ERROR_CONFLICT =
  'Outra pessoa alterou este registro. Clique em Recarregar, confira e tente de novo.';
export const ERROR_SESSION = 'Sua sessão terminou. Entre de novo.';
export const ERROR_FORBIDDEN =
  'Sua conta não pode fazer isto. Se achar que é engano, saia e entre de novo ou fale com o gestor.';
export const ERROR_NOT_FOUND = 'Não encontramos este registro.';
export const ERROR_INVALID = 'Confira os campos e tente de novo.';
export const ERROR_GENERIC = 'Não deu certo. Verifique a internet e tente de novo.';

/** Network and parsing failures carry English browser text that must not reach the screen. */
export function readableError(error: unknown, fallback = ERROR_GENERIC): string {
  return error instanceof Error && !(error instanceof TypeError || error instanceof SyntaxError)
    ? error.message
    : fallback;
}
