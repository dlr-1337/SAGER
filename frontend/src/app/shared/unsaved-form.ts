import {
  Directive,
  ElementRef,
  effect,
  HostListener,
  Injectable,
  OnDestroy,
  inject,
  input,
  computed,
  signal,
  Signal,
} from '@angular/core';
import { FormGroupDirective } from '@angular/forms';
import { CanDeactivateFn } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ReviewDialogService } from './review-dialog.component';

interface PendingForm {
  dirty: () => boolean;
  saving: () => boolean;
  discard?: () => void;
}
@Injectable({ providedIn: 'root' })
export class UnsavedForms {
  private readonly dialogs = inject(ReviewDialogService);
  readonly forms = new Set<PendingForm>();
  private confirmation?: Promise<boolean>;
  discardAll(): void {
    this.forms.forEach((form) => form.discard?.());
  }
  dirty(): boolean {
    return [...this.forms].some((f) => f.dirty());
  }
  canLeave(): Promise<boolean> | boolean {
    const pending = [...this.forms].filter((f) => f.dirty() || f.saving());
    if (!pending.length) return true;
    if (this.confirmation) return this.confirmation;
    const saving = pending.some((f) => f.saving());
    this.confirmation = firstValueFrom(
      this.dialogs.open({
        title: saving ? 'Salvamento em andamento' : 'Descartar alterações?',
        summary: saving
          ? 'Aguarde a resposta do servidor antes de sair. A mudança pode já estar sendo gravada.'
          : 'As alterações deste formulário ainda não foram salvas.',
        confirmLabel: saving ? 'Aguardar' : 'Descartar e sair',
        cancelLabel: 'Continuar preenchendo',
        danger: !saving,
      }),
    )
      .then((result) => !saving && result === true)
      .finally(() => {
        this.confirmation = undefined;
      });
    return this.confirmation;
  }
}
export const unsavedFormGuard: CanDeactivateFn<unknown> = () => inject(UnsavedForms).canLeave();

@Directive({
  selector: 'form[sagerUnsaved]',
  standalone: true,
  exportAs: 'sagerUnsaved',
  host: { '[attr.aria-busy]': 'saving()' },
})
export class UnsavedFormDirective implements OnDestroy {
  readonly sagerSaving = input<Signal<boolean>>(signal(false));
  // Guards read the source signal before Angular refreshes the template binding.
  readonly saving = computed(() => this.sagerSaving()());
  private readonly group = inject(FormGroupDirective, { optional: true, self: true });
  private readonly guard = inject(UnsavedForms);
  private readonly element = inject<ElementRef<HTMLFormElement>>(ElementRef);
  private readonly frozen = new Map<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
    boolean
  >();
  private nativeDirty = false;
  private readonly registration: PendingForm = {
    dirty: () => (this.group ? this.group.form.dirty : this.nativeDirty),
    saving: () => this.saving(),
    discard: () => this.markSaved(),
  };
  constructor() {
    this.guard.forms.add(this.registration);
    effect(() => {
      if (this.saving()) {
        for (const control of this.element.nativeElement.querySelectorAll<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >('input,textarea,select')) {
          if (!this.frozen.has(control)) this.frozen.set(control, control.disabled);
          control.disabled = true;
        }
      } else {
        this.frozen.forEach((disabled, control) => (control.disabled = disabled));
        this.frozen.clear();
      }
    });
  }
  @HostListener('input', ['$event'])
  @HostListener('change', ['$event'])
  changed(event: Event): void {
    if ((event.target as HTMLElement).hasAttribute('data-filter-input')) return;
    if (this.group) this.group.form.markAsDirty();
    else this.nativeDirty = true;
  }
  @HostListener('reset') reset(): void {
    this.nativeDirty = false;
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent): void {
    if (this.registration.dirty() || this.registration.saving()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  markSaved(): void {
    this.nativeDirty = false;
    this.group?.form.markAsPristine();
  }
  ngOnDestroy(): void {
    this.guard.forms.delete(this.registration);
  }
}
