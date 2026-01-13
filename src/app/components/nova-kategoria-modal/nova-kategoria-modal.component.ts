import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { SupabaseService } from 'src/app/services/supabase.service';

@Component({
  selector: 'app-nova-kategoria-modal',
  templateUrl: './nova-kategoria-modal.component.html',
  styleUrls: ['./nova-kategoria-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class NovaKategoriaModalComponent {

  nazov: string = '';

  constructor(
    private modalCtrl: ModalController,
    private supabase: SupabaseService,
    private toastCtrl: ToastController
  ) { }

  zrusit() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  async ulozit() {
    if (!this.nazov.trim()) {
      this.toast('Zadajte názov kategórie', 'warning');
      return;
    }

    try {
      const novaKategoria = await this.supabase.vytvoritKategoriu(this.nazov);
      this.toast('Kategória vytvorená', 'success');
      this.modalCtrl.dismiss(novaKategoria, 'confirm');
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