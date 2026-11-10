import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { ProgressBarComponent } from '../../shared/progress-bar.component';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { AttendanceMark, OperationsDemoService } from './operations-demo.service';
import { OperationsReviewDialogComponent, ReviewDialogResult } from './review-dialog.component';

import { NightCallLocalComponent } from './night-call-local.component';
@Component({
  standalone: true,
  selector: 'app-night-call',
  imports: [
    SearchableSelectDirective,
    ProgressBarComponent,
    NightCallLocalComponent,
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!session.active()) {
      <app-night-call-local />
    } @else {
      <main class="page op-page">
        @if (session.hasRole('supervisor')) {
          <header class="op-heading">
            <div>
              <a routerLink="/inicio" class="op-back">← Início</a>
              <h1>Chamada noturna</h1>
              <p>Confira cada residente menor de idade e revise o registro antes de confirmar.</p>
            </div>
            <span class="op-demo-label">Dados de demonstração</span>
          </header>
          @if (session.scenario() === 'padrao') {
            <section class="panel op-panel" aria-label="Resumo da chamada">
              <div class="op-call-summary">
                <div>
                  <strong
                    >{{ service.callSummary().marked }} de {{ service.callSummary().total }}</strong
                  ><span>marcações concluídas</span>
                </div>
                <div><strong>22h30</strong><span>horário padrão</span></div>
                <div>
                  <strong>{{ service.callSummary().justified }}</strong
                  ><span>ausências justificadas</span>
                </div>
              </div>
              <sager-progress-bar
                [done]="service.callSummary().marked"
                [total]="service.callSummary().total"
                noun="marcações concluídas"
              />
              @if (service.callCompleted()) {
                <p class="op-success" role="status">
                  <span class="material-symbols-outlined" aria-hidden="true">check_circle</span>
                  Chamada demonstrativa confirmada em
                  {{ service.callCompletedAt() | date: 'dd/MM/yyyy HH:mm' }}.
                  {{ service.callLate() ? 'Registro tardio sinalizado.' : '' }}
                </p>
              } @else {
                <p class="op-help">
                  A chamada real ocorre às 22h30. Horário, tolerância e correções após confirmação
                  dependem da AE.
                </p>
                @if (service.callSummary().justified) {
                  <p class="op-warning">
                    Residentes com saída em andamento já entram como ausência justificada. Confira e
                    corrija se preciso.
                  </p>
                }
                <label class="op-check"
                  ><input type="checkbox" [formControl]="lateScenario" /> Simular registro tardio
                  para revisar o alerta</label
                >
                @if (isLate()) {
                  <p class="op-warning" role="alert">
                    Registro fora do horário padrão: confirme expressamente no resumo antes de
                    salvar.
                  </p>
                }
              }
            </section>
          }

          <section class="op-section" aria-labelledby="call-list-title">
            <div class="op-section-heading">
              <h2 id="call-list-title">Residentes abrangidos</h2>
              <p>Menores de idade · Blocos A e B</p>
            </div>
            @if (session.scenario() === 'padrao') {
              <div class="op-filters">
                <label class="field"
                  >Buscar por nome ou matrícula<input
                    type="search"
                    [formControl]="search"
                    placeholder="Digite nome ou matrícula" /></label
                ><label class="field"
                  >Bloco<select sagerSearchable [formControl]="block">
                    <option value="">Todos</option>
                    <option value="A">Bloco A</option>
                    <option value="B">Bloco B</option>
                  </select></label
                ><label class="field"
                  >Quarto<select sagerSearchable [formControl]="room">
                    <option value="">Todos os quartos</option>
                    @for (option of roomOptions(); track option) {
                      <option [value]="option">{{ option }}</option>
                    }
                  </select></label
                >
              </div>
            }
            @if (session.scenario() === 'carregando') {
              <div class="op-state" role="status" aria-live="polite">
                <span class="material-symbols-outlined" aria-hidden="true">progress_activity</span>
                <h3>Carregando chamada</h3>
                <p>Aguarde enquanto os residentes de demonstração são preparados.</p>
              </div>
            } @else if (session.scenario() === 'erro') {
              <div class="op-state" role="alert">
                <span class="material-symbols-outlined" aria-hidden="true">error</span>
                <h3>Não foi possível carregar a chamada</h3>
                <p>Este é um cenário de erro demonstrativo.</p>
                <button
                  type="button"
                  class="btn op-secondary"
                  (click)="session.setScenario('padrao')"
                >
                  Tentar novamente
                </button>
              </div>
            } @else if (session.scenario() === 'vazio') {
              <div class="op-empty" role="status">
                <h3>Nenhum residente abrangido neste cenário</h3>
                <p>Selecione o cenário padrão no topo para ver os registros sintéticos.</p>
              </div>
            } @else if (filtered().length) {
              <div class="op-list">
                @for (resident of filtered(); track resident.id) {
                  <article class="op-row op-call-row">
                    <div class="op-row-main">
                      <h3>{{ resident.name }}</h3>
                      <p>
                        Matrícula {{ resident.registration }} · Bloco {{ resident.block }} · Quarto
                        {{ resident.room }}
                      </p>
                      @if (resident.approvedAuthorization) {
                        <span class="op-inline-note"
                          >Autorização aprovada no cenário de demonstração</span
                        >
                      }
                      @if (markedBySystem(resident.id); as exit) {
                        <p>
                          Ausência justificada ·
                          <a class="op-exit-link" [routerLink]="['/saidas', exit.id]"
                            >saída {{ exit.kind === 'Longa' ? 'longa' : 'curta'
                            }}<span class="sr-only"> de {{ resident.name }}</span></a
                          >
                          · Sistema
                        </p>
                      }
                    </div>
                    <div
                      class="op-mark-group"
                      role="group"
                      [attr.aria-label]="'Presença de ' + resident.name"
                    >
                      <button
                        type="button"
                        [disabled]="service.callCompleted()"
                        [class.selected]="markFor(resident.id) === 'Presente'"
                        [attr.aria-pressed]="markFor(resident.id) === 'Presente'"
                        (click)="mark(resident.id, 'Presente')"
                      >
                        Presente
                      </button>
                      <button
                        type="button"
                        [disabled]="service.callCompleted()"
                        [class.selected]="markFor(resident.id) === 'Ausente'"
                        [attr.aria-pressed]="markFor(resident.id) === 'Ausente'"
                        (click)="mark(resident.id, 'Ausente')"
                      >
                        Ausente
                      </button>
                      @if (resident.approvedAuthorization) {
                        <button
                          type="button"
                          [disabled]="service.callCompleted()"
                          [class.selected]="markFor(resident.id) === 'Ausência justificada'"
                          [attr.aria-pressed]="markFor(resident.id) === 'Ausência justificada'"
                          (click)="mark(resident.id, 'Ausência justificada')"
                        >
                          Ausência justificada
                        </button>
                      }
                    </div>
                  </article>
                }
              </div>
            } @else {
              <div class="op-empty" role="status">
                <h3>Nenhum residente encontrado</h3>
                <p>Altere a busca, o bloco ou o quarto para ver os demais residentes.</p>
              </div>
            }
          </section>
          @if (!service.callCompleted() && session.scenario() === 'padrao') {
            <div class="op-footer-action">
              <p aria-live="polite">
                {{ service.callSummary().total - service.callSummary().marked }} marcações pendentes
              </p>
              <button type="button" class="btn op-primary" (click)="review()">
                <span class="material-symbols-outlined" aria-hidden="true">fact_check</span> Revisar
                e confirmar chamada
              </button>
            </div>
            @if (error()) {
              <p class="op-error" role="alert">{{ error() }}</p>
            }
          }
        } @else {
          <section class="op-empty" role="alert">
            <h1>Acesso restrito</h1>
            <p>A chamada é registrada pelo supervisor.</p>
            <a class="btn op-primary" routerLink="/inicio">Voltar ao início</a>
          </section>
        }
      </main>
    }
  `,
})
export class NightCallComponent {
  readonly service = inject(OperationsDemoService);
  readonly session = inject(DemoSessionService);
  private readonly dialog = inject(MatDialog);
  readonly search = new FormControl('', { nonNullable: true });
  readonly block = new FormControl('', { nonNullable: true });
  readonly room = new FormControl('', { nonNullable: true });
  private readonly searchValue = toSignal(this.search.valueChanges, { initialValue: '' });
  private readonly blockValue = toSignal(this.block.valueChanges, { initialValue: '' });
  private readonly roomValue = toSignal(this.room.valueChanges, { initialValue: '' });
  readonly lateScenario = new FormControl(false, { nonNullable: true });
  readonly error = signal('');
  readonly filtered = computed(() => {
    const query = this.searchValue().trim().toLocaleLowerCase('pt-BR');
    const block = this.blockValue();
    return this.service.minors.filter(
      (resident) =>
        (!query ||
          `${resident.name} ${resident.registration}`.toLocaleLowerCase('pt-BR').includes(query)) &&
        (!block || resident.block === block) &&
        (!this.roomValue() || resident.room === this.roomValue()),
    );
  });
  readonly roomOptions = computed(() => {
    const block = this.blockValue();
    return [
      ...new Set(
        this.service.minors
          .filter((resident) => !block || resident.block === block)
          .map((resident) => resident.room),
      ),
    ].sort();
  });

  constructor() {
    this.block.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.room.setValue(''));
  }

  markFor(id: string): AttendanceMark | null {
    return this.service.attendance().find((entry) => entry.residentId === id)?.mark ?? null;
  }
  markedBySystem(id: string) {
    const entry = this.service.attendance().find((item) => item.residentId === id);
    if (!entry?.system) return null;
    return (
      this.service
        .exits()
        .find((exit) => exit.residentId === id && exit.status === 'Em andamento') ?? null
    );
  }
  mark(id: string, value: AttendanceMark): void {
    this.error.set('');
    this.service.setAttendanceMark(id, value);
  }
  isLate(): boolean {
    const date = new Date();
    return this.lateScenario.value || date.getHours() * 60 + date.getMinutes() > 22 * 60 + 30;
  }
  review(): void {
    const summary = this.service.callSummary();
    if (summary.marked !== summary.total) {
      this.error.set(
        `Marque os ${summary.total - summary.marked} residentes pendentes antes de confirmar.`,
      );
      return;
    }
    const dialog = this.dialog.open<OperationsReviewDialogComponent, any, ReviewDialogResult>(
      OperationsReviewDialogComponent,
      {
        data: {
          title: 'Revisar chamada',
          action: 'Confirmar chamada',
          mode: 'simple',
          warning: this.isLate()
            ? 'Registro tardio: a indicação ficará preservada na chamada demonstrativa.'
            : undefined,
          lines: [
            { label: 'Residentes', value: String(summary.total) },
            { label: 'Presentes', value: String(summary.present) },
            { label: 'Ausentes', value: String(summary.absent) },
            { label: 'Ausências justificadas', value: String(summary.justified) },
            { label: 'Horário padrão', value: '22h30' },
          ],
        },
        width: '620px',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
      },
    );
    dialog.afterClosed().subscribe((result) => {
      if (result && !this.service.completeCall(this.isLate()))
        this.error.set('Não foi possível confirmar a chamada. Confira as marcações.');
    });
  }
}
