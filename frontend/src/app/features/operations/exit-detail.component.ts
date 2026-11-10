import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { ExitRequest, OperationsDemoService } from './operations-demo.service';
import {
  OperationsReviewDialogComponent,
  ReviewDialogData,
  ReviewDialogResult,
} from './review-dialog.component';

import { ExitDetailLocalComponent } from './exit-detail-local.component';
@Component({
  standalone: true,
  selector: 'app-exit-detail',
  imports: [ExitDetailLocalComponent, CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!session.active()) {
      <app-exit-detail-local />
    } @else {
      <main class="page op-page op-exit-page">
        @if (item(); as exit) {
          @if (session.hasRole('residente') && exit.residentId !== service.residentId) {
            <section class="op-empty" role="alert">
              <h1>Acesso restrito</h1>
              <p>Você só pode consultar suas solicitações.</p>
              <a class="btn op-primary" routerLink="/saidas">Voltar às saídas</a>
            </section>
          } @else {
            <header class="op-heading op-exit-heading">
              <a routerLink="/saidas" class="op-back">← Saídas</a>
              <div class="op-exit-title-row">
                <h1>Solicitação {{ exit.id }}</h1>
                <span
                  class="op-status"
                  [class.op-status-warn]="!exit.signed && exit.kind === 'Longa'"
                  >{{ exit.status }}</span
                >
              </div>
              <p>{{ exit.resident }} · Quarto {{ exit.room }}</p>
            </header>
            @if (saved()) {
              <p class="op-success" role="status">Solicitação salva na demonstração.</p>
            }
            <div class="op-exit-grid">
              <section
                class="panel op-panel op-exit-overview"
                aria-labelledby="exit-overview-title"
              >
                <h2 id="exit-overview-title">Dados da solicitação</h2>
                <dl class="op-definition">
                  <div>
                    <dt>Tipo</dt>
                    <dd>{{ exit.kind }}</dd>
                  </div>
                  <div>
                    <dt>Saída</dt>
                    <dd>{{ exit.departure | date: 'dd/MM/yyyy, HH:mm' }}</dd>
                  </div>
                  <div>
                    <dt>{{ exit.kind === 'Curta' ? 'Retorno previsto' : 'Fim do período' }}</dt>
                    <dd>{{ exit.expectedReturn | date: 'dd/MM/yyyy, HH:mm' }}</dd>
                  </div>
                  <div>
                    <dt>Motivo</dt>
                    <dd>{{ exit.reason }}</dd>
                  </div>
                  <div>
                    <dt>Observações</dt>
                    <dd>{{ exit.notes || 'Nenhuma' }}</dd>
                  </div>
                  <div>
                    <dt>Autorização</dt>
                    <dd>
                      {{
                        exit.kind === 'Curta'
                          ? 'Não se aplica'
                          : exit.signed
                            ? 'Simulada e conferida'
                            : 'Pendente'
                      }}
                    </dd>
                  </div>
                  @if (exit.guardian) {
                    <div>
                      <dt>Responsável</dt>
                      <dd>{{ exit.guardian }}</dd>
                    </div>
                  }
                </dl>
              </section>

              <section
                class="panel op-panel op-exit-timeline"
                aria-labelledby="exit-timeline-title"
              >
                <h2 id="exit-timeline-title">Linha do tempo</h2>
                <ol class="op-timeline">
                  @for (event of exit.timeline; track $index) {
                    <li>
                      <strong>{{ event.label }}</strong
                      ><time>{{ event.at | date: 'dd/MM/yyyy, HH:mm' }}</time>
                      @if (event.detail) {
                        <p>{{ event.detail }}</p>
                      }
                    </li>
                  }
                </ol>
                @if (exit.kind === 'Longa' && !exit.signed) {
                  <p class="op-timeline-next">
                    Próxima etapa:
                    {{
                      exit.fileReceived ? 'conferência do supervisor' : 'arquivo do responsável'
                    }}.
                  </p>
                }
                @if (exit.kind === 'Curta' && exit.status === 'Aprovada') {
                  <p class="op-timeline-next">
                    O evento que inicia a saída ainda depende de definição da AE. O protótipo
                    apresenta um caso em andamento na listagem para testar o retorno.
                  </p>
                }
              </section>

              <div class="op-exit-side">
                @if (exit.kind === 'Longa' && !exit.signed) {
                  <section class="op-alert-panel" role="status">
                    <span class="material-symbols-outlined" aria-hidden="true"
                      >pending_actions</span
                    >
                    <div>
                      <h2>Autorização pendente</h2>
                      <p>
                        {{
                          exit.messageState === 'Falha no envio'
                            ? 'O envio simulado falhou. Registre a providência e solicite novo envio.'
                            : exit.fileReceived
                              ? 'Arquivo simulado recebido. O recebimento não autoriza a saída: falta a conferência do supervisor.'
                              : exit.messageState === 'Enviada'
                                ? 'O envio simulado do documento foi registrado. Aguarde o arquivo do responsável; a aprovação permanece bloqueada.'
                                : 'O envio demonstrativo ainda não foi concluído. A aprovação permanece bloqueada.'
                        }}
                      </p>
                    </div>
                  </section>
                }
                @if (
                  isPast(exit) &&
                  ['Aguardando análise', 'Aguardando autorização', 'Falha no envio'].includes(
                    exit.status
                  )
                ) {
                  <p class="op-warning" role="alert">
                    O horário de saída já passou. O procedimento para registrar expiração ou
                    cancelamento depende da AE.
                  </p>
                }

                @if (session.hasRole('residente')) {
                  @if (editable(exit)) {
                    <div class="op-actions">
                      <a class="btn op-primary" [routerLink]="['/saidas', exit.id, 'editar']"
                        ><span class="material-symbols-outlined" aria-hidden="true">edit</span>
                        Editar solicitação pendente</a
                      >
                    </div>
                  }
                  @if (exit.kind === 'Longa' && !exit.signed) {
                    <p class="op-help">
                      O responsável devolve o documento autorizado e um supervisor confere o
                      arquivo; o residente não autoriza a própria saída.
                    </p>
                  }
                } @else if (session.hasRole('supervisor')) {
                  <section
                    class="panel op-panel op-exit-actions"
                    aria-labelledby="exit-actions-title"
                  >
                    <h2 id="exit-actions-title">Ações do supervisor</h2>
                    @if (
                      ['Aguardando análise', 'Aguardando autorização', 'Falha no envio'].includes(
                        exit.status
                      )
                    ) {
                      @if (
                        exit.kind === 'Longa' && !exit.signed && exit.messageState === 'Enviada'
                      ) {
                        <div class="op-actions">
                          @if (exit.fileReceived) {
                            <button
                              class="btn op-primary"
                              type="button"
                              (click)="confirmAuthorization(exit)"
                            >
                              Conferir autorização
                            </button>
                          } @else {
                            <button
                              class="btn op-secondary"
                              type="button"
                              (click)="simulateFile(exit)"
                            >
                              Simular arquivo recebido
                            </button>
                          }
                        </div>
                      }
                      <div class="op-actions">
                        <button
                          class="btn op-primary"
                          type="button"
                          [disabled]="exit.kind === 'Longa' && !exit.signed"
                          (click)="decide(exit, 'approve')"
                        >
                          <span class="material-symbols-outlined" aria-hidden="true"
                            >check_circle</span
                          >
                          Aprovar
                        </button>
                        <button
                          class="btn op-secondary"
                          type="button"
                          [disabled]="exit.kind === 'Longa' && !exit.signed"
                          (click)="decide(exit, 'reject')"
                        >
                          Rejeitar
                        </button>
                        @if (
                          exit.kind === 'Longa' &&
                          !exit.signed &&
                          exit.messageState === 'Falha no envio'
                        ) {
                          <button class="btn op-secondary" type="button" (click)="resend(exit)">
                            Registrar providência e reenviar
                          </button>
                        }
                      </div>
                      @if (
                        exit.kind === 'Longa' &&
                        !exit.signed &&
                        exit.messageState === 'Enviada' &&
                        !exit.fileReceived
                      ) {
                        <p class="op-help">
                          Aguarde o arquivo do responsável. Nenhuma ação de reenvio é necessária
                          neste momento.
                        </p>
                      }
                      @if (exit.kind === 'Longa' && !exit.signed) {
                        <p class="op-help">
                          Aprovação indisponível até a conferência simulada. Rejeição antes da
                          conferência depende de decisão da AE.
                        </p>
                      }
                    } @else if (exit.kind === 'Curta' && exit.status === 'Em andamento') {
                      <p>Identifique o residente presencialmente antes de registrar o retorno.</p>
                      <button class="btn op-primary" type="button" (click)="reviewReturn(exit)">
                        <span class="material-symbols-outlined" aria-hidden="true">how_to_reg</span>
                        Confirmar retorno presencial
                      </button>
                    } @else {
                      <p class="op-help">Nenhuma ação pendente para esta solicitação.</p>
                    }
                    @if (error()) {
                      <p class="op-error" role="alert">{{ error() }}</p>
                    }
                    @if (success()) {
                      <p class="op-success" role="status">{{ success() }}</p>
                    }
                  </section>
                }
              </div>
            </div>
          }
        } @else {
          <section class="op-empty" role="alert">
            <h1>Solicitação não encontrada</h1>
            <p>Confira o identificador ou retorne à lista.</p>
            <a class="btn op-primary" routerLink="/saidas">Voltar às saídas</a>
          </section>
        }
      </main>
    }
  `,
})
export class ExitDetailComponent {
  readonly service = inject(OperationsDemoService);
  readonly session = inject(DemoSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly item = computed(() => this.service.getExit(this.id));
  readonly saved = signal(this.route.snapshot.queryParamMap.get('saved') === '1');
  readonly error = signal('');
  readonly success = signal('');

  editable(item: ExitRequest): boolean {
    return (
      item.residentId === this.service.residentId &&
      ['Aguardando análise', 'Aguardando autorização', 'Falha no envio'].includes(item.status)
    );
  }
  isPast(item: ExitRequest): boolean {
    return Date.parse(item.departure) < Date.now();
  }

  private review(
    data: ReviewDialogData,
    onConfirm: (result: ReviewDialogResult) => boolean,
    success: string,
  ): void {
    this.error.set('');
    this.success.set('');
    this.dialog
      .open<OperationsReviewDialogComponent, ReviewDialogData, ReviewDialogResult>(
        OperationsReviewDialogComponent,
        {
          data,
          width: '620px',
          autoFocus: 'first-tabbable',
          restoreFocus: true,
        },
      )
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        if (onConfirm(result)) this.success.set(success);
        else this.error.set('A ação não pôde ser registrada. Revise a situação da solicitação.');
      });
  }

  private summary(item: ExitRequest): { label: string; value: string }[] {
    return [
      { label: 'Residente', value: item.resident },
      { label: 'Tipo', value: item.kind },
      { label: 'Saída', value: new Date(item.departure).toLocaleString('pt-BR') },
      { label: 'Retorno/período', value: new Date(item.expectedReturn).toLocaleString('pt-BR') },
      { label: 'Motivo', value: item.reason },
      { label: 'Responsável', value: item.guardian ?? 'Não se aplica' },
    ];
  }
  decide(item: ExitRequest, decision: 'approve' | 'reject'): void {
    if (!this.session.hasRole('supervisor')) return;
    this.review(
      {
        title: decision === 'approve' ? 'Revisar aprovação' : 'Revisar rejeição',
        action: decision === 'approve' ? 'Confirmar aprovação' : 'Confirmar rejeição',
        mode: decision === 'reject' ? 'reason' : 'simple',
        lines: this.summary(item),
      },
      (result) => this.service.decideExit(item.id, decision, result.reason),
      decision === 'approve' ? 'Aprovação simulada registrada.' : 'Rejeição simulada registrada.',
    );
  }
  simulateFile(item: ExitRequest): void {
    if (!this.session.hasRole('supervisor')) return;
    this.error.set('');
    this.success.set('');
    if (this.service.simulateReceivedFile(item.id))
      this.success.set('Arquivo simulado recebido. Nenhuma mensagem real foi enviada.');
    else this.error.set('A ação não pôde ser registrada. Revise a situação da solicitação.');
  }
  confirmAuthorization(item: ExitRequest): void {
    if (!this.session.hasRole('supervisor')) return;
    this.review(
      {
        title: 'Conferir autorização recebida',
        action: 'Confirmar conferência',
        mode: 'simple',
        warning:
          'Ao confirmar, você declara ter conferido responsável, documento e revisão. Simulação sem validade jurídica.',
        lines: this.summary(item),
      },
      () => this.service.confirmAuthorization(item.id),
      'Autorização conferida na demonstração. A aprovação continua sendo uma decisão separada.',
    );
  }
  resend(item: ExitRequest): void {
    if (!this.session.hasRole('supervisor')) return;
    this.review(
      {
        title: 'Revisar reenvio',
        action: 'Confirmar reenvio simulado',
        mode: 'reason',
        warning: 'Descreva a providência tomada. A política real de tentativas depende da AE/TI.',
        lines: this.summary(item),
      },
      (result) => this.service.resendLongExit(item.id, result.reason),
      'Reenvio simulado registrado na linha do tempo.',
    );
  }
  reviewReturn(item: ExitRequest): void {
    if (!this.session.hasRole('supervisor')) return;
    this.review(
      {
        title: 'Revisar retorno presencial',
        action: 'Confirmar retorno',
        mode: 'return',
        expectedReturn: item.expectedReturn,
        lines: [
          ...this.summary(item),
          { label: 'Supervisor', value: 'Perfil supervisor de demonstração' },
        ],
      },
      (result) => this.service.confirmReturn(item.id, result.actualReturn ?? '', result.reason),
      'Retorno simulado registrado.',
    );
  }
}
