import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { idCardOutline, addCircleOutline } from 'ionicons/icons';
import { SupabaseService } from 'src/app/services/supabase.service';


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

    addIcons({
      'id-card-outline': idCardOutline,
      'add-circle-outline': addCircleOutline
    });
  }

  async ngOnInit() {
    await this.nacitajData();
    this.naplnitFormular();
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

  async naplnitFormular() {
    if (this.produktNaUpravu) {
      console.log('✏️ Režim úpravy pre:', this.produktNaUpravu.nazov);

      // 1. Zistíme, či už máme ID, alebo ho musíme nájsť podľa názvu
      let kategoriaId = this.produktNaUpravu.kategoria_id || this.produktNaUpravu.kategoria?.id;

      // Ak ID nemáme (je null/undefined), ale máme názov kategórie (string)
      if (!kategoriaId && this.produktNaUpravu.kategoria) {
        // Skúsime nájsť kategóriu v zozname podľa názvu
        const najdenaKategoria = this.kategorie.find(k => k.nazov === this.produktNaUpravu.kategoria);

        if (najdenaKategoria) {
          kategoriaId = najdenaKategoria.id;
          console.log(`✅ Spároval som kategóriu "${this.produktNaUpravu.kategoria}" s ID: ${kategoriaId}`);
        }
      }

      // 2. Naplníme formulár
      this.produkt = {
        nazov: this.produktNaUpravu.nazov,
        vlastne_id: this.produktNaUpravu.vlastne_id || this.produktNaUpravu.ean || '',

        // Použijeme zistené ID
        kategoria_id: kategoriaId,

        jednotka: this.produktNaUpravu.jednotka || 'ks',
        balenie_ks: this.produktNaUpravu.balenie_ks || 1
      };

      // 3. Nastavenie Skladu a Regálu (pre presun)
      if (this.produktNaUpravu.sklad_id) {
        this.vybranySkladId = this.produktNaUpravu.sklad_id;

        // Musíme počkať, kým sa načítajú regály pre tento sklad
        await this.onSkladChange();

        this.vybranyRegalId = this.produktNaUpravu.regal_id;
      }
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


  async ulozit() {
    if (!this.produkt.nazov) {
      this.toast('Zadajte názov produktu', 'warning');
      return;
    }

    try {
      if (this.produktNaUpravu) {

        await this.supabase.updateProdukt(this.produktNaUpravu.id, this.produkt);

        this.toast('Produkt bol úspešne upravený', 'success');


        const dataNaVratenie = {
          ...this.produkt,
          regal_id: this.vybranyRegalId
        };

        this.modalCtrl.dismiss(dataNaVratenie, 'confirm');

      } else {

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



  zrusit() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  async toast(msg: string, color: string) {
    const t = await this.toastCtrl.create({ message: msg, duration: 2000, color });
    t.present();
  }


  async otvoritNovuKategoriu() {
    const modal = await this.modalCtrl.create({
      component: NovaKategoriaModalComponent,
      initialBreakpoint: 0.4,
      breakpoints: [0, 0.4, 0.6]
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm' && data) {

      const katData = await this.supabase.getKategorie();
      this.kategorie = katData || [];


      this.produkt.kategoria_id = data.id;
    }
  }


  async otvoritNovuLokaciu() {
    const modal = await this.modalCtrl.create({
      component: NovaLokaciaModalComponent,
      initialBreakpoint: 0.6,
      breakpoints: [0, 0.6, 0.9]
    });

    await modal.present();

    const { role } = await modal.onWillDismiss();

    if (role === 'confirm') {

      await this.nacitajData();


      if (this.vybranySkladId) {
        await this.onSkladChange();
      }
    }
  }
}