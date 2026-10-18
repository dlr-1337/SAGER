import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RecoveryPage } from './recovery.page';

describe('RecoveryPage', () => {
  it('só marca campos inválidos junto da mensagem de erro, inclusive acima de 72 bytes', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(RecoveryPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const page = fixture.componentInstance;
    const password = element.querySelector<HTMLInputElement>('[formControlName="password"]')!;

    // Sair de um campo vazio não marca erro sem mensagem que o explique.
    page.form.controls.matricula.markAsTouched();
    fixture.detectChanges();
    expect(element.querySelector('[aria-invalid="true"]')).toBeNull();

    page.form.setValue({
      matricula: '00123',
      name: 'Pessoa Sintética',
      birthDate: '2009-01-15',
      guardianName: '',
      // 40 caracteres e 80 bytes em UTF-8.
      password: 'çã'.repeat(20),
      passwordConfirmation: 'çã'.repeat(20),
    });
    await page.submit();
    fixture.detectChanges();
    expect(element.querySelector('#recovery-error')).not.toBeNull();
    expect(password.getAttribute('aria-invalid')).toBe('true');
    expect(password.getAttribute('aria-describedby')).toBe('recovery-error');
    expect(
      element.querySelector('[formControlName="matricula"]')!.hasAttribute('aria-invalid'),
    ).toBe(false);
  });
});
