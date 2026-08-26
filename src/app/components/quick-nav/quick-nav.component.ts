import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router'; // 👈 Pridaný Router
import {
  IonButton, IonIcon, PopoverController, IonList, IonItem, IonLabel
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  appsOutline, homeOutline, layersOutline,
  clipboardOutline, statsChartOutline, gridOutline, checkmarkDoneOutline
} from 'ionicons/icons';



// ==========================================
// 1. KOMPONENT PRE OBSAH MENU (Zoznam položiek)
// ==========================================
@Component({
  selector: 'app-quick-nav-content',
  standalone: true,
  imports: [CommonModule, IonList, IonItem, IonIcon, IonLabel],
  template: `
    <ion-list lines="none" class="nav-list">
      
      <ion-item button detail="false" (click)="navigovat('/home')">
        <ion-icon name="home-outline" slot="start" color="primary"></ion-icon>
        <ion-label>Domov</ion-label>
      </ion-item>

    

        <ion-item button detail="false" class="sub-item" (click)="navigovat('/inventory', { rezim: 'regal' })">
        <ion-icon name="layers-outline" slot="start" color="medium"></ion-icon>
        <ion-label>↳ Živý Sklad (Regál) </ion-label>
      </ion-item>

      <ion-item button detail="false" class="sub-item" (click)="navigovat('/inventory', { rezim: 'global' })">
        <ion-icon name="grid-outline" slot="start" color="medium"></ion-icon>
        <ion-label>↳ Všetky Položky</ion-label>
      </ion-item>

      <ion-item button detail="false" class="sub-item" (click)="navigovat('/inventory', { sekcia: 'v_inventure' })">
        <ion-icon name="checkmark-done-outline" slot="start" color="success"></ion-icon>
        <ion-label>↳ Hotové (v inventúre)</ion-label>
      </ion-item>

      <ion-item button detail="false" (click)="navigovat('/inventury-zoznam')">
        <ion-icon name="clipboard-outline" slot="start" color="success"></ion-icon>
        <ion-label>Inventúry</ion-label>
      </ion-item>

      <ion-item button detail="false" (click)="navigovat('/dashboard')">
        <ion-icon name="stats-chart-outline" slot="start" color="tertiary"></ion-icon>
        <ion-label>Dashboard</ion-label>
      </ion-item>

      <!-- Rýchly prechod priamo do modálu validácie -->
<ion-item button detail="false" class="sub-item" (click)="navigovat('/dashboard', { otvoritValidaciu: 'true' })">
  <ion-icon name="warning-outline" slot="start" color="danger"></ion-icon>
  <ion-label>↳ Excel Validácia</ion-label>
</ion-item>

    </ion-list>
  `,
  styles: [`
    .nav-list { padding: 4px 0; }
    .nav-list ion-item { --padding-start: 16px; --min-height: 44px; font-weight: 500; font-size: 0.95rem; }
    .nav-list ion-item.sub-item { --padding-start: 28px; font-size: 0.85rem; font-weight: 400; --min-height: 38px; }
    .nav-list ion-item.sub-item ion-icon { font-size: 1.2rem; }
  `]
})
export class QuickNavContentComponent {
  constructor(
    private popoverCtrl: PopoverController,
    private router: Router
  ) {
    // Registrácia ikon priamo vo vnorenom komponente pre istotu
    addIcons({
      appsOutline, homeOutline, layersOutline,
      clipboardOutline, statsChartOutline, gridOutline, checkmarkDoneOutline
    });
  }

  // 🔥 TOTO JE KĽÚČOVÁ OPRAVA 🔥
  async navigovat(cesta: string, params: any = {}) {
    // 1. Najprv asynchrónne počkáme na ÚPLNÉ zatvorenie a upratanie popoveru z DOMu
    await this.popoverCtrl.dismiss();

    // 2. Až potom presmerujeme užívateľa cez Angular Router
    this.router.navigate([cesta], { queryParams: params });
  }
}

// ==========================================
// 2. HLAVNÝ KOMPONENT (Tlačidlo v hlavičke)
// ==========================================
@Component({
  selector: 'app-quick-nav',

  standalone: true,
  imports: [CommonModule, IonButton, IonIcon],
  templateUrl: './quick-nav.component.html'
})
export class QuickNavComponent {
  constructor(private popoverCtrl: PopoverController) {
    addIcons({
      appsOutline, homeOutline, layersOutline,
      clipboardOutline, statsChartOutline, gridOutline, checkmarkDoneOutline
    });
  }

  async otvoritMenu(ev: any) {
    console.log('🟢 KROK 1: Tlačidlo menu bolo stlačené. Event:', ev);

    try {
      console.log('🟡 KROK 2: Požiadavka na PopoverController odoslaná...');

      const popover = await this.popoverCtrl.create({
        component: QuickNavContentComponent,
        event: ev,
        alignment: 'end',
        mode: 'ios'
      });

      console.log('🟠 KROK 3: Popover objekt bol v pamäti úspešne vytvorený:', popover);

      await popover.present();

      console.log('🟢 KROK 4: Popover bol zavolaný na vykreslenie do DOMu.');

    } catch (error) {
      console.error('❌ KRITICKÁ CHYBA pri vytváraní Popoveru:', error);
    }
  }
}