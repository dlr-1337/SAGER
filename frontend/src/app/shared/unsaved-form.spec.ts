import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewDialogService } from './review-dialog.component';
import { UnsavedFormDirective, UnsavedForms } from './unsaved-form';

@Component({
  imports: [ReactiveFormsModule, UnsavedFormDirective],
  template: `<form sagerUnsaved [formGroup]="form" [sagerSaving]="saving">
    <input formControlName="name" />
    <label><input type="checkbox" /> Destinatário</label>
    <select [formControl]="recipient">
      <option value="">Selecione</option>
      <option value="r1">Pessoa Sintética</option>
    </select>
    <input type="search" data-filter-input [formControl]="search" />
  </form>`,
})
class FormHost {
  readonly form = new FormGroup({ name: new FormControl('Nome Sintético') });
  readonly saving = signal(false);
  readonly recipient = new FormControl('');
  readonly search = new FormControl('');
}

@Component({
  imports: [UnsavedFormDirective],
  template: `<form sagerUnsaved>
    <input type="checkbox" /><input type="search" data-filter-input />
  </form>`,
})
class NativeFormHost {}

describe('Proteção de alterações pendentes', () => {
  let result: Subject<boolean>;
  let open: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    result = new Subject<boolean>();
    open = vi.fn(() => result);
    TestBed.configureTestingModule({
      providers: [{ provide: ReviewDialogService, useValue: { open } }],
    });
  });
  it('sai sem diálogo quando não há alteração', () => {
    expect(TestBed.inject(UnsavedForms).canLeave()).toBe(true);
    expect(open).not.toHaveBeenCalled();
  });

  it.each([
    { selector: 'input[type="checkbox"]', event: 'input' },
    { selector: 'input[type="checkbox"]', event: 'change' },
    { selector: 'select', event: 'input' },
    { selector: 'select', event: 'change' },
  ])('protege controle externo ao grupo: $selector ($event)', async ({ selector, event }) => {
    const fixture = TestBed.createComponent(FormHost);
    await fixture.whenStable();
    fixture.nativeElement
      .querySelector(selector)
      .dispatchEvent(new Event(event, { bubbles: true }));
    const guard = TestBed.inject(UnsavedForms);
    expect(guard.dirty()).toBe(true);
    expect(fixture.componentInstance.form.dirty).toBe(true);
    const beforeUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);
    const leaving = guard.canLeave();
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ title: 'Descartar alterações?' }));
    result.next(false);
    expect(await leaving).toBe(false);
    expect(guard.dirty()).toBe(true);
  });

  it.each(['pristine', 'reset', 'markSaved'])(
    'limpa alterações de controles externos após %s',
    async (action) => {
      const fixture = TestBed.createComponent(FormHost);
      await fixture.whenStable();
      const guard = TestBed.inject(UnsavedForms);
      fixture.nativeElement
        .querySelector('input[type="checkbox"]')
        .dispatchEvent(new Event('input', { bubbles: true }));
      expect(guard.dirty()).toBe(true);
      if (action === 'pristine') fixture.componentInstance.form.markAsPristine();
      else if (action === 'reset') fixture.componentInstance.form.reset();
      else guard.discardAll();
      expect(guard.canLeave()).toBe(true);
      const beforeUnload = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(beforeUnload);
      expect(beforeUnload.defaultPrevented).toBe(false);
      expect(open).not.toHaveBeenCalled();
    },
  );

  it.each(['input', 'change'])('ignora buscas auxiliares com e sem grupo (%s)', async (event) => {
    const grouped = TestBed.createComponent(FormHost);
    const native = TestBed.createComponent(NativeFormHost);
    await grouped.whenStable();
    await native.whenStable();
    for (const fixture of [grouped, native]) {
      fixture.nativeElement
        .querySelector('[data-filter-input]')
        .dispatchEvent(new Event(event, { bubbles: true }));
    }
    expect(TestBed.inject(UnsavedForms).canLeave()).toBe(true);
    expect(grouped.componentInstance.form.pristine).toBe(true);
    expect(open).not.toHaveBeenCalled();
  });

  it.each(['input', 'change'])(
    'protege e limpa controles de formulários nativos (%s)',
    async (event) => {
      const fixture = TestBed.createComponent(NativeFormHost);
      await fixture.whenStable();
      const checkbox = fixture.nativeElement.querySelector('input[type="checkbox"]');
      const guard = TestBed.inject(UnsavedForms);
      checkbox.dispatchEvent(new Event(event, { bubbles: true }));
      expect(guard.dirty()).toBe(true);
      fixture.nativeElement.querySelector('form').reset();
      expect(guard.dirty()).toBe(false);
      checkbox.dispatchEvent(new Event(event, { bubbles: true }));
      expect(guard.dirty()).toBe(true);
      guard.discardAll();
      expect(guard.canLeave()).toBe(true);
      expect(open).not.toHaveBeenCalled();
    },
  );
  it('mantém uma única confirmação e respeita continuar ou descartar', async () => {
    const guard = TestBed.inject(UnsavedForms);
    guard.forms.add({ dirty: () => true, saving: () => false });
    const first = guard.canLeave();
    expect(guard.canLeave()).toBe(first);
    expect(open).toHaveBeenCalledOnce();
    result.next(false);
    expect(await first).toBe(false);
    result = new Subject<boolean>();
    const second = guard.canLeave();
    result.next(true);
    expect(await second).toBe(true);
  });
  it('bloqueia um formulário intacto que está gravando', async () => {
    const guard = TestBed.inject(UnsavedForms);
    guard.forms.add({ dirty: () => false, saving: () => true });
    const leaving = guard.canLeave();
    expect(open).toHaveBeenCalledOnce();
    result.next(false);
    expect(await leaving).toBe(false);
  });

  it.each([false, true])(
    'bloqueia a gravação pendente mesmo com dirty=%s',
    async (initialDirty) => {
      const guard = TestBed.inject(UnsavedForms);
      let dirty = initialDirty;
      let saving = true;
      guard.forms.add({ dirty: () => dirty, saving: () => saving });
      guard.forms.add({ dirty: () => true, saving: () => false });
      const pending = guard.canLeave();
      expect(guard.canLeave()).toBe(pending);
      expect(open).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ title: 'Salvamento em andamento', danger: false }),
      );
      result.next(true);
      expect(await pending).toBe(false);
      dirty = false;
      saving = false;
      guard.forms.clear();
      guard.forms.add({ dirty: () => dirty, saving: () => saving });
      expect(guard.canLeave()).toBe(true);
    },
  );

  it('enxerga o início e o fim da gravação antes de atualizar o template', async () => {
    const fixture = TestBed.createComponent(FormHost);
    await fixture.whenStable();
    const guard = TestBed.inject(UnsavedForms);
    fixture.componentInstance.saving.set(true);
    const leaving = guard.canLeave();
    expect(open).toHaveBeenCalledOnce();
    result.next(false);
    expect(await leaving).toBe(false);
    fixture.componentInstance.saving.set(false);
    expect(guard.canLeave()).toBe(true);
  });

  it('preserva a confirmação de descarte quando uma gravação falha com alterações', async () => {
    const guard = TestBed.inject(UnsavedForms);
    let saving = true;
    guard.forms.add({ dirty: () => true, saving: () => saving });
    const pending = guard.canLeave();
    result.next(false);
    expect(await pending).toBe(false);
    saving = false;
    result = new Subject<boolean>();
    const leaving = guard.canLeave();
    expect(open).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Descartar alterações?' }),
    );
    result.next(false);
    expect(await leaving).toBe(false);
  });

  it.each([
    { dirty: false, saving: false, blocked: false },
    { dirty: true, saving: false, blocked: true },
    { dirty: false, saving: true, blocked: true },
    { dirty: true, saving: true, blocked: true },
  ])('protege recarregamento com dirty=$dirty e saving=$saving', async (state) => {
    const fixture = TestBed.createComponent(FormHost);
    fixture.componentInstance.saving.set(state.saving);
    if (state.dirty) fixture.componentInstance.form.markAsDirty();
    await fixture.whenStable();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(state.blocked);
  });
});
