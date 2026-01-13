import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
// Pridaný import addCircleOutline
import { idCardOutline, addCircleOutline } from 'ionicons/icons';
import { SupabaseService } from 'src/app/services/supabase.service';

// IMPORT MODALU PRE NOVÚ LOKÁCIU
import { NovaLokaciaModalComponent } from '../nova-lokacia-modal/nova-lokacia-modal.component';
import { NovaKategoriaModalComponent } from '../nova-kategoria-modal/nova-kategoria-modal.component';
@Component({
  selector: 'app-novy-produkt-modal',
  templateUrl: './novy-produkt-modal.component.html',
  styleUrls: ['./novy-produkt-modal.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class NovyProduktModalComponent implements OnInit {

  produkt = {
    nazov: '',
    vlastne_id: '',
    kategoria_id: null,
    jednotka: 'kg',
    balenie_ks: 1
  };

  kategorie: any[] = [];
  sklady: any[] = [];
  regaly: any[] = [];

  vybranySkladId: number | null = null;
  vybranyRegalId: number | null = null;

  constructor(
    private modalCtrl: ModalController,
    private supabase: SupabaseService,
    private toastCtrl: ToastController
  ) {
    // Registrácia ikon
    addIcons({
      'id-card-outline': idCardOutline,
      'add-circle-outline': addCircleOutline
    });
  }

  async ngOnInit() {
    await this.nacitajData();
  }

  async nacitajData() {
    try {
      const [katData, skladyData] = await Promise.all([
        this.supabase.getKategorie(),
        this.supabase.getSklady()
      ]);

      this.kategorie = katData || [];
      this.sklady = skladyData || [];
    } catch (e) {
      console.error(e);
      this.toast('Nepodarilo sa načítať dáta.', 'danger');
    }
  }

  async onSkladChange() {
    this.vybranyRegalId = null;
    this.regaly = [];

    if (this.vybranySkladId) {
      try {
        this.regaly = await this.supabase.getRegaly(this.vybranySkladId);
      } catch (e) {
        console.error(e);
      }
    }
  }

  // --- NOVÁ FUNKCIA NA OTVORENIE MODALU LOKÁCIE ---
  async otvoritNovuLokaciu() {
    const modal = await this.modalCtrl.create({
      component: NovaLokaciaModalComponent,
      initialBreakpoint: 0.6,
      breakpoints: [0, 0.6, 0.9]
    });

    await modal.present();

    const { role } = await modal.onWillDismiss();

    if (role === 'confirm') {
      // Obnovíme zoznam skladov
      await this.nacitajData();

      // Ak už bol vybraný sklad, obnovíme aj regále (pre prípad, že pribudol regál)
      if (this.vybranySkladId) {
        await this.onSkladChange();
      }
    }
  }
  // -----------------------------------------------

  zrusit() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  async ulozit() {
    if (!this.produkt.nazov) return;

    try {
      const novy = await this.supabase.vytvoritProduktSLocation(
        this.produkt,
        this.vybranyRegalId
      );

      this.toast('Produkt vytvorený a priradený.', 'success');
      this.modalCtrl.dismiss({ ...novy, regal_id: this.vybranyRegalId }, 'confirm');

    } catch (e) {
      console.error(e);
      this.toast('Chyba pri vytváraní produktu.', 'danger');
    }
  }

  async toast(msg: string, color: string) {
    const t = await this.toastCtrl.create({ message: msg, duration: 2000, color });
    t.present();
  }

  async otvoritNovuKategoriu() {
    const modal = await this.modalCtrl.create({
      component: NovaKategoriaModalComponent,
      // Nastavíme menšiu výšku (iOS štýl)
      initialBreakpoint: 0.4,
      breakpoints: [0, 0.4, 0.6]
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm' && data) {
      // 1. Obnovíme zoznam kategórií
      const katData = await this.supabase.getKategorie();
      this.kategorie = katData || [];

      // 2. Automaticky vyberieme tú novú
      this.produkt.kategoria_id = data.id;
    }
  }
}