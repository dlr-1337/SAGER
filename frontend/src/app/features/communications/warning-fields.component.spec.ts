import { describe, expect, it } from 'vitest';
import { warningForm } from './warning-fields.component';

describe('warningForm', () => {
  it('não conta os espaços como texto', () => {
    const form = warningForm();
    form.controls.description.setValue('          ');
    form.controls.justification.setValue('          ');
    expect(form.controls.description.invalid).toBe(true);
    expect(form.controls.justification.invalid).toBe(true);
    form.controls.description.setValue(' abc ');
    form.controls.justification.setValue(' Decisão ok ');
    expect(form.controls.description.valid).toBe(true);
    expect(form.controls.justification.valid).toBe(true);
  });
});
