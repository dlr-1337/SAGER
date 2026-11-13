import {
  Directive,
  ElementRef,
  effect,
  HostListener,
  OnDestroy,
  inject,
  input,
  computed,
  signal,
  Signal,
} from '@angular/core';
import { FormGroupDirective } from '@angular/forms';
import { PendingForm, UnsavedForms } from './unsaved-forms';

export { UnsavedForms, unsavedFormGuard } from './unsaved-forms';

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
