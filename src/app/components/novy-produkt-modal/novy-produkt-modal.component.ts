import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { idCardOutline, addCircleOutline } from 'ionicons/icons';
import { SupabaseService } from 'src/app/services/supabase.service';

// IMPORTY MODALOV
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

  @Input() produktNaUpravu: any = null;

  produkt = {
    nazov: '',
    vlastne_id: '',
    kategoria_id: null,
    jednotka: 'ks', // Zmenil som predvolenú na 'ks', ale kľudne dajte 'kg'
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
    this.naplnitFormular();
  }

  // --- 1. NAČÍTANIE DÁT (Kategórie, Sklady) ---
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

  // --- 2. NAPLNENIE FORMULÁRA PRI ÚPRAVE ---
  naplnitFormular() {
    if (this.produktNaUpravu) {
      console.log('✏️ Režim úpravy pre:', this.produktNaUpravu.nazov);

      this.produkt = {
        nazov: this.produktNaUpravu.nazov,
        // Ak v objekte 'vlastne_id' neexistuje, skúsime pozrieť 'ean', inak prázdny string
        vlastne_id: this.produktNaUpravu.vlastne_id || this.produktNaUpravu.ean || '',

        // Ošetrenie: buď je kategoria objekt, alebo priamo ID
        kategoria_id: this.produktNaUpravu.kategoria?.id || this.produktNaUpravu.kategoria_id,

        jednotka: this.produktNaUpravu.jednotka || 'ks',
        balenie_ks: this.produktNaUpravu.balenie_ks || 1
      };

      // Poznámka: Pri úprave produktu väčšinou nemeníme jeho polohu cez tento formulár,
      // ale ak by ste chceli, museli by ste tu naplniť aj vybranySkladId a vybranyRegalId.
    }
  }

  // --- 3. ZMENA SKLADU (Načítanie regálov) ---
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

  // --- 4. ULOŽENIE (Vytvorenie alebo Úprava) ---
  async ulozit() {
    if (!this.produkt.nazov) {
      this.toast('Zadajte názov produktu', 'warning');
      return;
    }

    try {
      if (this.produktNaUpravu) {
        // 🅰️ REŽIM ÚPRAVY (UPDATE)
        // Voláme funkciu updateProdukt, ktorú sme pridali do service
        await this.supabase.updateProdukt(this.produktNaUpravu.id, this.produkt);
        this.toast('Produkt bol úspešne upravený', 'success');
        this.modalCtrl.dismiss(true, 'confirm'); // Vrátime true, že sa niečo zmenilo

      } else {
        // 🅱️ REŽIM VYTVÁRANIA (INSERT)
        const novy = await this.supabase.vytvoritProduktSLocation(
          this.produkt,
          this.vybranyRegalId
        );

        this.toast('Produkt vytvorený a priradený.', 'success');
        this.modalCtrl.dismiss({ ...novy, regal_id: this.vybranyRegalId }, 'confirm');
      }

    } catch (e) {
      console.error(e);
      this.toast('Chyba pri ukladaní.', 'danger');
    }
  }

  // --- POMOCNÉ FUNKCIE ---

  zrusit() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  async toast(msg: string, color: string) {
    const t = await this.toastCtrl.create({ message: msg, duration: 2000, color });
    t.present();
  }

  // --- MODAL: NOVÁ KATEGÓRIA ---
  async otvoritNovuKategoriu() {
    const modal = await this.modalCtrl.create({
      component: NovaKategoriaModalComponent,
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

  // --- MODAL: NOVÁ LOKÁCIA (SKLAD/REGÁL) ---
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

      // Ak už bol vybraný sklad, obnovíme aj regále
      if (this.vybranySkladId) {
        await this.onSkladChange();
      }
    }
  }
}