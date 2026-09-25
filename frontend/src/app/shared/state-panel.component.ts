import { Component, computed, input, output } from '@angular/core';

export type ViewState = 'loading' | 'empty' | 'error' | 'forbidden' | 'success';

const defaults: Record<ViewState, { title: string; description: string; icon: string }> = {
  loading: { title: 'Carregando informações', description: 'Aguarde um momento.', icon: 'progress_activity' },
  empty: { title: 'Nenhum resultado encontrado', description: 'Altere os filtros ou tente outra busca.', icon: 'inbox' },
  error: { title: 'Não foi possível carregar', description: 'Tente novamente. Se o problema continuar, procure a equipe de apoio.', icon: 'error' },
  forbidden: { title: 'Acesso não permitido', description: 'Este perfil não tem permissão para abrir esta tela.', icon: 'lock' },
  success: { title: 'Tudo pronto', description: 'A ação foi concluída nesta demonstração.', icon: 'check_circle' },
};

@Component({
  selector: 'app-state-panel',
  standalone: true,
  template: `
    <section class="state-panel" [attr.role]="state() === 'error' ? 'alert' : 'status'" [attr.aria-busy]="state() === 'loading'">
      <span class="state-icon material-symbols-rounded" aria-hidden="true">{{ preset().icon }}</span>
      <h2>{{ title() || preset().title }}</h2>
      <p>{{ description() || preset().description }}</p>
      @if (actionLabel() && state() !== 'loading') {
        <button type="button" class="btn-secondary" (click)="action.emit()">{{ actionLabel() }}</button>
      }
    </section>
  `,
  styles: [`
    .state-panel { min-height: 250px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 28px; background: #fff; border: 1px solid var(--line); border-radius: 14px; }
    .state-icon { color: var(--green-800); font-size: 42px; margin-bottom: 12px; }
    .state-panel[role='alert'] .state-icon { color: var(--danger); }
    h2 { margin-bottom: 6px; font-size: 1.28rem; }
    p { color: var(--muted); margin-bottom: 0; }
    button { margin-top: 18px; }
  `],
})
export class StatePanelComponent {
  readonly state = input.required<ViewState>();
  readonly title = input('');
  readonly description = input('');
  readonly actionLabel = input('');
  readonly action = output<void>();
  protected readonly preset = computed(() => defaults[this.state()]);
}
