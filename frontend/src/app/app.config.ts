import {
  ApplicationConfig,
  importProvidersFrom,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { Router, provideRouter, withPreloading } from '@angular/router';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialogModule } from '@angular/material/dialog';
import { routes, SagerPreloading } from './app.routes';
import { onUnauthorized, resetSession } from './core/api';
import { LocalAuthService, SESSION_SIGNAL } from './core/local-auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withPreloading(SagerPreloading)),
    { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
    importProvidersFrom(MatDialogModule),
    provideAppInitializer(() => {
      const auth = inject(LocalAuthService);
      const router = inject(Router);
      // Sem usuário conhecido (senha errada, /auth/me da abertura, demonstração), nada a fazer.
      onUnauthorized(
        () => {
          if (!auth.principal()) return;
          auth.clearPrincipal();
          void router.navigateByUrl('/acesso');
        },
        () => auth.principal()?.id ?? null,
      );
      // Outra aba entrou ou saiu com o mesmo cookie: a tela passa a mostrar a conta do servidor.
      window.addEventListener('storage', async (event) => {
        const known = auth.principal()?.id;
        if (event.key !== SESSION_SIGNAL || !known) return;
        resetSession();
        const now = await auth.refresh();
        if (now?.id !== known) void router.navigateByUrl(now ? '/inicio' : '/acesso');
      });
    }),
  ],
};
