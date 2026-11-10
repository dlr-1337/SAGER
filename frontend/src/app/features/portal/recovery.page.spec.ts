import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { LocalAuthService } from '../../core/local-auth.service';
import { RecoveryPage } from './recovery.page';

describe('RecoveryPage', () => {
  it('só marca campos inválidos junto da mensagem de erro, inclusive em senha longa', async () => {
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
    expect(element.querySelector('#recovery-error')!.textContent).toBe(
      'Essa senha é longa demais. Use uma mais curta.',
    );
    expect(password.value).toBe('çã'.repeat(20));
    expect(password.hasAttribute('maxlength')).toBe(false);
    expect(password.getAttribute('aria-invalid')).toBe('true');
    expect(password.getAttribute('aria-describedby')).toBe('recovery-password-help recovery-error');
    expect(
      element.querySelector('[formControlName="matricula"]')!.hasAttribute('aria-invalid'),
    ).toBe(false);
  });

  function filled(page: RecoveryPage, password: string, passwordConfirmation = password) {
    page.form.setValue({
      matricula: 'Mat-00123',
      name: 'Pessoa Sintética',
      birthDate: '2009-01-15',
      guardianName: '',
      password,
      passwordConfirmation,
    });
  }

  it.each([
    ['gato az', 'A senha precisa ter pelo menos 8 letras ou números.'],
    ['12345678', 'Essa senha é fácil demais. Escolha outra.'],
    ['mat-00123', 'A senha não pode ser igual à matrícula.'],
  ])('não envia a senha "%s" e explica o motivo', async (password, message) => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const auth = TestBed.inject(LocalAuthService);
    const recover = vi.spyOn(auth, 'recover');
    const page = TestBed.createComponent(RecoveryPage).componentInstance;
    filled(page, password);
    await page.submit();
    expect(page.error()).toBe(message);
    expect(recover).not.toHaveBeenCalled();
  });

  it('pede a mesma senha nos dois campos e reavalia quando a matrícula muda', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const recover = vi.spyOn(TestBed.inject(LocalAuthService), 'recover').mockResolvedValue();
    const page = TestBed.createComponent(RecoveryPage).componentInstance;
    filled(page, 'gato azul', 'gato preto');
    await page.submit();
    expect(page.error()).toContain('mesma senha');
    expect(recover).not.toHaveBeenCalled();

    filled(page, 'mat-00123');
    page.form.controls.matricula.setValue('OUTRA');
    await page.submit();
    expect(recover).toHaveBeenCalledOnce();
  });
});
