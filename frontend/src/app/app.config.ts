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
import { onUnauthorized } from './core/api';
import { LocalAuthService } from './core/local-auth.service';

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
      onUnauthorized(() => {
        if (!auth.principal()) return;
        auth.clearPrincipal();
        void router.navigateByUrl('/acesso');
      });
    }),
  ],
};
