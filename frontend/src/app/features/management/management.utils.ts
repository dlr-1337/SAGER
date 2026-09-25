export function ageFromBirthDate(value: string, now = new Date()): number {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return 0;
  const age = now.getFullYear() - year;
  return now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)
    ? age - 1
    : age;
}

export function formattedDate(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}
