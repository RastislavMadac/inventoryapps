import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonItem, IonInput, IonButton, IonIcon, IonSpinner, IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';

import { SupabaseService } from '../../services/supabase.service';
import { NavController, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cubeOutline, refreshOutline } from 'ionicons/icons';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonItem,
    IonInput,
    IonButton,
    IonIcon,
    IonRefresher,        // 🔥 PRIDANÉ
    IonRefresherContent,
    IonSpinner
  ]
})
export class LoginPage {

  email: string = '';
  password: string = '';
  isLoading: boolean = false;

  constructor(
    private supabaseService: SupabaseService,
    private toastController: ToastController,
    private navCtrl: NavController
  ) {
    addIcons({ 'cubeOutline': cubeOutline, 'refreshOutline': refreshOutline });
  }

  async prihlasitSa() {
    if (!this.email || !this.password) {
      this.zobrazToast('Zadajte email a heslo', 'warning');
      return;
    }

    try {
      this.isLoading = true;
      await this.supabaseService.signIn(this.email, this.password);
      this.navCtrl.navigateRoot('/home');

    } catch (error: any) {
      this.zobrazToast('Nesprávny email alebo heslo', 'danger');
      console.error(error);
    } finally {
      this.isLoading = false;
    }
  }

  async zobrazToast(msg: string, color: string) {
    const toast = await this.toastController.create({
      message: msg,
      duration: 2000,
      color: color,
      position: 'top'
    });
    toast.present();
  }
  async tvrdyRefresh(event: any) {
    console.log('Spúšťam čistenie cache a aktualizáciu...');

    // 1. Premažeme Cache prehliadača (PWA)
    if ('caches' in window) {
      try {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(key => caches.delete(key)));
        console.log('Cache bola úspešne premazaná.');
      } catch (err) {
        console.warn('Chyba pri čistení cache:', err);
      }
    }

    // 2. Dokončíme animáciu točenia
    event.target.complete();

    // 3. Natvrdo obnovíme (re-loadneme) celú stránku
    window.location.reload();
  }

}