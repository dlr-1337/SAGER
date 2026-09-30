import { Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OperationsDemoService } from '../operations/operations-demo.service';
import { DemoSessionService } from '../../core/demo-session.service';

type SignatureStep = 'access' | 'review' | 'confirm' | 'result';

@Component({
  standalone: true,
  selector: 'sager-signature',
  imports: [RouterLink, ReactiveFormsModule],
  template: `
    @if (session.active()) {
      <main class="signature-shell">
        <header class="signature-header">
          <img src="/if-goiano-urutai.png" alt="Instituto Federal Goiano, Campus Urutaí" />
          <div><strong>SAGER</strong><span>Autorização de saída longa · Demonstração</span></div>
        </header>
        <div class="signature-content">
          <div class="simulation-banner">
            <span class="material-symbols-outlined" aria-hidden="true">info</span
            ><span
              ><strong>Simulação sem validade jurídica.</strong> Este link e a confirmação existem
              apenas para testar a interface. Nenhuma assinatura eletrônica real é coletada.</span
            >
          </div>
          @if (request(); as exit) {
            <nav class="steps" aria-label="Etapas da autorização">
              <span [class.active]="step() === 'access'" [class.done]="step() !== 'access'"
                >1. Acesso</span
              ><span
                [class.active]="step() === 'review'"
                [class.done]="step() === 'confirm' || step() === 'result'"
                >2. Revisão</span
              ><span [class.active]="step() === 'confirm'" [class.done]="step() === 'result'"
                >3. Confirmação</span
              ><span [class.active]="step() === 'result'">4. Resultado</span>
            </nav>
            @if (step() === 'access' && !exit.signed) {
              <section class="signature-card">
                <span class="icon-well"
                  ><span class="material-symbols-outlined" aria-hidden="true"
                    >description</span
                  ></span
                ><span class="eyebrow">Acesso pelo link demonstrativo</span>
                <h1>Revise uma autorização de saída</h1>
                <p>
                  O residente {{ exit.resident }} solicitou uma saída longa. Confira as informações
                  do documento antes de prosseguir.
                </p>
                <dl class="summary">
                  <div>
                    <dt>Solicitação</dt>
                    <dd>{{ exit.id }}</dd>
                  </div>
                  <div>
                    <dt>Responsável indicado</dt>
                    <dd>{{ exit.guardian }}</dd>
                  </div>
                  <div>
                    <dt>Tipo</dt>
                    <dd>Saída longa</dd>
                  </div>
                </dl>
                <button class="btn" type="button" (click)="step.set('review')">
                  Revisar documento
                  <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                </button>
              </section>
            } @else if (step() === 'review' && !exit.signed) {
              <section class="signature-card">
                <span class="eyebrow">Etapa 2 de 4</span>
                <h1>Revisão do documento</h1>
                <p>
                  Leia as informações demonstrativas da solicitação. Em uma implantação real, o
                  documento versionado e seus anexos seriam exibidos aqui.
                </p>
                <div class="document" aria-label="Resumo do documento de autorização">
                  <div class="document-heading">
                    <span class="material-symbols-outlined" aria-hidden="true">article</span>
                    <div>
                      <strong>Autorização de saída longa</strong
                      ><small>Prévia demonstrativa · solicitação {{ exit.id }}</small>
                    </div>
                  </div>
                  <dl>
                    <div>
                      <dt>Residente</dt>
                      <dd>{{ exit.resident }}</dd>
                    </div>
                    <div>
                      <dt>Responsável legal</dt>
                      <dd>{{ exit.guardian }}</dd>
                    </div>
                    <div>
                      <dt>Motivo informado</dt>
                      <dd>{{ exit.reason }}</dd>
                    </div>
                    <div>
                      <dt>Saída prevista</dt>
                      <dd>{{ format(exit.departure) }}</dd>
                    </div>
                    <div>
                      <dt>Retorno previsto</dt>
                      <dd>{{ format(exit.expectedReturn) }}</dd>
                    </div>
                    <div>
                      <dt>Observações</dt>
                      <dd>{{ exit.notes || 'Não informadas' }}</dd>
                    </div>
                  </dl>
                  <p class="document-footnote">
                    Este resumo não substitui o documento formal. O texto jurídico e o serviço de
                    assinatura dependem de definição institucional.
                  </p>
                </div>
                <div class="action-row">
                  <button class="btn-secondary" type="button" (click)="step.set('access')">
                    Voltar</button
                  ><button class="btn" type="button" (click)="step.set('confirm')">
                    Continuar para confirmação
                  </button>
                </div>
              </section>
            } @else if (step() === 'confirm' && !exit.signed) {
              <section class="signature-card">
                <span class="eyebrow">Etapa 3 de 4</span>
                <h1>Confirmar a simulação</h1>
                <p>
                  Revise a solicitação antes de avançar. A confirmação abaixo não constitui
                  assinatura eletrônica nem autorização jurídica.
                </p>
                <div class="decision-summary">
                  <strong>{{ exit.resident }}</strong
                  ><span
                    >Saída longa · {{ format(exit.departure) }} a
                    {{ format(exit.expectedReturn) }}</span
                  ><span>Responsável indicado: {{ exit.guardian }}</span>
                </div>
                <label class="check-row"
                  ><input type="checkbox" [formControl]="understood" /><span
                    >Entendi que esta é uma confirmação de demonstração, sem validade
                    jurídica.</span
                  ></label
                >
                @if (submitted() && understood.invalid) {
                  <p class="field-error" role="alert">Marque a confirmação para continuar.</p>
                }
                @if (failed()) {
                  <p class="field-error" role="alert">
                    Esta solicitação não está disponível para assinatura simulada.
                  </p>
                }
                <div class="action-row">
                  <button class="btn-secondary" type="button" (click)="step.set('review')">
                    Voltar ao documento</button
                  ><button class="btn" type="button" (click)="confirm(exit.id)">
                    Confirmar simulação
                  </button>
                </div>
              </section>
            } @else {
              <section class="signature-card result-card" role="status">
                <span class="success-icon"
                  ><span class="material-symbols-outlined" aria-hidden="true"
                    >check_circle</span
                  ></span
                ><span class="eyebrow">Etapa concluída na demonstração</span>
                <h1>Confirmação simulada registrada</h1>
                <p>
                  A solicitação {{ exit.id }} foi atualizada neste navegador. A equipe ainda
                  precisará analisar o pedido antes de qualquer aprovação.
                </p>
                <div class="result-warning">
                  <strong>Sem validade jurídica</strong
                  ><span>Nenhum documento foi assinado ou armazenado por um serviço externo.</span>
                </div>
                <a class="btn" routerLink="/saidas">Acompanhar solicitação</a>
              </section>
            }
          } @else {
            <section class="signature-card">
              <span class="icon-well"
                ><span class="material-symbols-outlined" aria-hidden="true">link_off</span></span
              >
              <h1>Link não encontrado</h1>
              <p>
                Este link não corresponde a uma solicitação da demonstração. Volte ao acesso para
                selecionar um perfil.
              </p>
              <a class="btn" routerLink="/demonstracao">Ir para demonstração</a>
            </section>
          }
        </div>
        <footer class="signature-footer">
          SAGER · IF Goiano Campus Urutaí · Ambiente de demonstração
        </footer>
      </main>
    } @else {
      <main class="signature-shell">
        <header class="signature-header">
          <img src="/if-goiano-urutai.png" alt="Instituto Federal Goiano, Campus Urutaí" />
          <div><strong>SAGER</strong><span>Autorização de saída longa</span></div>
        </header>
        <div class="signature-content">
          <section class="signature-card" role="alert">
            <h1>Convite indisponível</h1>
            <p>
              Abra o convite individual mais recente recebido pelo WhatsApp. Se precisar de um novo
              convite, procure a equipe da residência.
            </p>
          </section>
        </div>
        <footer class="signature-footer">SAGER · IF Goiano Campus Urutaí</footer>
      </main>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: #f3f7f2;
        color: #1f3728;
      }
      .signature-shell {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
      .signature-header {
        background: #fff;
        border-bottom: 1px solid #d8e4d9;
        display: flex;
        align-items: center;
        gap: 18px;
        padding: 13px clamp(20px, 4vw, 64px);
      }
      .signature-header img {
        height: 56px;
        width: 140px;
        object-fit: contain;
        object-position: left center;
      }
      .signature-header > div {
        border-left: 1px solid #d5e1d7;
        padding-left: 18px;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .signature-header strong {
        font-size: 1.4rem;
        color: #125637;
        letter-spacing: -0.03em;
      }
      .signature-header span {
        font-size: 0.84rem;
        color: #5c695e;
      }
      .signature-content {
        width: min(850px, calc(100% - 32px));
        margin: 36px auto 60px;
        flex: 1;
      }
      .simulation-banner {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        background: #fff1d9;
        border: 1px solid #e8c983;
        color: #60440b;
        padding: 17px;
        border-radius: 10px;
        line-height: 1.5;
      }
      .simulation-banner .material-symbols-outlined {
        flex: none;
      }
      .steps {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin: 30px 0 22px;
        counter-reset: step;
      }
      .steps span {
        font-size: 0.81rem;
        font-weight: 800;
        color: #69776d;
        padding-bottom: 9px;
        border-bottom: 2px solid #d6e2d8;
        flex: 1;
      }
      .steps span.active,
      .steps span.done {
        color: #155d3b;
        border-color: #197148;
      }
      .signature-card {
        background: #fff;
        border: 1px solid #d8e5da;
        box-shadow: 0 10px 36px #153b2010;
        border-radius: 16px;
        padding: clamp(24px, 5vw, 48px);
      }
      .signature-card h1 {
        font-size: clamp(1.8rem, 3vw, 2.4rem);
        letter-spacing: -0.035em;
        line-height: 1.2;
        margin: 11px 0;
      }
      .signature-card > p {
        color: #526356;
        font-size: 1.04rem;
        line-height: 1.6;
        max-width: 660px;
      }
      .eyebrow {
        font-size: 0.78rem;
        font-weight: 800;
        color: #17683f;
        letter-spacing: 0.09em;
        text-transform: uppercase;
      }
      .icon-well {
        display: grid;
        place-items: center;
        width: 60px;
        height: 60px;
        background: #e7f2e8;
        color: #17683f;
        border-radius: 12px;
        margin-bottom: 24px;
      }
      .icon-well .material-symbols-outlined {
        font-size: 35px;
      }
      .summary,
      .document dl {
        border-top: 1px solid #e1eae2;
        border-bottom: 1px solid #e1eae2;
        margin: 25px 0;
      }
      .summary div,
      .document dl div {
        display: grid;
        grid-template-columns: 160px 1fr;
        gap: 15px;
        padding: 13px 0;
      }
      .summary div + div,
      .document dl div + div {
        border-top: 1px solid #edf1ed;
      }
      dt {
        color: #5a6a5e;
        font-size: 0.87rem;
      }
      dd {
        margin: 0;
        font-weight: 700;
      }
      .document {
        border: 1px solid #d8e3d9;
        border-radius: 12px;
        padding: 25px;
        margin: 25px 0;
        background: #fcfefc;
      }
      .document-heading {
        display: flex;
        align-items: center;
        gap: 13px;
      }
      .document-heading > .material-symbols-outlined {
        font-size: 34px;
        color: #17683f;
      }
      .document-heading strong,
      .document-heading small {
        display: block;
      }
      .document-heading small {
        margin-top: 5px;
        color: #627064;
      }
      .document dl {
        margin: 20px 0;
      }
      .document-footnote {
        font-size: 0.84rem;
        color: #627064;
        line-height: 1.5;
      }
      .decision-summary {
        display: flex;
        flex-direction: column;
        gap: 7px;
        border: 1px solid #cbe2d0;
        background: #f1f8f2;
        padding: 16px;
        margin: 24px 0;
      }
      .decision-summary span {
        color: #4f6053;
      }
      .check-row {
        display: flex;
        gap: 13px;
        align-items: flex-start;
        line-height: 1.5;
        font-weight: 700;
        cursor: pointer;
        padding: 12px 0;
      }
      .check-row input {
        width: 23px;
        height: 23px;
        flex: none;
        accent-color: #17683f;
        margin: 1px 0;
      }
      .field-error {
        color: #9b3025;
        font-weight: 700;
      }
      .action-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 24px;
      }
      .success-icon {
        color: #17683f;
      }
      .success-icon .material-symbols-outlined {
        font-size: 56px;
      }
      .result-warning {
        display: flex;
        flex-direction: column;
        gap: 5px;
        background: #fff2d9;
        color: #62470e;
        border-radius: 9px;
        padding: 15px;
        margin: 23px 0;
      }
      .signature-footer {
        color: #607064;
        text-align: center;
        padding: 20px;
        font-size: 0.8rem;
      }
      @media (max-width: 590px) {
        .signature-header img {
          width: 100px;
          height: 46px;
        }
        .signature-header {
          gap: 10px;
        }
        .signature-header > div {
          padding-left: 10px;
        }
        .signature-header span {
          font-size: 0.72rem;
        }
        .steps span {
          font-size: 0.66rem;
        }
        .summary div,
        .document dl div {
          grid-template-columns: 1fr;
          gap: 4px;
        }
        .document {
          padding: 18px;
        }
        .action-row > * {
          flex: 1;
        }
      }
    `,
  ],
})
export class SignaturePage {
  readonly session = inject(DemoSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly operations = inject(OperationsDemoService);
  readonly id = this.route.snapshot.paramMap.get('token') ?? '';
  readonly request = computed(() => {
    if (!this.session.active()) return null;
    this.operations.exits();
    return this.operations.getExit(this.id);
  });
  readonly step = signal<SignatureStep>('access');
  readonly understood = new FormControl(false, {
    nonNullable: true,
    validators: Validators.requiredTrue,
  });
  readonly submitted = signal(false);
  readonly failed = signal(false);
  format(value: string) {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
      new Date(value),
    );
  }
  confirm(id: string) {
    if (!this.session.active()) return;
    this.submitted.set(true);
    if (this.understood.invalid) return;
    if (!this.operations.signLongExit(id)) {
      this.failed.set(true);
      return;
    }
    this.step.set('result');
  }
}
