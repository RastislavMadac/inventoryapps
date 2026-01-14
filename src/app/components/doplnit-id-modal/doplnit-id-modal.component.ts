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
    addIcons({ barcodeOutline, closeOutline, pencilOutline, locationOutline, checkmarkCircleOutline, cubeOutline });
  }

  async ngOnInit() {
    await this.nacitajData();
  }

  async nacitajData() {
    this.isLoading = true;
    try {
      this.polozky = await this.supabase.getPolozkyBezId(this.inventuraId);
    } catch (e) {
      console.error(e);
      this.zobrazToast('Nepodarilo sa načítať položky.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

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
              return false; // Nezatvárať alert
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

      // 2. Vyhodíme položku zo zoznamu
      this.polozky = this.polozky.filter(p => p !== polozka);

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
      duration: 2000,
      color: color,
      position: 'bottom'
    });
    toast.present();
  }
}