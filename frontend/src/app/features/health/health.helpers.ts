import { AbstractControl, ValidationErrors } from '@angular/forms';
import { HealthExport } from './health.models';

export function trimmedLength(min: number, max: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: unknown = control.value;
    const length = typeof value === 'string' ? value.trim().length : 0;
    return length < min || length > max ? { trimmedLength: true } : null;
  };
}

export function plainHealthText(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  return typeof value === 'string' && /<!--|<\/?[a-z][^>]*>/i.test(value) ? { markup: true } : null;
}

export function downloadHealthExport(value: HealthExport): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `sager-saude-${value.exportId}.json`;
  document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
