import { UnsavedFormDirective } from '../../shared/unsaved-form';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { OperationsDemoService } from './operations-demo.service';
import { OperationsReviewDialogComponent, ReviewDialogResult } from './review-dialog.component';
import { NotificationDetailLocalPage } from '../communications/notifications-local.pages';

@Component({
  standalone: true,
  selector: 'app-notification-detail',
  imports: [
    UnsavedFormDirective,
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    NotificationDetailLocalPage,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!session.active()) {
      <sager-notification-detail-local />
    } @else {
      <main class="page op-page op-narrow">
        @if (!session.hasRole('supervisor', 'gestor')) {
          <section class="op-empty" role="alert">
            <h1>Acesso restrito</h1>
            <p>Esta análise é interna.</p>
            <a class="btn op-primary" routerLink="/inicio">Voltar ao início</a>
          </section>
        } @else if (item(); as notification) {
          <header class="op-heading">
            <div>
              <a routerLink="/notificacoes" class="op-back">← Notificações</a>
              <h1>Notificação {{ notification.id }}</h1>
              <p>{{ notification.resident }} · {{ notification.source }}</p>
            </div>
            <span class="op-status">{{ notification.status }}</span>
          </header>
          <section class="op-alert-panel">
            <span class="material-symbols-outlined" aria-hidden="true">info</span>
            <div>
              <h2>Análise humana necessária</h2>
              <p>Este item não gera advertência nem penalidade automática.</p>
            </div>
          </section>
          <section class="panel op-panel" aria-labelledby="notification-data-title">
            <h2 id="notification-data-title">Origem e evidência</h2>
            <dl class="op-definition">
              <div>
                <dt>Residente</dt>
                <dd>{{ notification.resident }}</dd>
              </div>
              <div>
                <dt>Origem</dt>
                <dd>{{ notification.source }}</dd>
              </div>
              <div>
                <dt>Data</dt>
                <dd>{{ notification.at | date: 'dd/MM/yyyy, HH:mm' }}</dd>
              </div>
              <div>
                <dt>Motivo</dt>
                <dd>{{ notification.reason }}</dd>
              </div>
              <div>
                <dt>Evidência demonstrativa</dt>
                <dd>{{ notification.evidence }}</dd>
              </div>
            </dl>
          </section>
          <section class="panel op-panel" aria-labelledby="notification-history-title">
            <h2 id="notification-history-title">Histórico da análise</h2>
            <ol class="op-timeline">
              @for (event of notification.timeline; track $index) {
                <li>
                  <strong>{{ event.label }}</strong
                  ><time>{{ event.at | date: 'dd/MM/yyyy, HH:mm' }}</time>
                  @if (event.detail) {
                    <p>{{ event.detail }}</p>
                  }
                </li>
              }
            </ol>
          </section>
          @if (
            session.hasRole('supervisor') &&
            notification.status !== 'Arquivada' &&
            notification.status !== 'Convertida em advertência'
          ) {
            <section class="panel op-panel" aria-labelledby="notification-decision-title">
              <h2 id="notification-decision-title">Decisão do supervisor</h2>
              <p>Confira a evidência e registre uma decisão. Arquivar preserva o histórico.</p>
              <div class="op-actions">
                <button class="btn op-secondary" type="button" (click)="analyze()">
                  Manter em análise</button
                ><button class="btn op-secondary" type="button" (click)="archive()">
                  Arquivar com justificativa</button
                ><button
                  class="btn op-primary"
                  type="button"
                  (click)="showWarning.set(!showWarning())"
                >
                  {{ showWarning() ? 'Fechar registro' : 'Registrar advertência manual' }}
                </button>
              </div>
              @if (showWarning()) {
                <form
                  sagerUnsaved
                  class="op-form op-warning-form"
                  [formGroup]="warningForm"
                  (ngSubmit)="reviewWarning()"
                  novalidate
                >
                  <h3>Advertência vinculada à notificação</h3>
                  <p class="op-help">
                    Os níveis oficiais de gravidade e evidências mínimas dependem de definição da
                    AE. O campo abaixo é apenas demonstrativo.
                  </p>
                  <label class="field"
                    >Descrição<input
                      type="text"
                      formControlName="description"
                      placeholder="Descreva a ocorrência analisada"
                    />
                    @if (
                      warningForm.controls.description.touched &&
                      warningForm.controls.description.invalid
                    ) {
                      <span class="op-field-error">Informe a descrição.</span>
                    }
                  </label>
                  <div class="op-form-grid">
                    <label class="field"
                      >Data<input type="date" formControlName="date" [max]="today" />
                      @if (warningForm.controls.date.touched && warningForm.controls.date.invalid) {
                        <span class="op-field-error">Informe uma data que não seja futura.</span>
                      }</label
                    ><label class="field"
                      >Gravidade (descrição demonstrativa)<input
                        type="text"
                        formControlName="severity"
                        placeholder="A definir pela AE"
                      />
                      @if (
                        warningForm.controls.severity.touched &&
                        warningForm.controls.severity.invalid
                      ) {
                        <span class="op-field-error">Informe a gravidade para esta simulação.</span>
                      }
                    </label>
                  </div>
                  <label class="field"
                    >Justificativa<textarea rows="3" formControlName="justification"></textarea>
                    @if (
                      warningForm.controls.justification.touched &&
                      warningForm.controls.justification.invalid
                    ) {
                      <span class="op-field-error">Informe a justificativa.</span>
                    }
                  </label>
                  <button class="btn op-primary" type="submit">Revisar advertência</button>
                </form>
              }
              @if (error()) {
                <p class="op-error" role="alert">{{ error() }}</p>
              }
              @if (success()) {
                <p class="op-success" role="status">{{ success() }}</p>
              }
            </section>
          }
          <p class="op-help">
            Dados sintéticos; nenhuma comunicação é enviada ao residente nesta demonstração.
          </p>
        } @else {
          <section class="op-empty" role="alert">
            <h1>Notificação não encontrada</h1>
            <a class="btn op-primary" routerLink="/notificacoes">Voltar às notificações</a>
          </section>
        }
      </main>
    }
  `,
})
export class NotificationDetailComponent {
  readonly session = inject(DemoSessionService);
  readonly service = inject(OperationsDemoService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly item = computed(() =>
    this.session.active() ? this.service.getNotification(this.id) : null,
  );
  readonly showWarning = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly today = new Date().toISOString().slice(0, 10);
  readonly warningForm = new FormGroup({
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    date: new FormControl(this.today, { nonNullable: true, validators: [Validators.required] }),
    severity: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    justification: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    if (this.session.active() && this.session.hasRole('supervisor', 'gestor'))
      this.service.viewNotification(this.id);
  }

  analyze(): void {
    if (!this.session.hasRole('supervisor')) return;
    this.error.set('');
    this.success.set(
      this.service.analyzeNotification(this.id)
        ? 'Notificação mantida em análise.'
        : 'Não foi possível alterar a notificação.',
    );
  }
  archive(): void {
    if (!this.session.hasRole('supervisor')) return;
    const item = this.item();
    if (!item) return;
    this.dialog
      .open<OperationsReviewDialogComponent, any, ReviewDialogResult>(
        OperationsReviewDialogComponent,
        {
          data: {
            title: 'Revisar arquivamento',
            action: 'Arquivar notificação',
            mode: 'reason',
            lines: [
              { label: 'Residente', value: item.resident },
              { label: 'Origem', value: item.source },
              { label: 'Motivo', value: item.reason },
            ],
          },
          width: '620px',
          restoreFocus: true,
        },
      )
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        if (this.service.archiveNotification(this.id, result.reason))
          this.success.set('Notificação arquivada com justificativa.');
        else this.error.set('Informe uma justificativa para arquivar.');
      });
  }
  reviewWarning(): void {
    if (!this.session.hasRole('supervisor')) return;
    this.warningForm.markAllAsTouched();
    const value = this.warningForm.getRawValue();
    if (this.warningForm.invalid || value.date > this.today) {
      this.error.set('Preencha todos os campos e use uma data que não seja futura.');
      return;
    }
    const item = this.item();
    if (!item) return;
    this.dialog
      .open<OperationsReviewDialogComponent, any, ReviewDialogResult>(
        OperationsReviewDialogComponent,
        {
          data: {
            title: 'Revisar advertência manual',
            action: 'Confirmar registro',
            mode: 'simple',
            lines: [
              { label: 'Residente', value: item.resident },
              { label: 'Origem', value: item.id },
              { label: 'Descrição', value: value.description },
              { label: 'Data', value: value.date },
              { label: 'Gravidade', value: value.severity },
              { label: 'Justificativa', value: value.justification },
            ],
          },
          width: '620px',
          restoreFocus: true,
        },
      )
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        if (this.service.convertNotification(this.id, value)) {
          this.showWarning.set(false);
          this.success.set(
            'Advertência demonstrativa registrada manualmente e vinculada à notificação.',
          );
        } else this.error.set('Não foi possível registrar a advertência. Revise os campos.');
      });
  }
}
