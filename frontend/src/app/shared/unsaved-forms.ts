import { Injectable, inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ReviewDialogService } from './review-dialog.component';

// Fica fora de unsaved-form.ts para a guarda das rotas não trazer @angular/forms ao código inicial.
export interface PendingForm {
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
          ? 'Aguarde terminar de salvar antes de sair.'
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
