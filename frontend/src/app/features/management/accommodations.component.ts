import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { accommodationErrorMessage } from './accommodation-api.service';
import { AccommodationDataService } from './accommodation-data.service';
import { Accommodation } from './housing.models';

@Component({
  selector: 'app-accommodations',
  styleUrl: './housing.scss',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page">
      <header class="mg-heading">
        <div>
          <a class="mg-back" routerLink="/quartos"
            ><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span> Mapa de
            quartos</a
          >
          <h1>Alojamentos</h1>
          <p>Organize residências e suas casas ou blocos.</p>
        </div>
        @if (canEdit()) {
          <a class="btn mg-primary" routerLink="/alojamentos/novo"
            ><span class="material-symbols-rounded" aria-hidden="true">add</span> Cadastrar
            alojamento</a
          >
        }
      </header>
      @if (loading()) {
        <section class="mg-empty" role="status" aria-live="polite">
          <h2>Carregando alojamentos</h2>
          <p>Consultando os cadastros.</p>
        </section>
      } @else if (error()) {
        <section class="mg-empty" role="alert">
          <h2>Não foi possível carregar os alojamentos</h2>
          <p>{{ error() }}</p>
          <button class="btn mg-primary" type="button" (click)="load()">Tentar novamente</button
          ><a class="mg-back" routerLink="/acesso">Acesso local</a>
        </section>
      } @else if (!items().length) {
        <section class="mg-empty" role="status">
          <span class="material-symbols-rounded" aria-hidden="true">domain</span>
          <h2>Nenhum alojamento cadastrado</h2>
          <p>O mapa começa vazio. Cadastre um alojamento antes de adicionar quartos.</p>
        </section>
      } @else {
        <section class="panel mg-panel" aria-labelledby="accommodation-list-title">
          <h2 id="accommodation-list-title">Alojamentos cadastrados</h2>
          <div class="mg-list">
            @for (item of items(); track item.id) {
              <article class="mg-row">
                <div class="mg-avatar" aria-hidden="true">
                  <span class="material-symbols-rounded">domain</span>
                </div>
                <div class="mg-row-main">
                  <h3>{{ item.name }}</h3>
                  <p>Código {{ item.code }}</p>
                </div>
                <a class="mg-row-link" [routerLink]="['/alojamentos', item.id]"
                  >Ver alojamento
                  <span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></a
                >
              </article>
            }
          </div>
        </section>
      }
      <div class="mg-note">
        <span class="material-symbols-rounded" aria-hidden="true">info</span>
        <p>
          {{
            isDemo()
              ? 'Estes cadastros são fictícios e permanecem somente nesta demonstração.'
              : 'Ambiente local de teste: use apenas dados fictícios. Moradores e vagas livres ainda não estão integrados.'
          }}
        </p>
      </div>
    </main>
  `,
})
export class AccommodationsComponent {
  private readonly data = inject(AccommodationDataService);
  private readonly session = inject(DemoSessionService);
  readonly canEdit = computed(() => this.session.hasRole('gestor'));
  readonly isDemo = this.session.active;
  readonly items = signal<Accommodation[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  constructor() {
    void this.load();
  }
  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.items.set(await this.data.list());
    } catch (error) {
      this.items.set([]);
      this.error.set(accommodationErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
