import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { decimal } from '../cleaning/cleaning-local.utils';
import { OperationsDemoService } from './operations-demo.service';

@Component({
  standalone: true,
  selector: 'app-cleaning',
  imports: [SearchableSelectDirective, CommonModule, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page op-narrow">
      @if (session.hasRole('supervisor')) {
        <header class="op-heading">
          <div>
            <a routerLink="/inicio" class="op-back">← Início</a>
            <h1>Avaliação de limpeza</h1>
            <p>Explore o feedback imediato da avaliação de um quarto.</p>
          </div>
          <span class="op-demo-label">Simulação</span>
        </header>
        <section class="op-alert-panel" role="note">
          <span class="material-symbols-outlined" aria-hidden="true">rule</span>
          <div>
            <h2>Regras da avaliação</h2>
            <p>
              A nota é a média dos quatro critérios (piso, superfícies, resíduos e organização), de
              0 a 10, com duas casas decimais. Uma nota abaixo de 6,00 gera ocorrência para análise.
              São políticas locais que aguardam o aceite da Assistência Estudantil.
            </p>
          </div>
        </section>
        <section class="panel op-panel" aria-labelledby="cleaning-form-title">
          <h2 id="cleaning-form-title">Escolher cenário de avaliação</h2>
          <p>
            Selecione um quarto cadastrado no cenário sintético. Cada opção possui um resultado
            preparado para demonstrar o retorno visual após salvar.
          </p>
          <label class="field"
            >Quarto<select sagerSearchable [formControl]="room">
              <option value="">Selecione um quarto</option>
              @for (scenario of service.cleaningScenarios; track scenario.room) {
                <option [value]="scenario.room">{{ scenario.room }} · {{ scenario.label }}</option>
              }
            </select></label
          >
          @if (error()) {
            <p class="op-error" role="alert">{{ error() }}</p>
          }
          <div class="op-actions">
            <button class="btn op-primary" type="button" (click)="save()">
              <span class="material-symbols-outlined" aria-hidden="true">task_alt</span> Simular
              avaliação
            </button>
          </div>
        </section>
        @if (service.cleaningFeedback(); as result) {
          <section
            class="panel op-panel op-feedback"
            aria-labelledby="cleaning-feedback-title"
            role="status"
          >
            <div class="op-section-heading">
              <h2 id="cleaning-feedback-title">Avaliação demonstrativa salva</h2>
              <span class="op-demo-label">Valores ilustrativos</span>
            </div>
            <p>Quarto {{ result.room }} · {{ result.date | date: 'dd/MM/yyyy, HH:mm' }}</p>
            <dl class="op-call-summary">
              <div>
                <dt>Nota anterior</dt>
                <dd>
                  {{
                    result.previous === null ? 'Sem avaliação anterior' : decimal(result.previous)
                  }}
                </dd>
              </div>
              <div>
                <dt>Nova nota</dt>
                <dd>{{ decimal(result.next) }}</dd>
              </div>
              <div>
                <dt>Variação</dt>
                <dd>
                  {{
                    result.previous === null
                      ? 'Não se aplica'
                      : decimal(result.next - result.previous) + ' ponto(s)'
                  }}
                </dd>
              </div>
              <div>
                <dt>Posição demonstrativa</dt>
                <dd>{{ result.position }}ª</dd>
              </div>
            </dl>
            <p class="op-help">
              Esta posição foi preparada para a demonstração. No ranking, quartos com a mesma nota
              ficam na mesma posição.
            </p>
          </section>
        }
        <div class="op-actions">
          <a class="btn op-secondary" routerLink="/ranking">Consultar ranking demonstrativo</a>
        </div>
      } @else {
        <section class="op-empty" role="alert">
          <h1>Acesso restrito</h1>
          <p>A avaliação de limpeza é registrada pelo supervisor.</p>
          <a class="btn op-primary" routerLink="/inicio">Voltar ao início</a>
        </section>
      }
    </main>
  `,
})
export class CleaningComponent {
  readonly service = inject(OperationsDemoService);
  readonly session = inject(DemoSessionService);
  readonly decimal = decimal;
  readonly room = new FormControl('', { nonNullable: true });
  readonly error = signal('');
  save(): void {
    this.error.set('');
    if (!this.service.saveCleaningScenario(this.room.value))
      this.error.set('Selecione um quarto para simular a avaliação.');
  }
}
