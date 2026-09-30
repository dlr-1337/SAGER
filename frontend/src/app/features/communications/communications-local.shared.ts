import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { ArchiveReason } from './communications-local.models';
import { archiveLabels } from './communications-local.utils';

@Component({
  standalone: true,
  selector: 'sager-communications-state',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (demo) {
      <section class="op-empty" role="status">
        <h2>Área do ambiente local</h2>
        <p>Use os registros demonstrativos ao navegar pela demonstração.</p>
        <a class="btn-secondary" routerLink="/inicio">Voltar ao início</a>
      </section>
    } @else if (blocked) {
      <section class="op-empty" role="alert">
        <h2>Acesso restrito</h2>
        <p>Seu perfil não opera este recurso.</p>
      </section>
    } @else if (loading) {
      <section class="op-state" role="status">
        <h2>Carregando registros</h2>
        <p>Consultando os dados autorizados para sua conta.</p>
      </section>
    } @else if (error) {
      <section class="op-state" role="alert">
        <h2>Registros indisponíveis</h2>
        <p>{{ error }}</p>
        <button class="btn-secondary" type="button" (click)="retry.emit()">Tentar novamente</button>
      </section>
    }
  `,
})
export class CommunicationsStateComponent {
  @Input() loading = false;
  @Input() error = '';
  @Input() demo = false;
  @Input() blocked = false;
  @Output() retry = new EventEmitter<void>();
}
export interface CommunicationReviewData {
  title: string;
  action: string;
  lines: { label: string; value: string }[];
  warning?: string;
  requireReason?: boolean;
  archive?: boolean;
  confirmation?: string;
}
export interface CommunicationReviewResult {
  reason: string;
  reasonCode: ArchiveReason;
  confirmed: boolean;
}
@Component({
  standalone: true,
  selector: 'sager-communication-review',
  imports: [MatDialogModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      @if (data.warning) {
        <p class="comm-warning" role="alert">{{ data.warning }}</p>
      }
      <dl class="comm-definition">
        @for (line of data.lines; track line.label) {
          <div>
            <dt>{{ line.label }}</dt>
            <dd>{{ line.value }}</dd>
          </div>
        }
      </dl>
      @if (data.archive) {
        <label class="field"
          >Motivo do arquivamento<select [formControl]="code">
            @for (item of archiveCodes; track item) {
              <option [value]="item">{{ codes[item] }}</option>
            }
          </select></label
        >
      }
      @if (data.requireReason) {
        <label class="field"
          >Justificativa<textarea rows="4" maxlength="2000" [formControl]="reason"></textarea>
        </label>
        <p class="field-hint">Descreva a decisão em 10 a 2.000 caracteres.</p>
      }
      @if (data.confirmation) {
        <label class="comm-check"
          ><input type="checkbox" [formControl]="confirmed" /><span>{{
            data.confirmation
          }}</span></label
        >
      }
      @if (error()) {
        <p class="comm-error" role="alert">{{ error() }}</p>
      }
      <p class="comm-help">
        Confira o conteúdo antes de confirmar. Cancelar fecha esta revisão sem gravar.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end"
      ><button class="btn-secondary" type="button" (click)="dialog.close()">Cancelar</button
      ><button class="btn" type="button" (click)="confirm()">
        {{ data.action }}
      </button></mat-dialog-actions
    >
  `,
  styleUrl: './communications-local.scss',
})
export class CommunicationReviewDialogComponent {
  readonly data = inject<CommunicationReviewData>(MAT_DIALOG_DATA);
  readonly dialog =
    inject<MatDialogRef<CommunicationReviewDialogComponent, CommunicationReviewResult>>(
      MatDialogRef,
    );
  readonly reason = new FormControl('', { nonNullable: true });
  readonly code = new FormControl<ArchiveReason>('SEM_EVIDENCIA', { nonNullable: true });
  readonly confirmed = new FormControl(false, { nonNullable: true });
  readonly error = signal('');
  readonly codes = archiveLabels;
  readonly archiveCodes = Object.keys(archiveLabels) as ArchiveReason[];
  confirm(): void {
    const reason = this.reason.value.trim();
    if (this.data.requireReason && (reason.length < 10 || reason.length > 2000)) {
      this.error.set('Informe uma justificativa de 10 a 2.000 caracteres.');
      return;
    }
    if (this.data.confirmation && !this.confirmed.value) {
      this.error.set('Marque a confirmação após conferir os dados.');
      return;
    }
    this.dialog.close({ reason, reasonCode: this.code.value, confirmed: this.confirmed.value });
  }
}
export class CommunicationDownloads {
  private urls = new Map<string, ReturnType<typeof setTimeout>>();
  download(blob: Blob, termId: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `sager-termo-${/^[0-9a-f-]{36}$/i.test(termId) ? termId : 'documento'}.pdf`;
    anchor.rel = 'noopener';
    anchor.referrerPolicy = 'no-referrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    this.urls.set(
      url,
      setTimeout(() => {
        URL.revokeObjectURL(url);
        this.urls.delete(url);
      }, 1000),
    );
  }
  destroy(): void {
    for (const [url, timer] of this.urls) {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
    }
    this.urls.clear();
  }
}
