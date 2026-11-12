import { civilToday } from '../../shared/field-rules';

export function ageFromBirthDate(value: string, now = new Date()): number {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return 0;
  const age = now.getFullYear() - year;
  return now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)
    ? age - 1
    : age;
}

// Demonstração apenas; a regra das contas reais fica em ResidentService.formatName.
export function formatResidentName(value: string): string {
  return value
    .toLowerCase()
    .replace(
      /(^|[\s\-'’])(\p{L})/gu,
      (_, boundary: string, letter: string) => boundary + letter.toUpperCase(),
    );
}

export interface CourseProgress {
  stage: string | null;
  expectedGraduation: string | null;
  overdue: boolean | null;
}

/** Etapa atual e semestre previsto de formatura; nulos quando falta ano, nível ou duração. */
export function courseProgress(
  entryYear: number | null | undefined,
  extraSemesters: number | null | undefined,
  course: { level?: 'MEDIO' | 'SUPERIOR' | null; durationYears?: number | null } | null | undefined,
  today: string = civilToday(),
): CourseProgress {
  if (!entryYear || !course?.level || !course.durationYears)
    return { stage: null, expectedGraduation: null, overdue: null };
  const [year, month] = today.split('-').map(Number);
  const now = year * 2 + (month >= 7 ? 1 : 0);
  // shortcut: supõe ingresso no 1º semestre; guardar o semestre de ingresso se houver entrada no meio do ano.
  const start = entryYear * 2;
  const last = start + course.durationYears * 2 - 1 + (extraSemesters ?? 0);
  const elapsed = now - start;
  return {
    stage:
      elapsed < 0
        ? `Ingressa em ${entryYear}`
        : course.level === 'MEDIO'
          ? `${Math.floor(elapsed / 2) + 1}º ano`
          : `${elapsed + 1}º período`,
    expectedGraduation: `${Math.floor(last / 2)}/${(last % 2) + 1}`,
    overdue: now > last,
  };
}

export function formattedDate(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}
