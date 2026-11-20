import { ERROR_CONFLICT } from '../../core/error-messages';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { autoRefresh } from '../../core/auto-refresh';
import { DemoSessionService } from '../../core/demo-session.service';
import { LocalAuthService } from '../../core/local-auth.service';
import { AutoRefreshStatusComponent, StatusLegendComponent, toneAttr } from '../../shared';
import { LongExitApiService } from './long-exit-api.service';
import { downloadExitDocument } from './long-exit-document.utils';
import {
  AuthorizationBinding,
  AuthorizationFile,
  LongExit,
  ReceivedFile,
} from './long-exit.models';
import {
  documentShortCode,
  documentStateLabels,
  longExitStatusLabels,
  messageStatusLabels,
  sendFailureText,
  signatureStatusLabels,
} from './long-exit.utils';
import {
  OperationsApiError,
  freezesActions,
  operationsError,
} from './operations-local-api.service';
import {
  approvalNote,
  departureMinimum,
  departureStepText,
  exitEventLabels,
  exitStatusLabel,
  formatOperationsTime,
  leavesNow,
  residentDepartureText,
  shownExitStatusLabels,
} from './operations-local.utils';
import {
  LocalOperationsReviewDialogComponent,
  LocalReviewData,
  LocalReviewResult,
} from './review-dialog-local.component';

// These conflicts name their own cause; "the record changed" would send the supervisor astray.
const explainedConflicts = new Set([
  'already_linked',
  'authorization_pending',
  'document_unavailable',
  'guardian_not_eligible',
  'not_eligible',
  'resend_cooldown',
  'resend_limit',
  'signature_already_valid',
  'signature_required',
  'stale_document',
]);
const exitError = (error: unknown): string =>
  error instanceof OperationsApiError && explainedConflicts.has(error.code ?? '')
    ? error.message
    : operationsError(error);

type LongExitStep = 'Autorização do responsável' | 'Decisão' | 'Saída' | 'Volta';

