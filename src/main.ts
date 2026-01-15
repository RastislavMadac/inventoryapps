import 'zone.js';

import { enableProdMode, isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';
import { provideServiceWorker } from '@angular/service-worker';


if (typeof navigator !== 'undefined') {
  const mockLockRequest = (_name: string, _options: any, callback: any) => {
    if (!callback || typeof _options === 'function') {
      callback = _options;
    }

    return Promise.resolve(callback({ name: _name }));
  };

  try {
    Object.defineProperty(navigator, 'locks', {
      value: { request: mockLockRequest },
      configurable: true,
      writable: true
    });
  } catch (e) {
    if ((navigator as any).locks) {
      try {
        (navigator as any).locks.request = mockLockRequest;
      } catch (err) {
        console.error('Nepodarilo sa prepísať navigator.locks', err);
      }
    } else {
      (navigator as any).locks = { request: mockLockRequest };
    }
  }
}

console.log('🚀 Súbor main.ts sa začal vykonávať!');
if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)), provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          }), provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          }),
  ],
})
  .then(() => {
    console.log('✅ Angular úspešne naštartoval!');
  })
  .catch((err) => {
    console.error('🛑 KRITICKÁ CHYBA PRI ŠTARTE ANGULARU:', err);
  });