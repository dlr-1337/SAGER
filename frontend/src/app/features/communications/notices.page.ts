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
          <div class="tabs segmented" role="tablist" aria-label="Categorias de comunicação">
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
                  <span
                    class="status notice-status"
                    [class.info]="!item.acknowledgedAt"
                    [class.success]="!!item.acknowledgedAt"
                    >{{
                      item.acknowledgedAt
                        ? 'Ciente'
                        : item.readAt
                          ? 'Lido · ciência pendente'
                          : 'Novo · ciência pendente'
                    }}</span
                  >
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
                  <span
                    class="status"
                    [class.warning]="item.kind === 'advertencia'"
                    [class.success]="item.kind !== 'advertencia'"
                    >{{ item.kind === 'aviso' ? 'Aviso' : 'Advertência' }}</span
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
      .scope-note {
        display: flex;
        gap: 14px;
        align-items: flex-start;
        color: var(--info-ink);
        background: var(--info-bg);
        border-radius: 12px;
        padding: 16px 18px;
        margin: 24px 0;
      }
      .tabs {
        margin-bottom: 20px;
      }
      .tabs button span {
        font-size: var(--text-meta);
        font-weight: 700;
        border-radius: 999px;
        background: var(--green-100);
        color: var(--green-950);
        padding: 2px 8px;
      }
      .notice-row:focus-visible {
        outline-offset: -3px;
        box-shadow: inset 0 0 0 6px var(--green-950);
      }
      .notices-layout {
        display: grid;
        grid-template-columns: minmax(310px, 0.92fr) minmax(0, 1.08fr);
        gap: 24px;
        align-items: start;
      }
      .notice-list {
        background: #fff;
        border: 1px solid var(--line);
        border-radius: var(--radius-card);
        box-shadow: var(--shadow);
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
        gap: 6px 14px;
        cursor: pointer;
        color: var(--ink);
      }
      .notice-row + .notice-row {
        border-top: 1px solid var(--line);
      }
      .notice-row:hover,
      .notice-row.selected {
        background: var(--green-50);
      }
      .notice-row.selected {
        box-shadow: inset 4px 0 0 var(--green-900);
      }
      .notice-row.selected:focus-visible {
        box-shadow:
          inset 4px 0 0 var(--green-900),
          inset 0 0 0 6px var(--green-950);
      }
      .notice-icon {
        width: 42px;
        height: 42px;
        display: grid;
        place-items: center;
        background: var(--green-100);
        color: var(--green-900);
        border-radius: var(--radius-control);
        grid-row: 1/3;
      }
      .notice-icon.warning {
        background: var(--warning-bg);
        color: var(--warning);
      }
      .notice-info strong,
      .notice-info span {
        display: block;
      }
      .notice-info strong {
        font-size: 1rem;
      }
      .notice-info span,
      .detail-top,
      .source,
      .reading-state,
      .select-prompt {
        color: var(--muted);
      }
      .notice-info span {
        margin-top: 4px;
      }
      .notice-status {
        grid-column: 2;
      }
      .notice-detail {
        min-height: 400px;
      }
      .detail-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }
      .notice-detail h2 {
        font-size: 1.4rem;
        margin: 20px 0 6px;
      }
      .source {
        margin: 0;
      }
      .message {
        font-size: 1.05rem;
        line-height: 1.7;
        margin: 28px 0;
        white-space: pre-line;
      }
      .reading-state {
        display: flex;
        align-items: center;
        gap: 8px;
        border-top: 1px solid var(--line);
        padding-top: 18px;
      }
      .reading-state strong {
        display: block;
        color: var(--ink);
      }
      .notice-detail > .btn {
        margin-top: 24px;
      }
      .acknowledged,
      .confirm-box {
        border: 1px solid var(--success-line);
        border-radius: 12px;
        background: var(--green-50);
        color: var(--green-950);
        padding: 16px 18px;
        margin-top: 24px;
      }
      .acknowledged {
        display: flex;
        gap: 14px;
        align-items: center;
      }
      .acknowledged strong,
      .acknowledged small {
        display: block;
      }
      .acknowledged small {
        margin-top: 4px;
        font-size: var(--text-meta);
      }
      .select-prompt {
        text-align: center;
        display: grid;
        place-items: center;
        align-content: center;
        min-height: 320px;
      }
      .select-prompt h2 {
        margin: 12px 0 6px;
        color: var(--ink);
      }
      .select-prompt p {
        max-width: 320px;
      }
      .empty {
        padding: 32px;
        text-align: center;
      }
      .notice-info span,
      .detail-top,
      .source,
      .reading-state {
        font-size: var(--text-meta);
      }
      .back-to-list {
        display: none;
        align-items: center;
        gap: 8px;
        min-height: 44px;
        border: 0;
        background: transparent;
        color: var(--green-800);
        font-weight: 600;
        cursor: pointer;
        padding: 8px 4px;
      }
      .back-to-list:hover {
        text-decoration: underline;
      }
      @media (max-width: 980px) {
        .notices-layout {
          grid-template-columns: 1fr;
        }
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
        .notice-detail > .btn,
        .confirm-box .action-row button {
          width: 100%;
        }
      }
      @media (max-width: 540px) {
        .tabs {
          width: 100%;
        }
        .tabs button {
          padding: 0 10px;
        }
        .detail-top {
          align-items: flex-start;
          flex-direction: column;
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