@Component({
  standalone: true,
  selector: 'app-long-exit-detail',
  imports: [RouterLink, NgTemplateOutlet, AutoRefreshStatusComponent, StatusLegendComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page op-exit-page">
      <header class="op-heading op-exit-heading">
        <a routerLink="/saidas" [queryParams]="{ tipo: 'longa' }" class="op-back"
          ><span class="back-arrow" aria-hidden="true">←</span>Saídas longas</a
        >
        <div class="op-exit-title-row">
          <h1>Pedido de saída longa</h1>
          @if (item(); as exit) {
            <span class="status" [attr.data-tone]="tone(statusLabel(exit))">{{
              statusLabel(exit)
            }}</span>
          }
        </div>
        @if (item(); as exit) {
          <p>{{ exit.residentName }} · Matrícula {{ exit.enrollment }}</p>
        }
      </header>
      <sager-auto-refresh-status [refresh]="refresh" />
      @if (session.active()) {
        <section class="op-empty" role="status">
          <h2>Esta tela não faz parte da demonstração</h2>
          <p>Na demonstração, use as solicitações demonstrativas da lista de saídas.</p>
          <a class="btn op-primary" routerLink="/saidas">Abrir demonstração de saídas</a>
        </section>
      } @else if (loading()) {
        <section class="op-state" role="status">
          <h2>Carregando pedido</h2>
          <p>Aguarde um momento.</p>
        </section>
      } @else if (loadError()) {
        <section class="op-state" role="alert">
          <h2>Não foi possível abrir o pedido</h2>
          <p>{{ loadError() }}</p>
          <button class="btn op-secondary" type="button" (click)="load()">Tentar novamente</button>
        </section>
      } @else if (item(); as exit) {
        <sager-status-legend [names]="legendNames" />
        @if (saved()) {
          <p class="op-success" role="status">Pedido salvo.</p>
        }
        @if (exit.deadlineAt) {
          <p class="op-help">
            {{
              exit.status === 'AGUARDANDO_ANALISE'
                ? 'Prazo para análise'
                : 'Prazo para iniciar a saída'
            }}: {{ formatTime(exit.deadlineAt) }}. Depois, o pedido perde a validade.
          </p>
        }
        <div class="op-exit-grid op-step-grid">
          <section class="panel op-panel" aria-labelledby="long-exit-overview">
            <h2 id="long-exit-overview">Dados do pedido</h2>
            <dl class="op-definition">
              <div>
                <dt>Quando</dt>
                <dd>
                  {{ exit.departureMode === 'NOW' ? 'Assim que liberar' : 'Saída agendada' }}
                </dd>
              </div>
              <div>
                <dt>Saída pedida</dt>
                <dd>{{ formatTime(exit.requestedDepartureAt) }}</dd>
              </div>
              <div>
                <dt>Retorno previsto</dt>
                <dd>{{ formatTime(exit.expectedReturnAt) }}</dd>
              </div>
              <div>
                <dt>Motivo</dt>
                <dd>{{ exit.reason }}</dd>
              </div>
              @if (exit.notes) {
                <div>
                  <dt>Observações</dt>
                  <dd>{{ exit.notes }}</dd>
                </div>
              }
              <div>
                <dt>Responsável indicado</dt>
                <dd>{{ exit.guardianName }} · {{ exit.guardianRelationship }}</dd>
              </div>
              @if (exit.decision) {
                <div>
                  <dt>Decisão do supervisor</dt>
                  <dd>
                    {{ exit.decision === 'APPROVE' ? 'Aprovada' : 'Rejeitada' }} ·
                    {{ formatTime(exit.decidedAt) }}
                  </dd>
                </div>
                @if (exit.decisionComment) {
                  <div>
                    <dt>Justificativa da decisão</dt>
                    <dd>{{ exit.decisionComment }}</dd>
                  </div>
                }
              }
              @if (exit.actualDepartureAt) {
                <div>
                  <dt>Saiu em</dt>
                  <dd>
                    {{ formatTime(exit.actualDepartureAt)
                    }}<small>Registrada em {{ formatTime(exit.departureRecordedAt) }}</small>
                  </dd>
                </div>
              }
              @if (exit.actualReturnAt) {
                <div>
                  <dt>Voltou em</dt>
                  <dd>
                    {{ formatTime(exit.actualReturnAt)
                    }}<small>Registrado em {{ formatTime(exit.returnRecordedAt) }}</small>
                  </dd>
                </div>
              }
              @if (exit.lateObservation) {
                <div>
                  <dt>Observação do atraso</dt>
                  <dd>{{ exit.lateObservation }}</dd>
                </div>
              }
              @if (exit.cancellationReason) {
                <div>
                  <dt>Motivo do cancelamento</dt>
                  <dd>{{ exit.cancellationReason }}</dd>
                </div>
              }
              @if (exit.expiryReason) {
                <div>
                  <dt>Expiração</dt>
                  <dd>O prazo terminou antes da resposta ou da saída.</dd>
                </div>
              }
            </dl>
          </section>
          @if (session.hasRole('supervisor')) {
            <section class="panel op-panel op-exit-actions" aria-labelledby="exit-step">
              @if (step(); as current) {
                <p class="step-count">
                  Passo {{ steps.indexOf(current) + 1 }} de {{ steps.length }}
                </p>
              }
              <h2 id="exit-step" tabindex="-1">{{ step() ?? 'Próximo passo' }}</h2>
              @switch (step()) {
                @case ('Autorização do responsável') {
                  @if (exit.deliveryUnconfirmed) {
                    <p class="op-warning">
                      O documento segue sem confirmação de entrega após 15 minutos. Fale com o
                      responsável por outro canal e anexe aqui o arquivo recebido.
                    </p>
                  }
                  @if (!exit.whatsappAvailable && exit.capabilities.canAttachAuthorization) {
                    <p class="op-warning">
                      O WhatsApp está indisponível. Fale com o responsável por outro canal e anexe
                      aqui o arquivo recebido.
                    </p>
                  }
                  @if (exit.signatureStatus === 'UNCERTAIN' || exit.messageStatus === 'UNCERTAIN') {
                    <p class="op-warning">
                      O envio ainda está sem confirmação. Confira no celular antes de reenviar.
                    </p>
                  } @else if (sendFailure(exit); as reason) {
                    <p class="op-warning">{{ reason }}</p>
                  }
                  @if (exit.whatsappAvailable) {
                    <a
                      class="op-inline-link"
                      routerLink="/conversas"
                      [queryParams]="{ q: exit.guardianName }"
                      >Abrir conversa com o responsável
                      <span class="material-symbols-outlined" aria-hidden="true">forum</span></a
                    >
                  }
                  @if (candidates().length) {
                    <ul class="long-files">
                      @for (file of candidates(); track file.id) {
                        <ng-container *ngTemplateOutlet="fileItem; context: { $implicit: file }" />
                      }
                    </ul>
                  } @else {
                    @if (exit.whatsappAvailable) {
                      <p>Aguardando o responsável enviar pelo WhatsApp.</p>
                    }
                    <details class="more-details">
                      <summary>Outras opções</summary>
                      <button
                        class="btn op-secondary"
                        type="button"
                        [disabled]="locked() || !exit.capabilities.canResend"
                        (click)="resend()"
                      >
                        Reenviar documento
                      </button>
                      <p class="op-help">
                        Você ainda pode reenviar
                        {{
                          exit.remainingResends === 1 ? '1 vez' : exit.remainingResends + ' vezes'
                        }}
                        em 24 horas.
                        @if (exit.resendAvailableAt) {
                          Próximo reenvio possível:
                          {{ formatTime(exit.resendAvailableAt) }}.
                        }
                      </p>
                    </details>
                  }
                  @if (exit.capabilities.canAttachAuthorization) {
                    <label class="field"
                      >Anexar arquivo<input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                        aria-describedby="long-exit-attach-hint"
                        [disabled]="locked()"
                        (change)="attach($event)"
                    /></label>
                    <p class="op-help" id="long-exit-attach-hint">Foto ou PDF, até 10 MB.</p>
                  }
                  <div class="op-actions">
                    <button
                      class="btn-danger"
                      type="button"
                      [disabled]="locked() || !exit.capabilities.canReject"
                      (click)="decide('REJECT')"
                    >
                      Rejeitar
                    </button>
                  </div>
                }
                @case ('Decisão') {
                  @if (conference(exit); as binding) {
                    <p>
                      Autorização conferida em {{ formatTime(binding.verifiedAt) }} por
                      {{ binding.verifiedByName ?? 'Supervisor' }}.
                    </p>
                  } @else {
                    <p>Autorização conferida.</p>
                  }
                  <div class="op-actions">
                    <button
                      class="btn op-primary"
                      type="button"
                      [disabled]="locked() || !exit.capabilities.canApprove"
                      (click)="decide('APPROVE')"
                    >
                      Aprovar saída</button
                    ><button
                      class="btn-danger"
                      type="button"
                      [disabled]="locked() || !exit.capabilities.canReject"
                      (click)="decide('REJECT')"
                    >
                      Rejeitar
                    </button>
                  </div>
                  @if (!exit.capabilities.canApprove) {
                    <p class="op-help">Para aprovar, os documentos precisam estar disponíveis.</p>
                  }
                }
                @case ('Saída') {
                  @if (leavesNow(exit)) {
                    <p>{{ departureStepText }}</p>
                  } @else {
                    <p>Saída marcada para {{ formatTime(exit.requestedDepartureAt) }}.</p>
                  }
                  @if (exit.capabilities.canDepart) {
                    <button
                      class="btn op-primary"
                      type="button"
                      [disabled]="locked()"
                      (click)="physical('partida')"
                    >
                      Registrar saída
                    </button>
                  }
                }
                @case ('Volta') {
                  @if (exit.capabilities.canReturn) {
                    <button
                      class="btn op-primary"
                      type="button"
                      [disabled]="locked()"
                      (click)="physical('retorno')"
                    >
                      Registrar volta
                    </button>
                  }
                }
                @default {
                  <p class="op-help">Nenhuma ação disponível para este pedido.</p>
                }
              }
              <ng-container *ngTemplateOutlet="feedback" />
            </section>
          } @else {
            <div class="op-exit-side">
              <ng-container *ngTemplateOutlet="documentPanels" />
              <section class="panel op-panel op-exit-actions" aria-labelledby="exit-step">
                <h2 id="exit-step" tabindex="-1">O que você pode fazer</h2>
                @if (exit.status === 'APROVADA') {
                  @if (leavesNow(exit)) {
                    <p>{{ residentDepartureText }}</p>
                  } @else {
                    <p>Saída marcada para {{ formatTime(exit.requestedDepartureAt) }}.</p>
                  }
                }
                @if (exit.capabilities.canEdit && !adult()) {
                  <a
                    class="btn op-primary"
                    [routerLink]="locked() ? null : ['/saidas/longas', exit.id, 'editar']"
                    [attr.aria-disabled]="locked()"
                    >Mudar pedido</a
                  >
                  <p class="op-help">
                    Se você mudar o pedido, seu responsável precisa autorizar de novo.
                  </p>
                }
                @if (exit.capabilities.canCancel && !adult()) {
                  <div class="op-actions">
                    <button
                      class="btn op-secondary"
                      type="button"
                      [disabled]="locked()"
                      (click)="cancel()"
                    >
                      Cancelar pedido
                    </button>
                  </div>
                }
                <p class="op-help">O supervisor analisa o pedido e registra a saída e a volta.</p>
                <ng-container *ngTemplateOutlet="feedback" />
              </section>
            </div>
          }
        </div>
        <details class="more-details">
          <summary>Mais detalhes</summary>
          <section aria-labelledby="long-exit-history">
            <h2 id="long-exit-history">Histórico</h2>
            @if (!exit.history.length) {
              <p class="op-help">Nada registrado ainda.</p>
            } @else {
              <ol class="op-timeline">
                @for (event of exit.history; track event.id) {
                  <li>
                    <strong>{{ events[event.event] || 'Registro atualizado' }}</strong
                    ><time [attr.datetime]="event.recordedAt">{{
                      formatTime(event.recordedAt)
                    }}</time>
                    <p>
                      {{
                        event.actorProfile === 'residente'
                          ? 'Residente'
                          : event.actorProfile === 'supervisor'
                            ? 'Supervisor'
                            : 'Sistema'
                      }}
                      · {{ labels[event.status] }}
                    </p>
                    @if (event.documentVersionId) {
                      <p>
                        {{
                          event.documentVersionId === exit.currentDocument?.documentVersionId
                            ? 'Documento atual'
                            : 'Documento anterior'
                        }}
                      </p>
                    }
                    @if (event.effectiveAt) {
                      <p>Horário: {{ formatTime(event.effectiveAt) }}</p>
                    }
                    @if (event.justification) {
                      <p>{{ event.justification }}</p>
                    }
                    @if (event.lateObservation) {
                      <p>Atraso: {{ event.lateObservation }}</p>
                    }
                  </li>
                }
              </ol>
            }
          </section>
          @if (session.hasRole('supervisor')) {
            <ng-container *ngTemplateOutlet="documentPanels" />
            @if (otherFiles().length) {
              <section aria-labelledby="long-exit-files">
                <h2 id="long-exit-files">Outros arquivos recebidos</h2>
                <ul class="long-files">
                  @for (file of otherFiles(); track file.id) {
                    <ng-container *ngTemplateOutlet="fileItem; context: { $implicit: file }" />
                  }
                </ul>
              </section>
            }
            @if (exit.capabilities.canAttachAuthorization) {
              @if (unlinkedError()) {
                <p class="op-warning">{{ unlinkedError() }}</p>
              }
              @if (unlinked().length) {
                <section aria-labelledby="long-exit-unlinked">
                  <h2 id="long-exit-unlinked">Arquivos sem vínculo</h2>
                  <p class="op-help">
                    Recebidos desde a criação do pedido, de qualquer número. Vincular não autoriza:
                    o arquivo ainda passa pela conferência.
                  </p>
                  <ul class="long-files">
                    @for (received of unlinked(); track received.messageId) {
                      <li>
                        <strong>{{
                          received.fromGuardian ? 'Telefone do responsável' : 'Outro número'
                        }}</strong>
                        <p>
                          {{ mediaLabel(received.mediaType) }} ·
                          {{ received.senderPhone ?? 'Número não identificado' }}
                        </p>
                        <p>Recebido em {{ formatTime(received.receivedAt) }}</p>
                        @if (received.mediaState === 'FAILED') {
                          <p class="op-warning">
                            O arquivo não pôde ser guardado e não pode ser vinculado.
                          </p>
                        } @else {
                          <div class="op-actions long-document-actions">
                            <button
                              class="btn op-secondary"
                              type="button"
                              [attr.aria-label]="
                                'Vincular a este pedido o arquivo recebido em ' +
                                formatTime(received.receivedAt)
                              "
                              [disabled]="locked()"
                              (click)="linkFile(received)"
                            >
                              Vincular a este pedido
                            </button>
                          </div>
                        }
                      </li>
                    }
                  </ul>
                </section>
              }
            }
            @if (exit.capabilities.canCancel) {
              <div class="op-actions">
                <button
                  class="btn op-secondary"
                  type="button"
                  [disabled]="locked()"
                  (click)="cancel()"
                >
                  Cancelar pedido
                </button>
              </div>
            }
          }
        </details>
      }
    </main>

    <ng-template #feedback>
      @if (busy()) {
        <p role="status">Processando registro…</p>
      }
      @if (downloading()) {
        <p role="status">Carregando documento…</p>
      }
      @if (documentError()) {
        <p class="op-error" role="alert">{{ documentError() }}</p>
      }
      @if (error()) {
        <p class="op-error" role="alert">{{ error() }}</p>
      }
      @if (success()) {
        <p class="op-success" role="status">{{ success() }}</p>
      }
      @if (conflict()) {
        <button class="btn op-secondary" type="button" [disabled]="busy()" (click)="load()">
          Recarregar dados
        </button>
      }
    </ng-template>

    <ng-template #documentPanels>
      @if (item(); as exit) {
        <section class="panel op-panel" aria-labelledby="long-exit-document">
          <h2 id="long-exit-document">Documento enviado</h2>
          <dl class="op-definition">
            <div>
              <dt>Situação do envio</dt>
              <dd>
                <span class="status" [attr.data-tone]="tone(messages[exit.messageStatus])">{{
                  messages[exit.messageStatus]
                }}</span>
              </dd>
            </div>
          </dl>
          @if (exit.currentDocument; as revision) {
            <h3>Documento atual</h3>
            <dl class="op-definition">
              <div>
                <dt>Código impresso no PDF</dt>
                <dd>{{ shortCode(revision.documentVersionId) }}</dd>
              </div>
              <div>
                <dt>Original</dt>
                <dd>{{ documents[revision.originalState] || 'Indisponível' }}</dd>
              </div>
            </dl>
            <div class="op-actions long-document-actions">
              <button
                class="btn op-secondary"
                type="button"
                [disabled]="!exit.capabilities.canDownloadOriginal || downloading()"
                (click)="download('original')"
              >
                <span class="material-symbols-outlined" aria-hidden="true">picture_as_pdf</span>
                Baixar PDF original
              </button>
            </div>
          } @else {
            <p class="op-help">O documento ainda não está disponível.</p>
          }
          @if (exit.bindings.length) {
            <details class="long-bindings">
              <summary>Histórico dos envios ({{ exit.bindings.length }})</summary>
              <ol>
                @for (binding of exit.bindings; track binding.id) {
                  <li>
                    <strong>{{ binding.guardianName }}</strong>
                    <p>{{ signatures[binding.status] }} · {{ messages[binding.messageStatus] }}</p>
                    <p>
                      {{
                        binding.documentVersionId === exit.currentDocument?.documentVersionId
                          ? 'Documento atual'
                          : 'Documento anterior'
                      }}
                      · Criado em {{ formatTime(binding.createdAt) }}
                    </p>
                    @if (binding.revokedAt) {
                      <p>Revogado em {{ formatTime(binding.revokedAt) }}</p>
                    } @else {
                      <p>Prazo: {{ formatTime(binding.expiresAt) }}</p>
                    }
                  </li>
                }
              </ol>
            </details>
          }
        </section>
        <section class="panel op-panel" aria-labelledby="long-exit-authorization">
          <h2 id="long-exit-authorization">Situação da autorização</h2>
          <dl class="op-definition">
            <div>
              <dt>Situação</dt>
              <dd>
                <span class="status" [attr.data-tone]="tone(signatures[exit.signatureStatus])">{{
                  signatures[exit.signatureStatus]
                }}</span>
              </dd>
            </div>
            @if (exit.signedAt) {
              <div>
                <dt>Arquivo recebido em</dt>
                <dd>{{ formatTime(exit.signedAt) }}</dd>
              </div>
            }
            @if (conference(exit); as binding) {
              <div>
                <dt>Conferida em</dt>
                <dd>{{ formatTime(binding.verifiedAt) }}</dd>
              </div>
              @if (session.hasRole('supervisor')) {
                <div>
                  <dt>Conferida por</dt>
                  <dd>{{ binding.verifiedByName ?? 'Supervisor' }}</dd>
                </div>
              }
            }
          </dl>
          @if (exit.signatureStatus === 'VALID') {
            <p class="op-help">
              A conferência registra o arquivo recebido e não é assinatura eletrônica.
            </p>
          } @else if (exit.signatureStatus === 'UNCERTAIN' || exit.messageStatus === 'UNCERTAIN') {
            <p class="op-warning">O envio ainda está sem confirmação. A equipe vai verificar.</p>
          } @else {
            <p class="op-help">
              Documento enviado ou lido não autoriza a saída: falta conferir o arquivo do
              responsável.
            </p>
          }
          @if (exit.currentDocument; as revision) {
            <dl class="op-definition">
              <div>
                <dt>Arquivo conferido</dt>
                <dd>
                  {{
                    revision.signedState === 'MISSING'
                      ? 'Ainda não conferido'
                      : documents[revision.signedState] || 'Ainda não disponível'
                  }}
                </dd>
              </div>
            </dl>
            <div class="op-actions long-document-actions">
              <button
                class="btn op-secondary"
                type="button"
                [disabled]="!exit.capabilities.canDownloadSigned || downloading()"
                (click)="download('assinado')"
              >
                <span class="material-symbols-outlined" aria-hidden="true">download</span>
                Baixar autorização conferida
              </button>
            </div>
          }
        </section>
      }
    </ng-template>

    <ng-template #fileItem let-file>
      @if (item(); as exit) {
        <li>
          <span class="status" [attr.data-tone]="tone(fileState(file))">{{ fileState(file) }}</span>
          <p>
            {{ mediaLabel(file.mediaType) }} ·
            {{
              file.documentVersionId === exit.currentDocument?.documentVersionId
                ? 'Documento atual'
                : 'Documento anterior'
            }}
          </p>
          <p>Recebido em {{ formatTime(file.receivedAt) }}</p>
          <p>{{ originLabel(file) }}</p>
          @if (file.senderDivergent) {
            <p class="op-warning">
              O telefone de origem é diferente do cadastrado para o responsável. A confirmação exige
              justificativa.
            </p>
          }
          @if (file.decidedAt) {
            <p>
              {{ file.state === 'ACCEPTED' ? 'Conferido' : 'Recusado' }} em
              {{ formatTime(file.decidedAt) }}
              @if (file.decidedByName) {
                por {{ file.decidedByName }}
              }
            </p>
          }
          @if (file.decisionReason) {
            <p>{{ file.decisionReason }}</p>
          }
          @if (file.mediaType.startsWith('image/')) {
            @if (brokenPreviews().has(file.id)) {
              <p class="op-help">
                Este navegador não mostra a imagem. Baixe o arquivo para conferir.
              </p>
            } @else {
              <img
                class="long-file-preview"
                [src]="fileUrl(exit, file)"
                [alt]="'Imagem recebida em ' + formatTime(file.receivedAt)"
                (error)="previewFailed(file.id)"
              />
            }
          }
          <div class="op-actions long-document-actions">
            <button
              class="btn op-secondary"
              type="button"
              [attr.aria-label]="'Baixar arquivo recebido em ' + formatTime(file.receivedAt)"
              [disabled]="downloading()"
              (click)="downloadFile(file)"
            >
              <span class="material-symbols-outlined" aria-hidden="true">download</span>
              Baixar arquivo
            </button>
            @if (canDecideFile(exit, file)) {
              <button
                class="btn op-primary"
                type="button"
                [attr.aria-label]="
                  'Confirmar conferência do arquivo recebido em ' + formatTime(file.receivedAt)
                "
                [disabled]="locked()"
                (click)="confirmFile(file)"
              >
                Confirmar conferência</button
              ><button
                class="btn-danger"
                type="button"
                [attr.aria-label]="'Recusar arquivo recebido em ' + formatTime(file.receivedAt)"
                [disabled]="locked()"
                (click)="refuseFile(file)"
              >
                Recusar arquivo
              </button>
            }
          </div>
        </li>
      }
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .op-definition small {
        display: block;
        color: var(--muted);
        font-weight: 400;
        margin-top: 5px;
      }
      .op-exit-actions .long-document-actions,
      .long-document-actions {
        display: flex;
        align-items: stretch;
        flex-direction: column;
      }
      .long-bindings {
        margin-top: 20px;
      }
      .long-bindings summary {
        min-height: 44px;
        display: flex;
        align-items: center;
        cursor: pointer;
        color: var(--green-800);
        text-decoration: underline;
        text-underline-offset: 0.2em;
      }
      .long-bindings ol {
        padding-left: 20px;
      }
      .long-bindings li {
        margin: 16px 0;
        overflow-wrap: anywhere;
      }
      .long-bindings p {
        margin: 6px 0;
      }
      .long-files {
        list-style: none;
        margin: 16px 0;
        padding: 0;
      }
      .long-files li {
        padding: 16px 0;
        border-top: 1px solid var(--line);
        overflow-wrap: anywhere;
      }
      .long-files p:not(.op-warning, .op-help) {
        margin: 6px 0;
      }
      .long-file-preview {
        display: block;
        max-width: 100%;
        max-height: 320px;
        margin-top: 12px;
        border: 1px solid var(--line);
        border-radius: 12px;
      }
    `,
  ],
})
export class LongExitDetailComponent {
  readonly session = inject(DemoSessionService);
  private readonly auth = inject(LocalAuthService);
  /** O adulto só consulta: pedir, mudar e cancelar são do residente menor (RN02). */
  readonly adult = computed(() => this.auth.principal()?.maiorDeIdade === true);
  private readonly api = inject(LongExitApiService);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly route = inject(ActivatedRoute);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly item = signal<LongExit | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly downloading = signal(false);
  readonly documentError = signal('');
  readonly loadError = signal('');
  readonly error = signal('');
  readonly success = signal('');
  readonly conflict = signal(false);
  readonly locked = computed(() => this.busy() || this.conflict());
  readonly unlinked = signal<ReceivedFile[]>([]);
  readonly unlinkedError = signal('');
  readonly brokenPreviews = signal<ReadonlySet<string>>(new Set());
  readonly saved = signal(this.route.snapshot.queryParamMap.get('saved') === '1');
  readonly labels = longExitStatusLabels;
  /** "Atrasada" quando a volta passou do prazo, pelo relógio do servidor (overdue-exit-badge). */
  readonly statusLabel = exitStatusLabel;
  readonly tone = toneAttr;
  readonly signatures = signatureStatusLabels;
  readonly messages = messageStatusLabels;
  readonly documents = documentStateLabels;
  /** Só o próximo passo, pela situação do pedido (simple-screens, design D11). */
  readonly step = computed<LongExitStep | null>(() => {
    const exit = this.item();
    if (exit?.status === 'AGUARDANDO_ANALISE')
      return exit.signatureStatus === 'VALID' ? 'Decisão' : 'Autorização do responsável';
    if (exit?.status === 'APROVADA') return 'Saída';
    return exit?.status === 'EM_ANDAMENTO' ? 'Volta' : null;
  });
  /** O passo "Saída" vale para toda saída aprovada (exit-departure-in-person, D3). */
  readonly steps: LongExitStep[] = ['Autorização do responsável', 'Decisão', 'Saída', 'Volta'];
  readonly leavesNow = leavesNow;
  readonly departureStepText = departureStepText;
  readonly residentDepartureText = residentDepartureText;
  readonly candidates = computed(() => {
    const exit = this.item();
    return exit ? exit.authorizationFiles.filter((file) => this.canDecideFile(exit, file)) : [];
  });
  readonly otherFiles = computed(() => {
    const exit = this.item();
    return exit ? exit.authorizationFiles.filter((file) => !this.canDecideFile(exit, file)) : [];
  });
  readonly events = {
    ...exitEventLabels,
    EDIT: 'Pedido alterado',
    APPROVE: 'Pedido aprovado',
    REJECT: 'Pedido rejeitado',
    CANCEL: 'Pedido cancelado',
    EXPIRE: 'Pedido expirado',
    RESEND: 'Reenvio do documento solicitado',
    GUARDIAN_CHANGED: 'Cadastro do responsável alterado; nova revisão do documento',
    AUTHORIZATION_LINKED: 'Arquivo ligado ao pedido',
    AUTHORIZATION_CONFIRMED: 'Autorização conferida por servidor',
    AUTHORIZATION_REFUSED: 'Arquivo recusado por servidor',
  } as Record<string, string>;
  readonly fileStates: Record<AuthorizationFile['state'], string> = {
    CANDIDATE: 'Aguardando conferência',
    ACCEPTED: 'Autorização conferida por servidor',
    REFUSED: 'Arquivo recusado',
  };
  readonly legendNames = [
    ...new Set([
      ...Object.values(shownExitStatusLabels),
      ...Object.values(signatureStatusLabels),
      ...Object.values(messageStatusLabels),
      ...Object.values(this.fileStates),
    ]),
  ];
  readonly formatTime = formatOperationsTime;
  readonly shortCode = documentShortCode;
  fileState(file: AuthorizationFile): string {
    return this.fileStates[file.state];
  }
  private sequence = 0;
  readonly refresh = autoRefresh(() => this.load(true), {
    busy: () => this.busy() || this.conflict() || this.loading(),
  });
  constructor() {
    if (!this.session.active()) void this.load();
  }
  /** `silent`: atualização automática; mantém mensagens e conflito e lança a falha. */
  async load(silent = false): Promise<void> {
    if (this.session.active() || (!silent && this.busy())) return;
    const sequence = ++this.sequence;
    if (!silent) {
      this.loading.set(true);
      this.loadError.set('');
      this.error.set('');
      this.success.set('');
      this.documentError.set('');
      this.conflict.set(false);
      this.item.set(null);
    }
    try {
      const exit = await this.api.get(this.id);
      if (sequence !== this.sequence) return;
      this.item.set(exit);
      this.loadError.set('');
      void this.loadUnlinked(exit);
    } catch (error) {
      if (sequence !== this.sequence) return;
      if (silent) throw error;
      this.loadError.set(operationsError(error));
    } finally {
      if (sequence === this.sequence) this.loading.set(false);
    }
  }
  private async loadUnlinked(exit: LongExit): Promise<void> {
    if (!exit.capabilities.canAttachAuthorization) return this.unlinked.set([]);
    try {
      this.unlinked.set(await this.api.unlinkedFiles(exit.id));
      this.unlinkedError.set('');
    } catch (error) {
      this.unlinkedError.set(operationsError(error));
    }
  }
  conference(exit: LongExit): AuthorizationBinding | undefined {
    return exit.bindings.find(
      (binding) =>
        binding.verifiedAt && binding.documentVersionId === exit.currentDocument?.documentVersionId,
    );
  }
  sendFailure(exit: LongExit): string {
    const code = exit.bindings.find(
      (binding) =>
        !binding.revokedAt && binding.documentVersionId === exit.currentDocument?.documentVersionId,
    )?.failureCode;
    return code ? sendFailureText(code, exit.messageStatus) : '';
  }
  canDecideFile(exit: LongExit, file: AuthorizationFile): boolean {
    return (
      exit.capabilities.canAttachAuthorization &&
      file.state === 'CANDIDATE' &&
      file.documentVersionId === exit.currentDocument?.documentVersionId &&
      !exit.bindings.find((binding) => binding.id === file.bindingId)?.revokedAt
    );
  }
  mediaLabel(mediaType: string | null): string {
    if (mediaType?.startsWith('image/')) return 'Imagem';
    return mediaType === 'application/pdf' ? 'PDF' : 'Arquivo';
  }
  originLabel(file: AuthorizationFile): string {
    return file.origin === 'MANUAL'
      ? 'Anexado por supervisor'
      : `WhatsApp · ${file.senderPhone ?? 'Número não identificado'}`;
  }
  fileUrl(exit: LongExit, file: AuthorizationFile): string {
    return this.api.authorizationFileUrl(exit.id, file.id);
  }
  previewFailed(fileId: string): void {
    this.brokenPreviews.update((broken) => new Set(broken).add(fileId));
  }
  confirmFile(file: AuthorizationFile): void {
    const exit = this.item();
    const revision = exit?.currentDocument;
    if (!exit || !revision || !this.canDecideFile(exit, file) || this.busy() || this.conflict())
      return;
    const code = documentShortCode(revision.documentVersionId);
    this.review(
      {
        title: 'Conferir autorização recebida',
        action: 'Confirmar conferência',
        warning: file.senderDivergent
          ? 'O telefone de origem é diferente do cadastrado para o responsável. Justifique por que o arquivo é aceito.'
          : undefined,
        lines: [
          { label: 'Residente', value: exit.residentName },
          { label: 'Responsável indicado', value: exit.guardianName },
          { label: 'Código do documento', value: code },
          { label: 'Arquivo', value: this.mediaLabel(file.mediaType) },
          { label: 'Origem', value: this.originLabel(file) },
          { label: 'Recebido em', value: formatOperationsTime(file.receivedAt) },
        ],
        requireReason: file.senderDivergent,
        requireConfirmation: true,
        confirmationLabel: `Declaro que conferi o responsável e o documento com o código ${code}.`,
      },
      (result) => this.api.confirmAuthorization(exit, file.id, result.reason),
      'Autorização conferida. A aprovação continua sendo uma decisão separada.',
    );
  }
  refuseFile(file: AuthorizationFile): void {
    const exit = this.item();
    if (!exit || !this.canDecideFile(exit, file) || this.busy() || this.conflict()) return;
    this.review(
      {
        title: 'O arquivo será recusado e o pedido continua aguardando autorização.',
        action: 'Confirmar recusa',
        danger: true,
        lines: [
          { label: 'Arquivo', value: this.mediaLabel(file.mediaType) },
          { label: 'Origem', value: this.originLabel(file) },
          { label: 'Recebido em', value: formatOperationsTime(file.receivedAt) },
        ],
        requireReason: true,
      },
      (result) => this.api.refuseAuthorization(exit, file.id, result.reason),
      'Arquivo recusado. Um novo arquivo pode ser recebido ou anexado.',
    );
  }
  linkFile(received: ReceivedFile): void {
    const exit = this.item();
    if (!exit?.capabilities.canAttachAuthorization || this.busy() || this.conflict()) return;
    this.review(
      {
        title: 'Vincular arquivo a este pedido',
        action: 'Confirmar vínculo',
        warning: received.fromGuardian
          ? undefined
          : 'Este arquivo veio de um número diferente do responsável indicado.',
        lines: [
          ...this.summary(exit),
          { label: 'Arquivo', value: this.mediaLabel(received.mediaType) },
          { label: 'Telefone de origem', value: received.senderPhone ?? 'Não identificado' },
          { label: 'Recebido em', value: formatOperationsTime(received.receivedAt) },
        ],
      },
      () => this.api.linkAuthorization(exit, received.messageId),
      'Arquivo vinculado. Ele ainda precisa de conferência.',
    );
  }
  attach(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const exit = this.item();
    if (!file || !exit?.capabilities.canAttachAuthorization || this.busy() || this.conflict())
      return;
    if (file.size > 10 * 1024 * 1024) {
      this.success.set('');
      this.error.set('O arquivo tem mais de 10 MB. Envie um arquivo menor.');
      return;
    }
    void this.mutate(
      () => this.api.attachAuthorization(exit, file),
      'Arquivo anexado. Ele ainda precisa de conferência.',
    );
  }
  async downloadFile(file: AuthorizationFile): Promise<void> {
    const exit = this.item();
    if (!exit || this.downloading()) return;
    this.downloading.set(true);
    this.documentError.set('');
    try {
      const blob = await this.api.authorizationFile(exit.id, file.id);
      downloadExitDocument(blob, file.id, 'autorizacao-recebida');
    } catch (error) {
      this.documentError.set(exitError(error));
    } finally {
      this.downloading.set(false);
    }
  }
  decide(decision: 'APPROVE' | 'REJECT'): void {
    const exit = this.item();
    if (
      !exit ||
      !this.session.hasRole('supervisor') ||
      !(decision === 'APPROVE' ? exit.capabilities.canApprove : exit.capabilities.canReject) ||
      this.busy() ||
      this.conflict()
    )
      return;
    const approve = decision === 'APPROVE';
    this.review(
      {
        title: approve ? 'A saída longa será aprovada.' : 'O pedido será rejeitado.',
        action: approve ? 'Confirmar aprovação' : 'Confirmar rejeição',
        note: approve ? approvalNote : undefined,
        lines: this.summary(exit),
        requireReason: !approve,
        comment: approve,
        danger: !approve,
      },
      (result) => this.api.decide(exit, decision, result.reason),
      approve ? 'Aprovação registrada.' : 'Rejeição registrada.',
    );
  }
  cancel(): void {
    const exit = this.item();
    if (
      !exit ||
      !this.session.hasRole('supervisor', 'residente') ||
      !exit.capabilities.canCancel ||
      this.busy() ||
      this.conflict()
    )
      return;
    this.review(
      {
        title: 'O pedido será cancelado e a autorização deixa de valer.',
        action: 'Cancelar pedido',
        lines: this.summary(exit),
        requireReason: true,
        danger: true,
      },
      (result) => this.api.cancel(exit, result.reason),
      'Pedido cancelado.',
    );
  }
  resend(): void {
    const exit = this.item();
    if (
      !exit ||
      !this.session.hasRole('supervisor') ||
      !exit.capabilities.canResend ||
      this.busy() ||
      this.conflict()
    )
      return;
    this.review(
      {
        title: 'O documento será enviado de novo ao responsável.',
        action: 'Confirmar reenvio',
        warning: 'O novo envio substitui o anterior. Escreva a providência tomada.',
        lines: [
          ...this.summary(exit),
          { label: 'Reenvios restantes', value: String(exit.remainingResends) },
        ],
        requireReason: true,
      },
      (result) => this.api.resend(exit, result.reason),
      'Reenvio solicitado. Confira a situação do envio após o processamento.',
    );
  }
  async physical(action: 'partida' | 'retorno'): Promise<void> {
    const exit = this.item();
    if (
      !exit ||
      !this.session.hasRole('supervisor') ||
      !(action === 'partida' ? exit.capabilities.canDepart : exit.capabilities.canReturn) ||
      this.busy() ||
      this.conflict()
    )
      return;
    this.busy.set(true);
    this.error.set('');
    try {
      const fresh = await this.api.get(exit.id);
      if (
        fresh.version !== exit.version ||
        fresh.currentDocument?.documentVersionId !== exit.currentDocument?.documentVersionId ||
        !(action === 'partida' ? fresh.capabilities.canDepart : fresh.capabilities.canReturn)
      ) {
        this.conflict.set(true);
        this.error.set(ERROR_CONFLICT);
        return;
      }
      this.review(
        {
          title: action === 'partida' ? 'A saída será registrada.' : 'A volta será registrada.',
          action: action === 'partida' ? 'Confirmar saída' : 'Confirmar volta',
          warning:
            action === 'partida'
              ? 'Veja o residente pessoalmente antes de liberar a saída.'
              : 'Veja o residente pessoalmente antes de confirmar a volta.',
          lines: this.summary(exit),
          physical: {
            action,
            now: fresh.now,
            minimum: action === 'partida' ? departureMinimum(exit) : exit.actualDepartureAt!,
            expectedReturnAt: exit.expectedReturnAt,
            version: exit.version,
          },
        },
        (result) => this.api.physical(exit.id, action, result.physical!),
        action === 'partida' ? 'Saída registrada.' : 'Volta registrada.',
      );
    } catch (error) {
      this.error.set(operationsError(error));
    } finally {
      this.busy.set(false);
    }
  }
  async download(kind: 'original' | 'assinado'): Promise<void> {
    const exit = this.item();
    const document = exit?.currentDocument;
    if (
      !exit ||
      !document ||
      this.downloading() ||
      !(kind === 'original'
        ? exit.capabilities.canDownloadOriginal
        : exit.capabilities.canDownloadSigned)
    )
      return;
    this.downloading.set(true);
    this.documentError.set('');
    try {
      const blob = await this.api.document(exit.id, document.documentVersionId, kind);
      downloadExitDocument(
        blob,
        document.documentVersionId,
        kind === 'original' ? 'original' : 'autorizacao',
      );
    } catch (error) {
      this.documentError.set(exitError(error));
    } finally {
      this.downloading.set(false);
    }
  }
  private summary(exit: LongExit): { label: string; value: string }[] {
    return [
      { label: 'Residente', value: exit.residentName },
      { label: 'Responsável indicado', value: exit.guardianName },
      {
        label: 'Documento',
        value: exit.currentDocument ? 'Disponível' : 'Indisponível',
      },
      { label: 'Saída pedida', value: formatOperationsTime(exit.requestedDepartureAt) },
      { label: 'Retorno previsto', value: formatOperationsTime(exit.expectedReturnAt) },
      { label: 'Motivo', value: exit.reason },
    ];
  }
  private review(
    data: LocalReviewData,
    action: (result: LocalReviewResult) => Promise<LongExit>,
    message: string | ((exit: LongExit) => string),
  ): void {
    this.dialog
      .open<LocalOperationsReviewDialogComponent, LocalReviewData, LocalReviewResult>(
        LocalOperationsReviewDialogComponent,
        {
          data,
          width: '620px',
          maxWidth: 'calc(100vw - 32px)',
          autoFocus: 'first-tabbable',
          restoreFocus: true,
        },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) void this.mutate(() => action(result), message);
      });
  }
  private async mutate(
    action: () => Promise<LongExit>,
    message: string | ((exit: LongExit) => string),
  ): Promise<void> {
    if (this.busy() || this.conflict()) return;
    this.busy.set(true);
    this.sequence++; // Descarta a atualização automática que saiu antes da gravação.
    this.error.set('');
    this.success.set('');
    this.saved.set(false);
    const step = this.step();
    try {
      const exit = await action();
      this.item.set(exit);
      this.success.set(typeof message === 'string' ? message : message(exit));
      // Espera a lista sem vínculo: "Vincular a este pedido" só some quando ela volta.
      await this.loadUnlinked(exit);
      // O botão clicado sumiu (com o passo, o arquivo recusado ou o vinculado): o foco vai ao
      // título do passo, e não fica perdido no topo da página.
      afterNextRender(
        () => {
          const active = document.activeElement;
          if (this.step() !== step || !active?.isConnected || active === document.body)
            document.getElementById('exit-step')?.focus();
        },
        { injector: this.injector },
      );
    } catch (error) {
      this.error.set(exitError(error));
      if (freezesActions(error)) this.conflict.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
