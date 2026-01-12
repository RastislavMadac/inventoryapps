import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { barcodeOutline } from 'ionicons/icons';
import { SupabaseService } from 'src/app/services/supabase.service';

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
    ean: '',
    kategoria_id: null,
    jednotka: 'ks',
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
    addIcons({ 'barcode-Outline': barcodeOutline });
  }

  async ngOnInit() {
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
}