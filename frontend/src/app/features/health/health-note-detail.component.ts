import { UnsavedFormDirective } from '../../shared/unsaved-form';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewChild,
  ElementRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiError, HealthApiService, healthErrorMessage } from './health-api.service';
import {
  HealthNote,
  HealthProfessional,
  HealthRevision,
  HealthShare,
  categoryLabels,
  professionLabels,
} from './health.models';
import { plainHealthText, trimmedLength } from './health.helpers';

@Component({
  selector: 'app-health-note-detail',
  imports: [UnsavedFormDirective, DatePipe, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './health.scss',
  template: `
    @if (loading()) {
      <p role="status">Carregando registro e histórico…</p>
    }
    @if (error()) {
      <p class="health-alert" role="alert">{{ error() }}</p>
      <button type="button" class="btn-secondary" (click)="load()" [disabled]="loading()">
        Recarregar dados
      </button>
    }
    @if (success()) {
      <p class="health-success" role="status">{{ success() }}</p>
    }
    @if (note(); as record) {
      <section class="panel" aria-labelledby="health-note-heading">
        <h2 id="health-note-heading" tabindex="-1">{{ categories[record.category] }}</h2>
        <dl class="health-details">
          <div>
            <dt>Profissional responsável</dt>
            <dd>{{ record.authorName }} · {{ professions[record.authorProfession] }}</dd>
          </div>
          <div>
            <dt>Registro profissional</dt>
            <dd>{{ record.authorRegistrationNumber }} / {{ record.authorRegistrationRegion }}</dd>
          </div>
          <div>
            <dt>Registrado em</dt>
            <dd>{{ record.createdAt | date: 'dd/MM/yyyy HH:mm' }}</dd>
          </div>
          <div>
            <dt>Atualizado em</dt>
            <dd>{{ record.updatedAt | date: 'dd/MM/yyyy HH:mm' }}</dd>
          </div>
        </dl>
        <p class="health-note">{{ record.body }}</p>
        @if (record.relatedNoteId) {
          <p class="health-meta">Este registro dá continuidade a outro registro.</p>
        }
        @if (record.custodyAccess && !own()) {
          <p class="health-meta">
            Custódia permite continuidade com nova autoria. O registro original permanece
            preservado.
          </p>
          <a
            class="btn-secondary"
            [routerLink]="['/saude/residentes', record.residentId]"
            [queryParams]="{ continuidade: record.id }"
            >Registrar continuidade</a
          >
        }
        @if (record.canCorrect && !own()) {
          <details class="health-disclosure">
            <summary>Corrigir registro</summary>
            <p>O texto anterior fica guardado no histórico.</p>
            <form
              sagerUnsaved
              [sagerSaving]="busy"
              class="health-form"
              [formGroup]="correction"
              (ngSubmit)="correct()"
            >
              <div class="field">
                <label for="correction-body">Texto corrigido *</label>
                <textarea
                  id="correction-body"
                  formControlName="body"
                  rows="7"
                  maxlength="4000"
                  aria-describedby="correction-body-help"
                  [attr.aria-invalid]="invalidCorrection('body')"
                ></textarea>
                <span
                  id="correction-body-help"
                  [class.field-error]="invalidCorrection('body')"
                  class="field-hint"
                  >Use texto simples, sem HTML, de 1 a 4000 caracteres. Não inclua dados de
                  terceiros.</span
                >
              </div>
              <div class="field health-section">
                <label for="correction-reason">Justificativa da correção *</label>
                <textarea
                  id="correction-reason"
                  formControlName="reason"
                  maxlength="500"
                  aria-describedby="correction-reason-help"
                  [attr.aria-invalid]="invalidCorrection('reason')"
                ></textarea>
                <span
                  id="correction-reason-help"
                  [class.field-error]="invalidCorrection('reason')"
                  class="field-hint"
                  >Informe de 10 a 500 caracteres.</span
                >
              </div>
              <div class="action-row">
                <button type="submit" class="btn" [disabled]="busy() || conflict()">
                  {{ busy() ? 'Salvando…' : 'Salvar correção' }}
                </button>
              </div>
            </form>
          </details>
        }
      </section>
      <section class="panel health-section" aria-labelledby="health-history-heading">
        <h2 id="health-history-heading">Histórico preservado</h2>
        @for (revision of revisions(); track revision.id) {
          <article class="health-revision">
            <h3>{{ revision.recordedAt | date: 'dd/MM/yyyy HH:mm' }}</h3>
            <p class="health-note">{{ revision.body }}</p>
            @if (revision.reason) {
              <p class="health-note"><strong>Justificativa:</strong> {{ revision.reason }}</p>
            }
          </article>
        } @empty {
          <p>Nenhuma correção anterior.</p>
        }
        @if (historyCursor() !== null) {
          <button
            type="button"
            class="btn-secondary health-pagination"
            [disabled]="busy()"
            (click)="moreHistory()"
          >
            Carregar revisões anteriores
          </button>
        }
      </section>
      @if (!own()) {
        <section class="panel health-section" aria-labelledby="health-share-heading">
          <h2 id="health-share-heading">Partilha entre profissionais</h2>
          <p>
            Acesso explícito ao registro, histórico e futuras correções. Apenas profissionais com
            acesso liberado e que atendem este residente podem receber.
          </p>
          <ul class="health-list">
            @for (share of record.shares; track share.id) {
              <li class="health-row">
                <div>
                  <h3>{{ share.recipientName }}</h3>
                  <p [id]="'health-share-status-' + share.id">
                    {{ professions[share.profession] }} ·
                    {{
                      share.endedAt
                        ? 'Partilha revogada'
                        : record.canShare
                          ? activeCareAssignments().has(share.recipientCareAssignmentId)
                            ? 'Acesso vigente nesta consulta'
                            : 'Acesso indisponível nesta consulta'
                          : 'Partilha registrada'
                    }}
                  </p>
                  <p class="health-meta">
                    Registrada em {{ share.createdAt | date: 'dd/MM/yyyy HH:mm:ss' }}
                  </p>
                </div>
                @if (record.canShare && !share.endedAt) {
                  <button
                    type="button"
                    class="btn-secondary"
                    [disabled]="busy() || conflict()"
                    [attr.aria-describedby]="'health-share-status-' + share.id"
                    (click)="revocation.set(share)"
                  >
                    Revogar partilha de {{ share.recipientName }}
                  </button>
                }
              </li>
            } @empty {
              <li class="health-state">Nenhuma partilha registrada.</li>
            }
          </ul>
          @if (revocation(); as share) {
            <div class="health-section" role="group" aria-label="Confirmar revogação">
              <p>
                Revogar o acesso de <strong>{{ share.recipientName }}</strong> ao registro e ao
                histórico?
              </p>
              <div class="action-row">
                <button type="button" class="btn" [disabled]="busy()" (click)="revoke(share)">
                  Confirmar revogação
                </button>
                <button
                  type="button"
                  class="btn-secondary"
                  [disabled]="busy()"
                  (click)="revocation.set(null)"
                >
                  Cancelar revogação
                </button>
              </div>
            </div>
          }
          @if (record.canShare) {
            <form
              sagerUnsaved
              #sharingDraft="sagerUnsaved"
              [sagerSaving]="busy"
              class="health-form"
              (submit)="$event.preventDefault(); share()"
            >
              <fieldset>
                <legend>Selecionar novos destinatários</legend>
                @for (person of recipients(); track person.grantId) {
                  <label class="health-check">
                    <input
                      type="checkbox"
                      [checked]="selected().includes(person.grantId)"
                      [disabled]="busy() || conflict()"
                      (change)="toggleRecipient(person.grantId)"
                    />
                    <span>{{ person.name }} · {{ professions[person.profession] }}</span>
                  </label>
                } @empty {
                  <p class="muted">Nenhum novo destinatário compatível está disponível.</p>
                }
              </fieldset>
              @if (selectionError()) {
                <p class="field-error" role="alert">Selecione ao menos um destinatário.</p>
              }
              <div class="action-row">
                <button
                  type="submit"
                  class="btn"
                  [disabled]="busy() || conflict() || recipients().length === 0"
                >
                  Partilhar registro
                </button>
              </div>
            </form>
          }
        </section>
      }
    }
  `,
})
export class HealthNoteDetailComponent {
  @ViewChild('sharingDraft') private sharingDraft?: UnsavedFormDirective;
  private readonly api = inject(HealthApiService);
  private readonly destroy = inject(DestroyRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly noteId = input.required<string>();
  readonly own = input(false);
  readonly note = signal<HealthNote | null>(null);
  readonly revisions = signal<HealthRevision[]>([]);
  readonly historyCursor = signal<string | number | null>(null);
  readonly recipients = signal<HealthProfessional[]>([]);
  readonly activeCareAssignments = signal(new Set<string>());
  readonly selected = signal<string[]>([]);
  readonly revocation = signal<HealthShare | null>(null);
  readonly selectionError = signal(false);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly conflict = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly categories = categoryLabels;
  readonly professions = professionLabels;
  readonly correction = new FormGroup({
    body: new FormControl('', {
      nonNullable: true,
      validators: [trimmedLength(1, 4000), plainHealthText],
    }),
    reason: new FormControl('', { nonNullable: true, validators: [trimmedLength(10, 500)] }),
  });
  private request = 0;

  constructor() {
    effect(() => {
      this.noteId();
      this.own();
      void this.load();
    });
  }

  async load(): Promise<void> {
    const request = ++this.request;
    const id = this.noteId();
    const own = this.own();
    this.note.set(null);
    this.revisions.set([]);
    this.recipients.set([]);
    this.activeCareAssignments.set(new Set());
    this.selected.set([]);
    this.revocation.set(null);
    this.correction.reset();
    this.success.set('');
    this.loading.set(true);
    this.error.set('');
    this.conflict.set(false);
    try {
      const [record, history] = await Promise.all([
        this.api.note(id, own),
        this.api.history(id, own),
      ]);
      const professionals =
        record.canShare && !own
          ? await this.api.professionals(record.residentId, record.category)
          : { items: [] };
      if (this.destroy.destroyed || request !== this.request) return;
      this.note.set(record);
      this.revisions.set(history.items);
      this.activeCareAssignments.set(
        new Set(professionals.items.map((person) => person.careAssignmentId)),
      );
      this.historyCursor.set(history.nextCursor);
      this.recipients.set(
        professionals.items.filter(
          (person) =>
            person.accountId !== record.authorAccountId &&
            !record.shares.some(
              (s) =>
                !s.endedAt &&
                s.recipientGrantId === person.grantId &&
                s.recipientCareAssignmentId === person.careAssignmentId,
            ),
        ),
      );
      this.correction.reset({ body: record.body, reason: '' });
      if (own)
        setTimeout(() => {
          if (!this.destroy.destroyed && request === this.request)
            this.element.nativeElement.querySelector<HTMLElement>('#health-note-heading')?.focus();
        }, 0);
    } catch (error) {
      if (!this.destroy.destroyed && request === this.request)
        this.error.set(healthErrorMessage(error));
    } finally {
      if (!this.destroy.destroyed && request === this.request) this.loading.set(false);
    }
  }

  invalidCorrection(field: 'body' | 'reason'): boolean {
    const control = this.correction.controls[field];
    return control.touched && control.invalid;
  }
  toggleRecipient(id: string): void {
    this.selectionError.set(false);
    this.selected.update((ids) => (ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id]));
  }
  async correct(): Promise<void> {
    const record = this.note();
    if (!record?.canCorrect || this.own() || this.busy() || this.conflict()) return;
    if (this.correction.invalid) {
      this.correction.markAllAsTouched();
      setTimeout(
        () =>
          this.element.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
        0,
      );
      return;
    }
    const value = this.correction.getRawValue();
    await this.change(
      () =>
        this.api.correctNote(record.id, {
          version: record.version,
          body: value.body.trim(),
          reason: value.reason.trim(),
        }),
      'Correção registrada. O histórico foi preservado.',
    );
  }
  async share(): Promise<void> {
    const record = this.note();
    if (!record?.canShare || this.own() || this.busy() || this.conflict()) return;
    if (this.selected().length === 0) {
      this.selectionError.set(true);
      return;
    }
    await this.change(
      () => this.api.shareNote(record.id, record.version, this.selected()),
      'Partilha registrada para os destinatários selecionados.',
    );
    if (this.success()) this.sharingDraft?.markSaved();
  }
  async revoke(share: HealthShare): Promise<void> {
    const record = this.note();
    if (!record?.canShare || this.own() || this.busy() || this.conflict()) return;
    await this.change(
      () => this.api.revokeShare(record.id, share.id, share.version),
      'Partilha revogada.',
    );
  }
  async moreHistory(): Promise<void> {
    const record = this.note();
    if (!record || this.busy() || this.historyCursor() === null) return;
    const request = this.request;
    this.busy.set(true);
    try {
      const page = await this.api.history(record.id, this.own(), this.historyCursor());
      if (this.destroy.destroyed || request !== this.request) return;
      this.revisions.update((items) => [...items, ...page.items]);
      this.historyCursor.set(page.nextCursor);
    } catch (error) {
      if (request === this.request) this.fail(error);
    } finally {
      if (!this.destroy.destroyed) this.busy.set(false);
    }
  }
  private async change(action: () => Promise<void>, success: string): Promise<void> {
    const request = this.request;
    this.busy.set(true);
    this.success.set('');
    this.error.set('');
    try {
      await action();
      if (this.destroy.destroyed || request !== this.request) return;
      await this.load();
      if (!this.destroy.destroyed && this.request === request + 1 && !this.error())
        this.success.set(success);
    } catch (error) {
      if (request === this.request) this.fail(error);
    } finally {
      if (!this.destroy.destroyed) this.busy.set(false);
    }
  }
  private fail(error: unknown): void {
    if (this.destroy.destroyed) return;
    this.error.set(healthErrorMessage(error));
    this.conflict.set(error instanceof ApiError && error.status === 409);
    if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
      ++this.request;
      this.note.set(null);
      this.revisions.set([]);
      this.recipients.set([]);
      this.selected.set([]);
      this.correction.reset();
      this.revocation.set(null);
    }
  }
}
