import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { UnsavedFormDirective, UnsavedForms } from '../../shared/unsaved-form';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import {
  AllocationApiError,
  AllocationApiService,
  AllocationRecord,
  allocationErrorMessage,
} from './allocation-api.service';
import { GuardianApiService, GuardianRecord } from './guardian-api.service';
import { HousingMap, RoomRecord } from './housing.models';
import { LegalGuardian } from './management.models';
import { ManagementDemoService } from './management-demo.service';
import { ageFromBirthDate, formattedDate } from './management.utils';
import { ResidentApiError, ResidentApiService, ResidentRecord } from './resident-api.service';
import { RoomApiService } from './room-api.service';

type ResidentTab = 'dados' | 'responsaveis' | 'historico' | 'termos';

@Component({
  selector: 'app-resident-detail',
  standalone: true,
  imports: [SearchableSelectDirective, UnsavedFormDirective, RouterLink, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page">
      @if (!canView()) {
        <section class="mg-empty" role="alert">
          <span class="material-symbols-rounded" aria-hidden="true">lock</span>
          <h1>Acesso restrito</h1>
          <p>Esta área está disponível para gestor e supervisor.</p>
          <a class="btn mg-primary" routerLink="/inicio">Voltar ao início</a>
        </section>
      } @else if (!isDemo()) {
        @if (loading()) {
          <section class="mg-empty" role="status" aria-live="polite">
            <span class="material-symbols-rounded mg-loading-icon" aria-hidden="true"
              >progress_activity</span
            >
            <h1>Carregando residente</h1>
            <p>Consultando o cadastro local de teste.</p>
          </section>
        } @else if (loadError()) {
          <section class="mg-empty" role="alert">
            <h1>
              {{ missing() ? 'Residente não encontrado' : 'Não foi possível carregar o residente' }}
            </h1>
            <p>{{ loadError() }}</p>
            @if (!missing()) {
              <button type="button" class="btn mg-primary" (click)="load()">
                Tentar novamente
              </button>
            }
            <a class="btn mg-secondary" routerLink="/residentes">Voltar aos residentes</a>
          </section>
        } @else if (localResident(); as item) {
          <header class="mg-heading">
            <div>
              <a class="mg-back" routerLink="/residentes"
                ><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>
                Residentes</a
              >
              <h1>{{ item.name }}</h1>
              <p>Matrícula {{ item.enrollment }}</p>
            </div>
            @if (canEdit()) {
              <a class="btn mg-primary" [routerLink]="['/residentes', item.id, 'editar']"
                ><span class="material-symbols-rounded" aria-hidden="true">edit</span> Editar
                cadastro</a
              >
            }
          </header>
          @if (saved()) {
            <p class="mg-success" role="status">
              <span class="material-symbols-rounded" aria-hidden="true">check_circle</span> Cadastro
              salvo no ambiente local de teste.
            </p>
          }
          <nav class="mg-tabs segmented" aria-label="Seções do residente">
            <button
              type="button"
              [class.active]="tab() === 'dados'"
              [attr.aria-current]="tab() === 'dados' ? 'page' : null"
              (click)="tab.set('dados')"
            >
              Dados
            </button>
            <button
              type="button"
              [class.active]="tab() === 'responsaveis'"
              [attr.aria-current]="tab() === 'responsaveis' ? 'page' : null"
              (click)="tab.set('responsaveis')"
            >
              Responsáveis
            </button>
            <button
              type="button"
              [class.active]="tab() === 'historico'"
              [attr.aria-current]="tab() === 'historico' ? 'page' : null"
              (click)="tab.set('historico')"
            >
              Histórico
            </button>
            <button
              type="button"
              [class.active]="tab() === 'termos'"
              [attr.aria-current]="tab() === 'termos' ? 'page' : null"
              (click)="tab.set('termos')"
            >
              Termos
            </button>
          </nav>
          @if (tab() === 'dados') {
            <section class="panel mg-panel" aria-labelledby="resident-data-heading">
              <h2 id="resident-data-heading">Identificação</h2>
              <dl class="mg-details">
                <div>
                  <dt>Nome completo</dt>
                  <dd>{{ item.name }}</dd>
                </div>
                <div>
                  <dt>Matrícula</dt>
                  <dd>{{ item.enrollment }}</dd>
                </div>
                <div>
                  <dt>Data de nascimento</dt>
                  <dd>{{ item.birthDate ? formattedDate(item.birthDate) : 'Não informado' }}</dd>
                </div>
                <div>
                  <dt>Curso</dt>
                  <dd>{{ item.course || 'Não informado' }}</dd>
                </div>
                <div>
                  <dt>E-mail institucional</dt>
                  <dd>{{ localResident()?.institutionalEmail || 'Não informado' }}</dd>
                </div>
              </dl>
            </section>
            <section class="panel mg-panel" aria-labelledby="resident-allocation-heading">
              <div class="mg-section-heading">
                <div>
                  <h2 id="resident-allocation-heading">Quarto do residente</h2>
                  <p>Vínculo local provisório. A situação do quarto é registrada separadamente.</p>
                </div>
              </div>
              @if (allocationLoading()) {
                <p class="mg-muted" role="status">Carregando alocação e quartos...</p>
              } @else if (allocationLoadError()) {
                <div class="mg-empty mg-empty-inline" role="alert">
                  <h3>Não foi possível carregar a alocação</h3>
                  <p>{{ allocationLoadError() }}</p>
                  <button type="button" class="btn mg-secondary" (click)="loadAllocations()">
                    Tentar novamente
                  </button>
                </div>
              } @else {
                @if (activeAllocation(); as allocation) {
                  <p class="mg-muted">Alocado desde {{ allocationDate(allocation.startedAt) }}.</p>
                  <p>
                    <a [routerLink]="['/quartos', allocation.roomId]">{{
                      roomName(allocation.roomId)
                    }}</a>
                  </p>
                } @else {
                  <p class="mg-muted">Nenhum quarto ativo vinculado a este residente.</p>
                }
                @if (canEdit()) {
                  <form
                    sagerUnsaved
                    #allocationDraft="sagerUnsaved"
                    [sagerSaving]="allocationSaving"
                    class="mg-inline-form"
                    (submit)="$event.preventDefault(); saveAllocation()"
                  >
                    <label class="field mg-field"
                      >{{ activeAllocation() ? 'Transferir para' : 'Alocar em' }}
                      <select sagerSearchable [formControl]="selectedRoom" required>
                        <option value="">Selecione um quarto</option>
                        @for (room of allocationMap().rooms; track room.id) {
                          <option
                            [value]="room.id"
                            [disabled]="
                              !roomCanReceive(room) || room.id === activeAllocation()?.roomId
                            "
                          >
                            {{ roomName(room.id) }} · {{ roomAvailability(room) }}
                          </option>
                        }
                      </select>
                    </label>
                    <div class="action-row mg-actions">
                      <button
                        type="submit"
                        class="btn mg-primary"
                        [disabled]="allocationSaving() || !selectedRoom.value"
                      >
                        {{
                          allocationSaving()
                            ? 'Salvando...'
                            : activeAllocation()
                              ? 'Transferir residente'
                              : 'Alocar residente'
                        }}
                      </button>
                      @if (activeAllocation() && !confirmEnd()) {
                        <button
                          type="button"
                          class="btn mg-secondary"
                          [disabled]="allocationSaving()"
                          (click)="confirmEnd.set(true)"
                        >
                          Encerrar alocação
                        </button>
                      }
                    </div>
                  </form>
                  @if (confirmEnd()) {
                    <div
                      class="mg-note"
                      role="group"
                      aria-label="Confirmar encerramento da alocação"
                    >
                      <span class="material-symbols-rounded" aria-hidden="true">info</span>
                      <div>
                        <p>
                          Encerrar libera a vaga e preserva o histórico. Confirme para continuar.
                        </p>
                        <div class="action-row mg-actions">
                          <button
                            type="button"
                            class="btn mg-primary"
                            [disabled]="allocationSaving()"
                            (click)="endAllocation()"
                          >
                            Confirmar encerramento
                          </button>
                          <button
                            type="button"
                            class="btn mg-secondary"
                            (click)="confirmEnd.set(false)"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  }
                  @if (allocationActionError()) {
                    <p class="mg-alert" role="alert">{{ allocationActionError() }}</p>
                  }
                }
                <p class="mg-muted">
                  Capacidade definida limita novas alocações; quartos em manutenção ou indisponíveis
                  bloqueiam entrada. Regra local provisória, sujeita à AE.
                </p>
              }
            </section>
            <div class="mg-note">
              <span class="material-symbols-rounded" aria-hidden="true">info</span>
              <p>
                A situação do quarto é manual e não define sua ocupação.
                @if (!item.birthDate) {
                  A ausência da data de nascimento não indica maioridade.
                }
              </p>
            </div>
            <section class="mg-note mg-sensitive" aria-labelledby="medical-title">
              <span class="material-symbols-rounded" aria-hidden="true">lock</span>
              <div>
                <h2 id="medical-title">Informações médicas restritas</h2>
                <p>
                  As notas assistenciais têm habilitação, vínculo e partilha próprios. O perfil de
                  gestão não concede acesso ao conteúdo.
                </p>
                <a [routerLink]="['/saude/residentes', item.id]">Consultar área de saúde</a>
              </div>
            </section>
          } @else if (tab() === 'responsaveis') {
            <section class="panel mg-panel" aria-labelledby="local-guardians-heading">
              <div class="mg-section-heading">
                <div>
                  <h2 id="local-guardians-heading">Responsáveis legais</h2>
                  <p>Vínculos cadastrados no ambiente local de teste.</p>
                </div>
                @if (canEdit()) {
                  <a
                    class="btn mg-primary"
                    [routerLink]="['/responsaveis/novo']"
                    [queryParams]="{ residente: item.id }"
                  >
                    <span class="material-symbols-rounded" aria-hidden="true">person_add</span>
                    Vincular responsável
                  </a>
                }
              </div>
              @if (guardiansLoading()) {
                <div class="mg-empty mg-empty-inline" role="status">
                  <h3>Carregando responsáveis</h3>
                  <p>Consultando os vínculos deste residente.</p>
                </div>
              } @else if (guardiansError()) {
                <div class="mg-empty mg-empty-inline" role="alert">
                  <h3>Não foi possível carregar responsáveis</h3>
                  <p>Confira a conexão com o backend local e tente novamente.</p>
                  <button type="button" class="btn mg-primary" (click)="loadLocalGuardians()">
                    Tentar novamente
                  </button>
                </div>
              } @else if (localGuardians().length) {
                <div class="mg-list">
                  @for (guardian of localGuardians(); track guardian.id) {
                    <article class="mg-row mg-guardian-row">
                      <div class="mg-avatar" aria-hidden="true">
                        {{ guardian.name.slice(0, 1) }}
                      </div>
                      <div class="mg-row-main">
                        <h3>{{ guardian.name }}</h3>
                        <p>
                          {{ guardian.relationship }} · Telefone
                          {{ guardian.phone || 'não informado' }}
                        </p>
                      </div>
                      <div class="mg-row-detail">
                        <span
                          class="mg-status"
                          [attr.data-tone]="guardian.active ? null : 'neutral'"
                          ><span class="material-symbols-rounded" aria-hidden="true">{{
                            guardian.active ? 'check_circle' : 'block'
                          }}</span
                          >{{ guardian.active ? 'Ativo' : 'Inativo' }}</span
                        ><span>Assinatura pendente de definição institucional</span>
                      </div>
                      <a class="mg-row-link" [routerLink]="['/responsaveis', guardian.id]"
                        >Ver detalhes
                        <span class="material-symbols-rounded" aria-hidden="true"
                          >arrow_forward</span
                        ></a
                      >
                    </article>
                  }
                </div>
              } @else {
                <div class="mg-empty mg-empty-inline" role="status">
                  <h3>Nenhum responsável vinculado</h3>
                  <p>O cadastro do residente ainda não tem vínculos de responsáveis.</p>
                </div>
              }
              <p class="mg-muted">
                A autorização de saída e a assinatura válida dependem de definição institucional.
              </p>
            </section>
          } @else if (tab() === 'historico') {
            <section class="panel mg-panel" aria-labelledby="allocation-history-heading">
              <h2 id="allocation-history-heading">Histórico de quartos</h2>
              @if (allocationLoading()) {
                <p role="status">Carregando histórico...</p>
              } @else if (allocationLoadError()) {
                <p role="alert">{{ allocationLoadError() }}</p>
                <button type="button" class="btn mg-secondary" (click)="loadAllocations()">
                  Tentar novamente
                </button>
              } @else if (allocations().length) {
                <ol class="mg-timeline">
                  @for (allocation of allocations(); track allocation.id) {
                    <li>
                      <time>{{ allocationDate(allocation.startedAt) }}</time>
                      <div>
                        <strong>{{ roomName(allocation.roomId) }}</strong>
                        <p>
                          {{
                            allocation.endedAt
                              ? (allocation.endReason === 'TRANSFER'
                                  ? 'Transferido'
                                  : 'Encerrado') +
                                ' em ' +
                                allocationDate(allocation.endedAt)
                              : 'Alocação ativa'
                          }}
                        </p>
                      </div>
                    </li>
                  }
                </ol>
              } @else {
                <div class="mg-empty mg-empty-inline" role="status">
                  <h3>Sem alocações</h3>
                  <p>Nenhum quarto foi vinculado a este residente.</p>
                </div>
              }
            </section>
          } @else {
            <section class="panel mg-panel" aria-labelledby="resident-pending-heading">
              <h2 id="resident-pending-heading">
                {{
                  tab() === 'responsaveis'
                    ? 'Responsáveis legais'
                    : tab() === 'historico'
                      ? 'Histórico individual'
                      : 'Termos de Compromisso'
                }}
              </h2>
              <div class="mg-empty mg-empty-inline" role="status">
                <span class="material-symbols-rounded" aria-hidden="true">schedule</span>
                <h3>Ainda não integrado</h3>
                <p>Esta seção depende de definição e integração em outra entrega da Fase 2.</p>
              </div>
            </section>
          }
        } @else {
          <section class="mg-empty" role="alert">
            <h1>Residente não encontrado</h1>
            <p>O cadastro solicitado não está disponível no ambiente local de teste.</p>
            <a class="btn mg-primary" routerLink="/residentes">Voltar aos residentes</a>
          </section>
        }
      } @else if (resident(); as item) {
        <header class="mg-heading">
          <div>
            <a class="mg-back" routerLink="/residentes"
              ><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>
              Residentes</a
            >
            <h1>{{ item.name }}</h1>
            <p>Matrícula {{ item.enrollment }} · {{ item.course }}</p>
          </div>
          @if (canEdit()) {
            <a class="btn mg-primary" [routerLink]="['/residentes', item.id, 'editar']"
              ><span class="material-symbols-rounded" aria-hidden="true">edit</span> Editar
              cadastro</a
            >
          }
        </header>
        @if (saved()) {
          <p class="mg-success" role="status">
            <span class="material-symbols-rounded" aria-hidden="true">check_circle</span> Cadastro
            salvo nesta demonstração.
          </p>
        }
        <nav class="mg-tabs segmented" aria-label="Seções do residente">
          <button
            type="button"
            [class.active]="tab() === 'dados'"
            [attr.aria-current]="tab() === 'dados' ? 'page' : null"
            (click)="tab.set('dados')"
          >
            Dados
          </button>
          <button
            type="button"
            [class.active]="tab() === 'responsaveis'"
            [attr.aria-current]="tab() === 'responsaveis' ? 'page' : null"
            (click)="tab.set('responsaveis')"
          >
            Responsáveis
          </button>
          <button
            type="button"
            [class.active]="tab() === 'historico'"
            [attr.aria-current]="tab() === 'historico' ? 'page' : null"
            (click)="tab.set('historico')"
          >
            Histórico
          </button>
          <button
            type="button"
            [class.active]="tab() === 'termos'"
            [attr.aria-current]="tab() === 'termos' ? 'page' : null"
            (click)="tab.set('termos')"
          >
            Termos
          </button>
        </nav>

        @if (tab() === 'dados') {
          <section class="panel mg-panel" aria-labelledby="resident-data-heading">
            <h2 id="resident-data-heading">Identificação e residência</h2>
            <dl class="mg-details">
              <div>
                <dt>Nome completo</dt>
                <dd>{{ item.name }}</dd>
              </div>
              <div>
                <dt>Matrícula</dt>
                <dd>{{ item.enrollment }}</dd>
              </div>
              <div>
                <dt>Data de nascimento</dt>
                <dd>{{ formattedDate(item.birthDate) }} · {{ age(item.birthDate) }} anos</dd>
              </div>
              <div>
                <dt>Curso</dt>
                <dd>{{ item.course }}</dd>
              </div>
              <div>
                <dt>Quarto</dt>
                <dd>{{ service.roomLabel(item.roomId) }}</dd>
              </div>
              <div>
                <dt>Situação</dt>
                <dd>
                  <span
                    class="mg-status"
                    [attr.data-tone]="item.status === 'Ativo' ? null : 'neutral'"
                    ><span class="material-symbols-rounded" aria-hidden="true">{{
                      item.status === 'Ativo' ? 'check_circle' : 'block'
                    }}</span
                    >{{ item.status }}</span
                  >
                </dd>
              </div>
            </dl>
          </section>
          <section class="mg-note mg-sensitive" aria-labelledby="medical-title">
            <span class="material-symbols-rounded" aria-hidden="true">lock</span>
            <div>
              <h2 id="medical-title">Informações médicas restritas</h2>
              <p>
                A matriz de acesso a dados médicos ainda depende de definição da AE/TI. Nenhum dado
                médico é exibido ou armazenado nesta demonstração.
              </p>
            </div>
          </section>
        }

        @if (tab() === 'responsaveis') {
          <section class="panel mg-panel" aria-labelledby="guardians-title">
            <div class="mg-section-heading">
              <div>
                <h2 id="guardians-title">Responsáveis legais</h2>
                <p>O contato autorizado é necessário para o fluxo de saída longa.</p>
              </div>
              @if (canEdit() && !editingGuardian()) {
                <button type="button" class="btn mg-primary" (click)="openGuardianForm()">
                  <span class="material-symbols-rounded" aria-hidden="true">person_add</span>
                  Vincular responsável
                </button>
              }
            </div>
            @if (canEdit()) {
              @if (guardians().length) {
                <div class="mg-list">
                  @for (guardian of guardians(); track guardian.id) {
                    <article class="mg-row mg-guardian-row">
                      <div class="mg-avatar" aria-hidden="true">
                        {{ guardian.name.slice(0, 1) }}
                      </div>
                      <div class="mg-row-main">
                        <h3>{{ guardian.name }}</h3>
                        <p>{{ guardian.relationship }} · Telefone {{ guardian.phone }}</p>
                      </div>
                      <div class="mg-row-detail">
                        <span
                          class="mg-status"
                          [attr.data-tone]="guardian.active ? null : 'neutral'"
                          ><span class="material-symbols-rounded" aria-hidden="true">{{
                            guardian.active ? 'check_circle' : 'block'
                          }}</span
                          >{{ guardian.active ? 'Ativo' : 'Inativo' }}</span
                        ><span>{{
                          guardian.authorized
                            ? 'Autorizado para assinatura'
                            : 'Sem autorização de assinatura'
                        }}</span>
                      </div>
                      <a class="mg-row-link" [routerLink]="['/responsaveis', guardian.id]"
                        >Ver detalhes
                        <span class="material-symbols-rounded" aria-hidden="true"
                          >arrow_forward</span
                        ></a
                      ><button
                        type="button"
                        class="btn mg-secondary"
                        (click)="openGuardianForm(guardian)"
                      >
                        Editar
                      </button>
                    </article>
                  }
                </div>
              } @else {
                <div class="mg-empty mg-empty-inline">
                  <h3>Nenhum responsável vinculado</h3>
                  <p>
                    Vincule um responsável ativo e autorizado antes de solicitar uma saída longa.
                  </p>
                </div>
              }
              @if (editingGuardian()) {
                <form
                  sagerUnsaved
                  class="mg-inline-form"
                  [formGroup]="guardianForm"
                  (ngSubmit)="saveGuardian()"
                  novalidate
                >
                  <h3>{{ guardianId() ? 'Editar responsável' : 'Novo responsável' }}</h3>
                  <div class="form-grid mg-form-grid">
                    <label class="field mg-field"
                      >Nome completo *<input formControlName="name" autocomplete="name" />
                      @if (
                        guardianForm.controls.name.invalid && guardianForm.controls.name.touched
                      ) {
                        <span class="mg-field-error"
                          >Informe o nome com pelo menos 3 caracteres.</span
                        >
                      }
                    </label>
                    <label class="field mg-field"
                      >Vínculo com o residente *<input
                        formControlName="relationship"
                        placeholder="Ex.: mãe, pai ou tutor"
                      />
                      @if (
                        guardianForm.controls.relationship.invalid &&
                        guardianForm.controls.relationship.touched
                      ) {
                        <span class="mg-field-error">Informe o vínculo com o residente.</span>
                      }
                    </label>
                    <label class="field mg-field"
                      >Telefone para o fluxo de assinatura *<input
                        type="tel"
                        formControlName="phone"
                        inputmode="tel"
                        autocomplete="tel"
                        placeholder="DDD e número, somente dígitos"
                      />
                      @if (
                        guardianForm.controls.phone.invalid && guardianForm.controls.phone.touched
                      ) {
                        <span class="mg-field-error"
                          >Informe 10 ou 11 dígitos, incluindo o DDD.</span
                        >
                      }
                    </label>
                  </div>
                  <label class="mg-check"
                    ><input type="checkbox" formControlName="active" /> Responsável ativo</label
                  >
                  <label class="mg-check"
                    ><input type="checkbox" formControlName="authorized" /> Autorizado para
                    assinatura de saída longa</label
                  >
                  <p class="mg-muted">Nenhuma mensagem será enviada nesta demonstração.</p>
                  @if (guardianError()) {
                    <p role="alert" class="mg-alert">{{ guardianError() }}</p>
                  }
                  <div class="action-row mg-actions">
                    <button type="button" class="btn mg-secondary" (click)="closeGuardianForm()">
                      Cancelar</button
                    ><button type="submit" class="btn mg-primary">Salvar responsável</button>
                  </div>
                </form>
              }
            } @else {
              <div class="mg-note">
                <span class="material-symbols-rounded" aria-hidden="true">lock</span>
                <p>
                  Os contatos e autorizações demonstrativos são visíveis para gestor e supervisor.
                  Nenhuma assinatura é emitida nesta demonstração.
                </p>
              </div>
            }
          </section>
        }

        @if (tab() === 'historico') {
          <section class="panel mg-panel" aria-labelledby="history-title">
            <h2 id="history-title">Histórico individual</h2>
            <p class="mg-muted">
              Eventos abaixo são exemplos fictícios. Registros reais serão fornecidos pelos módulos
              operacionais.
            </p>
            @if (history().length) {
              <ol class="mg-timeline">
                @for (entry of history(); track entry.id) {
                  <li>
                    <time>{{ formattedDate(entry.date) }}</time>
                    <div>
                      <strong>{{ entry.category }}</strong>
                      <p>{{ entry.description }}</p>
                    </div>
                  </li>
                }
              </ol>
            } @else {
              <div class="mg-empty mg-empty-inline">
                <h3>Sem eventos demonstrativos</h3>
                <p>O histórico aparecerá aqui quando existirem registros da operação.</p>
              </div>
            }
          </section>
        }

        @if (tab() === 'termos') {
          <section class="panel mg-panel" aria-labelledby="terms-title">
            <h2 id="terms-title">Termos de Compromisso</h2>
            <div class="mg-empty mg-empty-inline">
              <span class="material-symbols-rounded" aria-hidden="true">description</span>
              <h3>Nenhum termo disponível</h3>
              <p>
                Critérios de emissão, ciência e assinatura do Termo de Compromisso dependem de
                homologação pela AE. Nenhum documento é gerado nesta demonstração.
              </p>
            </div>
          </section>
        }
      } @else {
        <section class="mg-empty" role="alert">
          <h1>Residente não encontrado</h1>
          <p>O cadastro solicitado não está disponível nesta demonstração.</p>
          <a class="btn mg-primary" routerLink="/residentes">Voltar aos residentes</a>
        </section>
      }
    </main>
  `,
})
export class ResidentDetailComponent {
  @ViewChild('allocationDraft') private allocationDraft?: UnsavedFormDirective;
  private readonly drafts = inject(UnsavedForms);
  readonly service = inject(ManagementDemoService);
  private readonly api = inject(ResidentApiService);
  private readonly guardianApi = inject(GuardianApiService);
  private readonly allocationApi = inject(AllocationApiService);
  private readonly roomApi = inject(RoomApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly session = inject(DemoSessionService);
  private readonly route = inject(ActivatedRoute);
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly isDemo = this.session.active;
  readonly canView = computed(() => this.session.hasRole('gestor', 'supervisor'));
  readonly canEdit = computed(() => this.session.hasRole('gestor', 'supervisor'));
  readonly resident = computed(() => this.service.resident(this.id));
  readonly localResident = signal<ResidentRecord | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly missing = signal(false);
  readonly guardians = computed(() => this.service.guardiansFor(this.id));
  readonly localGuardians = signal<GuardianRecord[]>([]);
  readonly guardiansLoading = signal(false);
  readonly guardiansError = signal(false);
  readonly allocations = signal<AllocationRecord[]>([]);
  readonly allocationMap = signal<HousingMap>({ accommodations: [], units: [], rooms: [] });
  readonly allocationLoading = signal(false);
  readonly allocationLoadError = signal('');
  readonly allocationActionError = signal('');
  readonly allocationSaving = signal(false);
  readonly confirmEnd = signal(false);
  readonly selectedRoom = new FormControl('', { nonNullable: true });
  readonly activeAllocation = computed(
    () => this.allocations().find((item) => item.endedAt === null) ?? null,
  );
  readonly history = computed(() =>
    this.service.history().filter((entry) => entry.residentId === this.id),
  );
  readonly tab = signal<ResidentTab>('dados');
  readonly saved = signal(this.route.snapshot.queryParamMap.get('saved') === '1');
  readonly editingGuardian = signal(false);
  readonly guardianId = signal<string | null>(null);
  readonly guardianError = signal('');
  readonly guardianForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
    relationship: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{10,11}$/)],
    }),
    active: new FormControl(true, { nonNullable: true }),
    authorized: new FormControl(true, { nonNullable: true }),
  });
  readonly age = ageFromBirthDate;
  readonly formattedDate = formattedDate;

  constructor() {
    if (!this.isDemo() && this.canView()) void this.load();
  }

  async load(): Promise<void> {
    if (this.isDemo() || !this.canView()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.missing.set(false);
    try {
      this.localResident.set(await this.api.get(this.id));
      if (!this.destroyRef.destroyed) void this.loadLocalGuardians();
      if (!this.destroyRef.destroyed) void this.loadAllocations();
    } catch (error) {
      this.localResident.set(null);
      this.missing.set(error instanceof ResidentApiError && error.status === 404);
      this.loadError.set(
        this.missing()
          ? 'O cadastro solicitado não está disponível no ambiente local de teste.'
          : 'Confira a conexão com o backend local e tente novamente.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  async loadAllocations(): Promise<void> {
    if (this.isDemo() || !this.canView()) return;
    this.allocationLoading.set(true);
    this.allocationLoadError.set('');
    try {
      const [allocations, map] = await Promise.all([
        this.allocationApi.byResident(this.id),
        this.roomApi.map(),
      ]);
      if (this.destroyRef.destroyed) return;
      this.allocations.set(allocations);
      this.allocationMap.set(map);
      this.selectedRoom.setValue('');
      this.confirmEnd.set(false);
    } catch (error) {
      if (this.destroyRef.destroyed) return;
      this.allocations.set([]);
      this.allocationMap.set({ accommodations: [], units: [], rooms: [] });
      this.allocationLoadError.set(allocationErrorMessage(error));
    } finally {
      if (!this.destroyRef.destroyed) this.allocationLoading.set(false);
    }
  }

  roomName(roomId: string): string {
    const map = this.allocationMap();
    const room = map.rooms.find((item) => item.id === roomId);
    if (!room) return 'Quarto não encontrado';
    const accommodation =
      map.accommodations.find((item) => item.id === room.accommodationId)?.name ?? 'Alojamento';
    const unit = map.units.find((item) => item.id === room.unitId)?.name;
    return `Quarto ${room.number} (código ${room.code}) · ${accommodation}${unit ? ` · ${unit}` : ''}${room.floor ? ` · ${room.floor}` : ''}`;
  }

  roomCanReceive(room: RoomRecord): boolean {
    return (
      !['Manutenção', 'Indisponível'].includes(room.situation) &&
      room.capacity !== null &&
      room.vacancies !== null &&
      room.vacancies > 0
    );
  }

  roomAvailability(room: RoomRecord): string {
    if (['Manutenção', 'Indisponível'].includes(room.situation)) return room.situation;
    if (room.capacity === null) return 'capacidade não definida';
    if (room.vacancies === 0) return 'lotado';
    return `${room.vacancies} ${room.vacancies === 1 ? 'vaga livre' : 'vagas livres'}`;
  }

  allocationDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'Data não informada'
      : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }

  async saveAllocation(): Promise<void> {
    if (!this.canEdit() || this.allocationSaving() || this.allocationLoadError()) return;
    const roomId = this.selectedRoom.value;
    const room = this.allocationMap().rooms.find((item) => item.id === roomId);
    if (!room || !this.roomCanReceive(room) || roomId === this.activeAllocation()?.roomId) return;
    this.allocationSaving.set(true);
    this.allocationActionError.set('');
    try {
      const current = this.activeAllocation();
      if (current) await this.allocationApi.transfer(current.id, roomId, current.version);
      else await this.allocationApi.create(this.id, roomId);
      this.allocationDraft?.markSaved();
      await this.loadAllocations();
    } catch (error) {
      this.allocationActionError.set(allocationErrorMessage(error));
      if (error instanceof AllocationApiError && error.status === 409) await this.loadAllocations();
    } finally {
      this.allocationSaving.set(false);
    }
  }

  async endAllocation(): Promise<void> {
    const current = this.activeAllocation();
    if (!this.canEdit() || !current || this.allocationSaving()) return;
    this.allocationSaving.set(true);
    this.allocationActionError.set('');
    try {
      await this.allocationApi.end(current.id, current.version);
      await this.loadAllocations();
    } catch (error) {
      this.allocationActionError.set(allocationErrorMessage(error));
      if (error instanceof AllocationApiError && error.status === 409) await this.loadAllocations();
    } finally {
      this.allocationSaving.set(false);
    }
  }

  async loadLocalGuardians(): Promise<void> {
    if (this.isDemo() || !this.canView()) return;
    this.guardiansLoading.set(true);
    this.guardiansError.set(false);
    try {
      const all = await this.guardianApi.list();
      if (this.destroyRef.destroyed) return;
      this.localGuardians.set(all.filter((item) => item.residentId === this.id));
    } catch {
      if (this.destroyRef.destroyed) return;
      this.localGuardians.set([]);
      this.guardiansError.set(true);
    } finally {
      if (!this.destroyRef.destroyed) this.guardiansLoading.set(false);
    }
  }

  openGuardianForm(guardian?: LegalGuardian): void {
    if (!this.canEdit()) return;
    this.guardianError.set('');
    this.guardianId.set(guardian?.id ?? null);
    this.guardianForm.reset({
      name: guardian?.name ?? '',
      relationship: guardian?.relationship ?? '',
      phone: guardian?.phone ?? '',
      active: guardian?.active ?? true,
      authorized: guardian?.authorized ?? true,
    });
    this.editingGuardian.set(true);
  }

  async closeGuardianForm(): Promise<void> {
    if (!(await this.drafts.canLeave())) return;
    this.guardianForm.markAsPristine();
    this.editingGuardian.set(false);
    this.guardianId.set(null);
    this.guardianError.set('');
  }

  saveGuardian(): void {
    if (!this.canEdit()) return;
    this.guardianError.set('');
    if (this.guardianForm.invalid) {
      this.guardianForm.markAllAsTouched();
      return;
    }
    try {
      this.service.saveGuardian(
        this.id,
        this.guardianForm.getRawValue(),
        this.guardianId() ?? undefined,
      );
      this.guardianForm.markAsPristine();
      void this.closeGuardianForm();
    } catch (error) {
      this.guardianError.set(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o responsável. Tente novamente.',
      );
    }
  }
}
