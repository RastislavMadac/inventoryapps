import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, AlertController, ToastController } from '@ionic/angular';
import { SupabaseService } from 'src/app/services/supabase.service';
import { addIcons } from 'ionicons';
import {
  barcodeOutline,
  closeOutline,
  pencilOutline,
  locationOutline,
  checkmarkCircleOutline,
  checkmarkCircle, // Pridaná plná ikona pre hotový stav
  cubeOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-doplnit-id-modal',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule],
  templateUrl: './doplnit-id-modal.component.html',
  styleUrls: ['./doplnit-id-modal.component.scss']
})
export class DoplnitIdModalComponent implements OnInit {
  @Input() inventuraId!: number;

  polozky: any[] = [];
  isLoading = true;

  constructor(
    private modalCtrl: ModalController,
    private supabase: SupabaseService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {
    // Pridaný checkmarkCircle
    addIcons({ barcodeOutline, closeOutline, pencilOutline, locationOutline, checkmarkCircleOutline, checkmarkCircle, cubeOutline });
  }

  async ngOnInit() {
    await this.nacitajData();
  }

  async nacitajData() {
    this.isLoading = true;
    try {
      this.polozky = await this.supabase.getPolozkyBezId(this.inventuraId);
      // Inicializujeme stav pre UI, ak by náhodou už nejaké ID mali (pre istotu)
      this.polozky.forEach(p => p.sparovane = !!p.produkt.vlastne_id);
    } catch (e) {
      console.error(e);
      this.zobrazToast('Nepodarilo sa načítať položky.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  // --- 1. NOVÁ FUNKCIA: Úprava názvu ---
  async upravitNazov(polozka: any) {
    const alert = await this.alertCtrl.create({
      header: 'Upraviť názov produktu',
      inputs: [
        {
          name: 'novyNazov',
          type: 'text',
          value: polozka.produkt.nazov, // Predvyplníme aktuálny názov
          placeholder: 'Zadajte správny názov'
        }
      ],
      buttons: [
        { text: 'Zrušiť', role: 'cancel' },
        {
          text: 'Uložiť',
          handler: async (data) => {
            if (data.novyNazov && data.novyNazov.trim() !== '') {
              await this.ulozitNovyNazovDoDB(polozka, data.novyNazov);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async ulozitNovyNazovDoDB(polozka: any, novyNazov: string) {
    try {
      // Tu voláme update funkciu v Supabase (musíte ju mať v service, príklad nižšie)
      // await this.supabase.updateProdukt(polozka.produkt.id, { nazov: novyNazov });

      // Pre účely tohto kódu predpokladám existenciu updateProdukt alebo podobnej metódy:
      const { error } = await this.supabase.supabase
        .from('produkty')
        .update({ nazov: novyNazov })
        .eq('id', polozka.produkt.id);

      if (error) throw error;

      // Aktualizujeme lokálne dáta, aby sa zmena prejavila hneď
      polozka.produkt.nazov = novyNazov;
      this.zobrazToast('Názov upravený', 'success');

    } catch (e) {
      console.error(e);
      this.zobrazToast('Chyba pri zmene názvu', 'danger');
    }
  }

  // --- 2. UPRAVENÁ FUNKCIA: Zadávanie ID ---
  async otvoritZapis(polozka: any) {
    const alert = await this.alertCtrl.create({
      header: 'Zadajte Product ID',
      subHeader: polozka.produkt.nazov,
      message: 'Zadajte EAN alebo vlastný kód:',
      inputs: [
        {
          name: 'noveId',
          type: 'text',
          placeholder: 'Napr. 10052'
        }
      ],
      buttons: [
        { text: 'Zrušiť', role: 'cancel' },
        {
          text: 'Uložiť',
          handler: (data) => {
            if (data.noveId) {
              this.uloziIdDoDatabazy(polozka, data.noveId);
            } else {
              this.zobrazToast('Musíte zadať ID', 'warning');
              return false;
            }
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  async uloziIdDoDatabazy(polozka: any, noveId: string) {
    try {
      // 1. Uložíme do DB
      await this.supabase.aktualizovatProductId(polozka.produkt.id, noveId);

      // 2. ZMENA: Nevyhadzujeme zo zoznamu, ale označíme ako spárované
      // this.polozky = this.polozky.filter(p => p !== polozka); <--- TOTO SME ZMAZALI

      polozka.sparovane = true;         // Príznak pre CSS triedu (zelená farba)
      polozka.produkt.vlastne_id = noveId; // Aktualizujeme dáta

      // 3. Info užívateľovi
      this.zobrazToast('ID úspešne uložené', 'success');

    } catch (error) {
      console.error(error);
      this.zobrazToast('Chyba pri ukladaní ID', 'danger');
    }
  }

  zavriet() {
    this.modalCtrl.dismiss();
  }

  async zobrazToast(msg: string, color: string) {
    const toast = await this.toastCtrl.create({
      message: msg,
      duration: 1500, // Skrátený čas pre lepší UX
      color: color,
      position: 'bottom'
    });
    toast.present();
  }
}