import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DOCUMENT } from '@angular/common';
import { DemoSessionService } from '../../core/demo-session.service';
import { NoticesDemoService, NoticeKind } from './notices-demo.service';
import { OwnCommunicationsLocalPage } from './own-communications-local.pages';

@Component({
  standalone: true,
  selector: 'sager-notices',
  imports: [DatePipe, OwnCommunicationsLocalPage],
  template: `
    @if (!session.active()) {
      <sager-own-communications-local />
    } @else {
      <main class="page notices-page" [class.detail-open]="!!selected()">
        <header class="page-header">
          <div>
            <h1>Avisos e advertências</h1>
            <p>Consulte as mensagens destinadas a você. Abrir um item não registra ciência.</p>
          </div>
        </header>
        <div class="scope-note">
          <span class="material-symbols-outlined" aria-hidden="true">info</span>Notificações
          internas em análise não aparecem aqui. Os registros abaixo são fictícios.
        </div>
        @if (session.scenario() === 'erro') {
          <section class="empty panel" role="alert">
            <span class="material-symbols-outlined" aria-hidden="true">error</span>
            <h2>Não foi possível carregar as comunicações</h2>
            <p>
              Este é um cenário de demonstração. Tente novamente para voltar aos registros
              fictícios.
            </p>
            <button class="btn" type="button" (click)="session.setScenario('padrao')">
              Tentar novamente
            </button>
          </section>
        } @else if (session.scenario() === 'carregando') {
          <section class="empty panel" role="status">
            <span class="material-symbols-outlined" aria-hidden="true">hourglass_top</span>
            <h2>Carregando comunicações</h2>
            <p>Aguarde enquanto os itens são preparados nesta demonstração.</p>
          </section>
        } @else {
          <div class="tabs" role="tablist" aria-label="Categorias de comunicação">
            <button
              type="button"
              id="tab-avisos"
              role="tab"
              [attr.aria-selected]="tab() === 'aviso'"
              aria-controls="panel-notices"
              [tabIndex]="tab() === 'aviso' ? 0 : -1"
              (click)="selectTab('aviso')"
              (keydown.arrowright)="moveTab($event, 'advertencia')"
              (keydown.arrowleft)="moveTab($event, 'advertencia')"
            >
              Avisos <span>{{ count('aviso') }}</span>
            </button>
            <button
              type="button"
              id="tab-advertencias"
              role="tab"
              [attr.aria-selected]="tab() === 'advertencia'"
              aria-controls="panel-notices"
              [tabIndex]="tab() === 'advertencia' ? 0 : -1"
              (click)="selectTab('advertencia')"
              (keydown.arrowright)="moveTab($event, 'aviso')"
              (keydown.arrowleft)="moveTab($event, 'aviso')"
            >
              Advertências <span>{{ count('advertencia') }}</span>
            </button>
          </div>
          <div
            id="panel-notices"
            role="tabpanel"
            [attr.aria-labelledby]="tab() === 'aviso' ? 'tab-avisos' : 'tab-advertencias'"
            class="notices-layout"
          >
            <section class="notice-list" aria-label="Itens da categoria selecionada">
              @if (filtered().length === 0) {
                <div class="empty panel">
                  <span class="material-symbols-outlined" aria-hidden="true">inbox</span>
                  <h2>Nenhum item nesta aba</h2>
                  <p>Quando houver uma comunicação destinada a você, ela aparecerá aqui.</p>
                </div>
              }
              @for (item of filtered(); track item.id) {
                <button
                  type="button"
                  class="notice-row"
                  [id]="'notice-row-' + item.id"
                  [class.selected]="selected()?.id === item.id"
                  (click)="open(item.id)"
                  [attr.aria-current]="selected()?.id === item.id ? 'true' : null"
                >
                  <span class="notice-icon" [class.warning]="item.kind === 'advertencia'"
                    ><span class="material-symbols-outlined" aria-hidden="true">{{
                      item.kind === 'aviso' ? 'campaign' : 'gavel'
                    }}</span></span
                  >
                  <span class="notice-info"
                    ><strong>{{ item.title }}</strong
                    ><span>{{ item.source }} · {{ item.date | date: 'dd/MM/yyyy' }}</span></span
                  >
                  <span class="notice-status" [class.pending]="!item.acknowledgedAt">{{
                    item.acknowledgedAt
                      ? 'Ciente'
                      : item.readAt
                        ? 'Lido · ciência pendente'
                        : 'Novo · ciência pendente'
                  }}</span>
                </button>
              }
            </section>
            <section
              id="notice-detail"
              class="notice-detail panel"
              [attr.aria-label]="selected() ? null : 'Detalhe da comunicação'"
              [attr.aria-labelledby]="selected() ? 'notice-detail-heading' : null"
            >
              @if (selected(); as item) {
                <button class="back-to-list" type="button" (click)="returnToList()">
                  <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>Voltar
                  à lista
                </button>
                <div class="detail-top">
                  <span class="type-tag" [class.warning]="item.kind === 'advertencia'">{{
                    item.kind === 'aviso' ? 'Aviso' : 'Advertência'
                  }}</span
                  ><span>{{ item.date | date: 'dd/MM/yyyy HH:mm' }}</span>
                </div>
                <h2 id="notice-detail-heading" tabindex="-1">{{ item.title }}</h2>
                <p class="source">Emitido por {{ item.source }}</p>
                <div class="message">{{ item.body }}</div>
                <div class="reading-state">
                  <span class="material-symbols-outlined" aria-hidden="true">visibility</span
                  ><span
                    >{{ item.readAt ? 'Aberto para leitura' : 'Ainda não aberto'
                    }}<strong>Leitura não é ciência</strong></span
                  >
                </div>
                @if (item.acknowledgedAt) {
                  <div class="acknowledged" role="status">
                    <span class="material-symbols-outlined" aria-hidden="true">check_circle</span
                    ><span
                      ><strong>Ciente</strong
                      ><small
                        >Registrado em {{ item.acknowledgedAt | date: 'dd/MM/yyyy HH:mm' }}</small
                      ></span
                    >
                  </div>
                } @else if (!reviewing()) {
                  <button class="btn" type="button" (click)="reviewing.set(true)">
                    Marcar como ciente
                  </button>
                } @else {
                  <div class="confirm-box" role="group" aria-label="Confirmar ciência">
                    <strong>Confirmar ciência deste item?</strong>
                    <p>Essa ação registra que você tomou ciência da comunicação.</p>
                    <div class="action-row">
                      <button class="btn-secondary" type="button" (click)="reviewing.set(false)">
                        Cancelar</button
                      ><button class="btn" type="button" (click)="acknowledge(item.id)">
                        Confirmar ciência
                      </button>
                    </div>
                  </div>
                }
              } @else {
                <div class="select-prompt">
                  <span class="material-symbols-outlined" aria-hidden="true">article</span>
                  <h2>Selecione uma comunicação</h2>
                  <p>Abra um item para ler o conteúdo e decidir se deseja registrar ciência.</p>
                </div>
              }
            </section>
          </div>
        }
      </main>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .notices-page {
        max-width: 1460px;
      }
      .scope-note {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        color: #4d6254;
        background: #ebf3ec;
        border: 1px solid #d3e4d6;
        border-radius: 10px;
        padding: 14px 18px;
        margin: 23px 0;
        line-height: 1.5;
      }
      .scope-note .material-symbols-outlined {
        color: #1a6e45;
      }
      .tabs {
        display: flex;
        gap: 8px;
        border-bottom: 1px solid #d6e2d9;
        margin-bottom: 20px;
      }
      .tabs button {
        border: 0;
        background: transparent;
        padding: 14px 18px;
        min-height: 52px;
        color: #506155;
        font-weight: 800;
        font-size: 1rem;
        cursor: pointer;
        border-bottom: 2px solid transparent;
      }
      .tabs button[aria-selected='true'] {
        color: #115837;
        border-bottom-color: #17683f;
      }
      .tabs button span {
        font-size: 0.82rem;
        border-radius: 100px;
        background: #e5eee6;
        padding: 3px 8px;
        margin-left: 4px;
      }
      .notices-layout {
        display: grid;
        grid-template-columns: minmax(310px, 0.92fr) minmax(0, 1.08fr);
        gap: 20px;
        align-items: start;
      }
      .notice-list {
        background: #fff;
        border: 1px solid #d7e3d8;
        border-radius: 12px;
        overflow: hidden;
      }
      .notice-row {
        width: 100%;
        min-height: 92px;
        border: 0;
        background: #fff;
        padding: 18px;
        text-align: left;
        display: grid;
        grid-template-columns: 42px 1fr;
        gap: 7px 14px;
        cursor: pointer;
        color: #20392a;
      }
      .notice-row + .notice-row {
        border-top: 1px solid #e1e9e2;
      }
      .notice-row:hover,
      .notice-row.selected {
        background: #f4f9f4;
      }
      .notice-row:focus-visible {
        outline: 3px solid #a65f00;
        outline-offset: -3px;
      }
      .notice-icon {
        width: 42px;
        height: 42px;
        display: grid;
        place-items: center;
        background: #e8f2e9;
        color: #17683f;
        border-radius: 9px;
        grid-row: 1/3;
      }
      .notice-icon.warning {
        background: #fff0dd;
        color: #915714;
      }
      .notice-info strong,
      .notice-info span {
        display: block;
      }
      .notice-info strong {
        font-size: 1rem;
      }
      .notice-info span {
        color: #607065;
        font-size: 0.81rem;
        margin-top: 5px;
      }
      .notice-status {
        grid-column: 2;
        color: #17683f;
        font-size: 0.79rem;
        font-weight: 800;
      }
      .notice-status.pending {
        color: #915714;
      }
      .notice-detail {
        padding: 30px;
        min-height: 400px;
      }
      .detail-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        color: #627168;
        font-size: 0.83rem;
      }
      .type-tag {
        background: #e6f2e9;
        color: #17683f;
        border-radius: 5px;
        padding: 5px 9px;
        font-weight: 800;
      }
      .type-tag.warning {
        background: #fff0dd;
        color: #915714;
      }
      .notice-detail h2 {
        font-size: 1.5rem;
        margin: 22px 0 6px;
      }
      .source {
        color: #5a6a5f;
        font-size: 0.87rem;
        margin: 0;
      }
      .message {
        font-size: 1.05rem;
        line-height: 1.7;
        margin: 30px 0;
        white-space: pre-line;
      }
      .reading-state {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #5d6b61;
        border-top: 1px solid #e3eae4;
        padding-top: 18px;
        font-size: 0.83rem;
      }
      .reading-state strong {
        font-weight: 800;
      }
      .notice-detail > .btn {
        margin-top: 24px;
      }
      .acknowledged {
        display: flex;
        gap: 11px;
        align-items: center;
        background: #e8f3ea;
        color: #155f3b;
        padding: 15px;
        border-radius: 9px;
        margin-top: 24px;
      }
      .acknowledged strong,
      .acknowledged small {
        display: block;
      }
      .acknowledged small {
        margin-top: 3px;
      }
      .confirm-box {
        border: 1px solid #afcbb6;
        background: #f5faf5;
        padding: 18px;
        margin-top: 24px;
        border-radius: 10px;
      }
      .select-prompt {
        text-align: center;
        display: grid;
        place-items: center;
        align-content: center;
        min-height: 320px;
        color: #5d6c61;
      }
      .select-prompt h2 {
        margin: 12px 0 6px;
        color: #20392a;
      }
      .select-prompt p {
        max-width: 320px;
        line-height: 1.5;
      }
      .empty {
        padding: 30px;
        text-align: center;
      }
      @media (max-width: 980px) {
        .notices-layout {
          grid-template-columns: 1fr;
        }
        .notice-detail {
          min-height: 330px;
        }
      }
      @media (max-width: 540px) {
        .tabs button {
          padding: 13px 10px;
          font-size: 0.9rem;
        }
        .notice-detail {
          padding: 20px;
        }
        .detail-top {
          align-items: flex-start;
          flex-direction: column;
        }
      }
      .notice-info span,
      .notice-status,
      .detail-top,
      .source,
      .reading-state {
        font-size: 0.9rem;
      }
      .reading-state strong {
        display: block;
      }
      .back-to-list {
        display: none;
        align-items: center;
        gap: 8px;
        min-height: 44px;
        border: 0;
        background: transparent;
        color: #17683f;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
        padding: 8px 4px;
      }

      @media (max-width: 980px) {
        .notices-page:not(.detail-open) .notice-detail,
        .notices-page.detail-open .notice-list,
        .notices-page.detail-open .scope-note {
          display: none;
        }
        .notice-detail {
          min-height: 0;
        }
        .back-to-list {
          display: inline-flex;
          margin-bottom: 14px;
        }
        .notice-detail > .btn {
          width: 100%;
          min-height: 48px;
        }
        .confirm-box .action-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }
        .confirm-box .action-row button {
          width: 100%;
          min-height: 48px;
        }
      }
    `,
  ],
})
export class NoticesPage {
  private readonly document = inject(DOCUMENT);
  readonly data = inject(NoticesDemoService);
  readonly session = inject(DemoSessionService);
  readonly tab = signal<NoticeKind>('aviso');
  readonly selectedId = signal<string | null>(null);
  readonly reviewing = signal(false);
  readonly filtered = computed(() =>
    !this.session.active() || this.session.scenario() === 'vazio'
      ? []
      : this.data.notices().filter((item) => item.kind === this.tab()),
  );
  readonly selected = computed(() =>
    !this.session.active() || this.session.scenario() === 'vazio'
      ? null
      : (this.data.notices().find((item) => item.id === this.selectedId()) ?? null),
  );
  count(kind: NoticeKind) {
    return !this.session.active() || this.session.scenario() === 'vazio'
      ? 0
      : this.data.notices().filter((item) => item.kind === kind).length;
  }
  selectTab(kind: NoticeKind) {
    this.tab.set(kind);
    this.selectedId.set(null);
    this.reviewing.set(false);
  }
  moveTab(event: Event, kind: NoticeKind) {
    event.preventDefault();
    this.selectTab(kind);
    queueMicrotask(() =>
      this.document.getElementById(kind === 'aviso' ? 'tab-avisos' : 'tab-advertencias')?.focus(),
    );
  }
  open(id: string) {
    this.data.open(id);
    this.selectedId.set(id);
    this.reviewing.set(false);
    if (this.isCompact()) {
      this.document.defaultView?.requestAnimationFrame(() => {
        if (this.selectedId() !== id) return;
        this.document.getElementById('notice-detail')?.scrollIntoView({ block: 'start' });
        this.document.getElementById('notice-detail-heading')?.focus({ preventScroll: true });
      });
    }
  }
  returnToList() {
    const id = this.selectedId();
    this.selectedId.set(null);
    this.reviewing.set(false);
    this.document.defaultView?.requestAnimationFrame(() => {
      if (id) this.document.getElementById('notice-row-' + id)?.focus();
    });
  }
  private isCompact(): boolean {
    return this.document.defaultView?.matchMedia('(max-width: 980px)').matches ?? false;
  }
  acknowledge(id: string) {
    this.data.acknowledge(id);
    this.reviewing.set(false);
  }
}
