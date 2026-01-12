import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { SupabaseService } from 'src/app/services/supabase.service';

@Component({
  selector: 'app-nova-lokacia-modal',
  templateUrl: './nova-lokacia-modal.component.html',
  styleUrls: ['./nova-lokacia-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class NovaLokaciaModalComponent implements OnInit {

  typ: 'sklad' | 'regal' = 'sklad'; // Predvolená záložka
  nazov: string = '';

  // Pre regál potrebujeme vybrať sklad
  vybranySkladId: number | null = null;
  sklady: any[] = [];

  constructor(
    private modalCtrl: ModalController,
    private supabase: SupabaseService,
    private toastCtrl: ToastController
  ) { }

  async ngOnInit() {
    // Načítame zoznam skladov pre výber (ak tvoríme regál)
    try {
      this.sklady = await this.supabase.getSklady();
    } catch (e) {
      console.error(e);
    }
  }

  zmenitTyp(ev: any) {
    this.typ = ev.detail.value;
  }

  zrusit() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  async ulozit() {
    if (!this.nazov) {
      this.toast('Zadajte názov', 'warning');
      return;
    }

    try {
      if (this.typ === 'sklad') {
        await this.supabase.vytvoritSklad(this.nazov);
        this.toast('Sklad vytvorený', 'success');
      } else {
        if (!this.vybranySkladId) {
          this.toast('Vyberte sklad, do ktorého patrí tento regál', 'warning');
          return;
        }
        await this.supabase.vytvoritRegal(this.nazov, this.vybranySkladId);
        this.toast('Regál vytvorený', 'success');
      }

      this.modalCtrl.dismiss(true, 'confirm');

    } catch (e) {
      console.error(e);
      this.toast('Chyba pri vytváraní', 'danger');
    }
  }

  async toast(msg: string, color: string) {
    const t = await this.toastCtrl.create({ message: msg, duration: 2000, color });
    t.present();
  }
}