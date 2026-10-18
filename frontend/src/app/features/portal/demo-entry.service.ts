import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { LocalAuthService } from '../../core/local-auth.service';

export type DemoRole = 'gestor' | 'supervisor' | 'residente';

// Fornecido por página (providers do componente): cada tela tem o próprio estado de envio e erro.
@Injectable()
export class DemoEntry {
  private readonly session = inject(DemoSessionService);
  private readonly auth = inject(LocalAuthService);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly options = [
    {
      role: 'supervisor' as const,
      icon: 'assignment_turned_in',
      title: 'Supervisor',
      description: 'Chamada, saídas, retornos, notificações e limpeza.',
    },
    {
      role: 'gestor' as const,
      icon: 'apartment',
      title: 'Gestor',
      description: 'Cadastros, quartos, acompanhamento e relatórios.',
    },
    {
      role: 'residente' as const,
      icon: 'home',
      title: 'Residente',
      description: 'Minhas saídas, avisos, advertências e ranking.',
    },
  ];

  async choose(role: DemoRole): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      // Revalida o cookie: numa aba nova ainda não existe principal em memória.
      if (await this.auth.refresh()) {
        try {
          await this.auth.logout();
        } catch {
          this.error.set('Não foi possível encerrar a sessão local. Tente novamente.');
          return;
        }
      }
      this.session.activate(role);
      await this.router.navigateByUrl('/inicio');
    } finally {
      this.busy.set(false);
    }
  }
}
