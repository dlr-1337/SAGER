import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { CourseApiService } from './course-api.service';
import { ManagementDemoService } from './management-demo.service';
import { ResidentFormComponent } from './resident-form.component';

describe('ResidentFormComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResidentFormComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    TestBed.inject(DemoSessionService).activate('gestor');
  });

  it('keeps the resident list unchanged when required enrollment is missing', () => {
    const service = TestBed.inject(ManagementDemoService);
    const before = service.residents().length;
    const fixture = TestBed.createComponent(ResidentFormComponent);
    fixture.detectChanges();
    const form = fixture.componentInstance.form;
    form.setValue({
      name: 'Pessoa Demonstrativa',
      enrollment: '',
      birthDate: '2009-05-14',
      courseId: '',
      institutionalEmail: '',
      entryYear: null,
      extraSemesters: 0,
      password: 'Senha teste 123!',
      passwordConfirmation: 'Senha teste 123!',
    });

    fixture.nativeElement.querySelector('button[type="submit"]').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Confira a matrícula no SUAP.');
    expect(fixture.nativeElement.textContent).toContain('Escolha o curso.');
    expect(service.residents().length).toBe(before);
  });

  it('explains the password rules beside the field and blocks the save', async () => {
    const service = TestBed.inject(ManagementDemoService);
    const before = service.residents().length;
    const fixture = TestBed.createComponent(ResidentFormComponent);
    await fixture.whenStable();
    const native = fixture.nativeElement as HTMLElement;
    const password = native.querySelector<HTMLInputElement>('#resident-password')!;
    const form = fixture.componentInstance.form;
    expect(password.hasAttribute('maxlength')).toBe(false);
    expect(native.querySelector('#resident-password-help')!.textContent).toBe(
      'Use pelo menos 8 caracteres. Pode ser uma frase fácil de lembrar.',
    );
    const long = 'x y'.repeat(30);
    for (const [value, message] of [
      ['gato az', 'A senha precisa ter pelo menos 8 letras ou números.'],
      ['abcdefgh', 'Essa senha é fácil demais. Escolha outra.'],
      ['20261mat0000123', 'A senha não pode ser igual à matrícula.'],
      [long, 'Essa senha é longa demais. Use uma mais curta.'],
    ]) {
      form.setValue({
        name: 'Pessoa Demonstrativa',
        enrollment: '20261MAT0000123',
        birthDate: '2009-05-14',
        courseId: '',
        institutionalEmail: '',
        entryYear: null,
        extraSemesters: 0,
        password: value,
        passwordConfirmation: value,
      });
      native.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await fixture.whenStable();
      expect(native.querySelector('#resident-password-error')!.textContent).toBe(message);
      expect(password.getAttribute('aria-invalid')).toBe('true');
      expect(password.value).toBe(value);
    }
    expect(service.residents().length).toBe(before);
  });

  it('asks for the same password when the confirmation differs or is empty', async () => {
    const service = TestBed.inject(ManagementDemoService);
    const before = service.residents().length;
    const fixture = TestBed.createComponent(ResidentFormComponent);
    await fixture.whenStable();
    const form = fixture.componentInstance.form;
    for (const passwordConfirmation of ['gato preto', '']) {
      form.setValue({
        name: 'Pessoa Demonstrativa',
        enrollment: '20261MAT0000123',
        birthDate: '2009-05-14',
        courseId: '',
        institutionalEmail: '',
        entryYear: null,
        extraSemesters: 0,
        password: 'gato azul',
        passwordConfirmation,
      });
      await fixture.componentInstance.save();
      expect(fixture.componentInstance.error()).toBe('Repita a mesma senha nos dois campos.');
    }
    expect(service.residents().length).toBe(before);
  });

  it('marks the new course field and does not call the server when it is blank', async () => {
    const save = vi.spyOn(TestBed.inject(CourseApiService), 'save');
    const fixture = TestBed.createComponent(ResidentFormComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.addingCourse.set(true);
    component.newCourse.setValue('   ');
    await component.createCourse();
    fixture.detectChanges();
    expect(save).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('#new-course-error')?.textContent).toContain(
      'Informe um nome',
    );
  });

  it('accepts a simple 8-character phrase', async () => {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const service = TestBed.inject(ManagementDemoService);
    const before = service.residents().length;
    const fixture = TestBed.createComponent(ResidentFormComponent);
    await fixture.whenStable();
    fixture.componentInstance.form.setValue({
      name: 'Pessoa Demonstrativa',
      enrollment: '20261MAT0000123',
      birthDate: '2009-05-14',
      courseId: 'course-1',
      institutionalEmail: '',
      entryYear: null,
      extraSemesters: 0,
      password: 'gato azul',
      passwordConfirmation: 'gato azul',
    });
    await fixture.componentInstance.save();
    expect(service.residents().length).toBe(before + 1);
  });

  it('shows each rule beside its field, without technical terms', async () => {
    const fixture = TestBed.createComponent(ResidentFormComponent);
    await fixture.whenStable();
    const native = fixture.nativeElement as HTMLElement;
    fixture.componentInstance.form.setValue({
      name: 'Maria',
      enrollment: '123',
      birthDate: '1900-01-01',
      courseId: '',
      institutionalEmail: 'maria@gmail.com',
      entryYear: null,
      extraSemesters: 0,
      password: 'gato azul',
      passwordConfirmation: 'gato azul',
    });
    native.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
    expect(native.querySelector('#resident-name-error')!.textContent).toBe(
      'Digite o nome completo, como no documento.',
    );
    expect(native.querySelector('#resident-enrollment-error')!.textContent).toBe(
      'Confira a matrícula no SUAP.',
    );
    expect(native.querySelector('#resident-birth-error')!.textContent).toBe(
      'Confira a data de nascimento.',
    );
    expect(native.querySelector('#resident-email-error')!.textContent).toBe(
      'Use o e-mail institucional, que termina em @estudante.ifgoiano.edu.br.',
    );
    expect(native.querySelector('#resident-course-error')!.textContent).toBe('Escolha o curso.');
    expect(native.querySelector('label[for="resident-course"]')!.textContent).toBe('Curso *');
    expect(
      native.querySelector('input[formControlName="name"]')!.getAttribute('autocomplete'),
    ).toBe('off');
  });

  it('searches courses inside the list, with no separate search field', async () => {
    HTMLElement.prototype.showPopover ??= () => undefined;
    Element.prototype.scrollIntoView ??= () => undefined;
    const fixture = TestBed.createComponent(ResidentFormComponent);
    await fixture.whenStable();
    fixture.componentInstance.courses.set(
      Array.from({ length: 9 }, (_, index) => ({
        id: `c-${index}`,
        name: index === 4 ? 'Agropecuária' : `Curso ${index}`,
        active: true,
        version: 0,
      })),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    const native: HTMLElement = fixture.nativeElement;
    expect(native.querySelector('input[type="search"]')).toBeNull();
    const select = native.querySelector<HTMLSelectElement>('#resident-course')!;
    expect(select.options[0].text).toBe('Selecione o curso');
    select.dispatchEvent(new MouseEvent('mousedown', { button: 0, cancelable: true }));
    const search = document.querySelector<HTMLInputElement>('.select-panel input')!;
    search.value = 'agro';
    search.dispatchEvent(new Event('input'));
    document.querySelector<HTMLElement>('.select-panel [role=option]')!.click();
    expect(fixture.componentInstance.form.controls.courseId.value).toBe('c-4');
    expect(document.querySelector('.select-panel')).toBeNull();
  });

  it('requires a valid, nonfuture birth date before saving', () => {
    const service = TestBed.inject(ManagementDemoService);
    const before = service.residents().length;
    const fixture = TestBed.createComponent(ResidentFormComponent);
    const form = fixture.componentInstance.form;
    form.setValue({
      name: 'Pessoa Demonstrativa',
      enrollment: 'DEMO-999',
      birthDate: '',
      courseId: '',
      institutionalEmail: '',
      entryYear: null,
      extraSemesters: 0,
      password: 'Senha teste 123!',
      passwordConfirmation: 'Senha teste 123!',
    });
    fixture.componentInstance.save();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Informe a data de nascimento.');
    expect(service.residents()).toHaveLength(before);

    form.controls.birthDate.setValue('2025-02-30');
    fixture.componentInstance.save();
    expect(form.controls.birthDate.invalid).toBe(true);
    form.controls.birthDate.setValue('2999-01-01');
    fixture.componentInstance.save();
    expect(form.controls.birthDate.invalid).toBe(true);
    expect(service.residents()).toHaveLength(before);
  });
});
