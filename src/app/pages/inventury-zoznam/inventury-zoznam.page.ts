import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButtons, IonBackButton, IonButton, IonIcon,
  IonList, IonListHeader, IonItem, IonLabel
} from '@ionic/angular/standalone';

import { AlertController, ToastController, NavController } from '@ionic/angular';
import { SupabaseService, Inventura } from '../../services/supabase.service';
import { addIcons } from 'ionicons';
import { fontRobotoRegular } from 'src/app/font';

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ZMENA: Pridaná ikona 'trash' (kôš), odstránené share ikony
import { add, downloadOutline, printOutline, logOutOutline, trashOutline } from 'ionicons/icons';

@Component({
  selector: 'app-inventury-zoznam',
  standalone: true,
  templateUrl: './inventury-zoznam.page.html',
  styleUrls: ['./inventury-zoznam.page.scss'],
  imports: [
    CommonModule,
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonButtons, IonBackButton, IonButton, IonIcon,
    IonList, IonListHeader, IonItem, IonLabel
  ]
})
export class InventuryZoznamPage implements OnInit {

  zoznam: Inventura[] = [];

  constructor(
    private supabase: SupabaseService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private navCtrl: NavController
  ) {
    addIcons({
      'add': add,
      'download-outline': downloadOutline,
      'print-outline': printOutline,
      'log-out-outline': logOutOutline,
      'trash-outline': trashOutline // Pridaná ikona koša
    });
  }

  async ngOnInit() {
    await this.nacitajZoznam();
  }

  async odhlasit() {
    await this.supabase.signOut();
    this.navCtrl.navigateRoot('/login');
  }

  async nacitajZoznam() {
    try {
      this.zoznam = await this.supabase.getZoznamInventur();
    } catch (e) {
      console.error(e);
    }
  }

  async novaInventura() {
    const otvorena = this.zoznam.find(i => i.stav === 'otvorena');
    if (otvorena) {
      this.toast('Najprv musíte uzavrieť starú inventúru!', 'warning');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Nová Inventúra',
      inputs: [{ name: 'nazov', type: 'text', placeholder: 'Napr. Január 2026' }],
      buttons: [
        { text: 'Zrušiť', role: 'cancel' },
        {
          text: 'Vytvoriť',
          handler: async (data) => {
            if (data.nazov) await this.vytvorit(data.nazov);
          }
        }
      ]
    });
    await alert.present();
  }

  async vytvorit(nazov: string) {
    try {
      await this.supabase.vytvoritInventuru(nazov);
      this.toast('Inventúra vytvorená', 'success');
      this.nacitajZoznam();
    } catch (e) {
      this.toast('Chyba pri vytváraní', 'danger');
    }
  }

  async potvrditUzavretie(inv: Inventura) {
    const alert = await this.alertCtrl.create({
      header: 'Uzavrieť inventúru?',
      message: `Naozaj chcete uzavrieť "${inv.nazov}"? \n\n⚠️ Údaje v živom sklade sa prepíšu!`,
      buttons: [
        { text: 'Zrušiť', role: 'cancel' },
        {
          text: 'Áno, prepísať sklad',
          cssClass: 'alert-danger-button',
          handler: () => { this.vykonatUzavretie(inv.id); }
        }
      ]
    });
    await alert.present();
  }

  async vykonatUzavretie(id: number) {
    try {
      await this.supabase.uzavrietInventuru(id);
      this.toast('Inventúra uzavretá.', 'success');
      this.nacitajZoznam();
    } catch (e) {
      this.toast('Chyba pri uzatváraní.', 'danger');
    }
  }

  // --- NOVÁ FUNKCIA: ZMAZANIE INVENTÚRY ---
  async zmazat(inv: Inventura) {
    const alert = await this.alertCtrl.create({
      header: 'Zmazať inventúru?',
      message: `Naozaj chcete natrvalo odstrániť inventúru "${inv.nazov}"? Táto akcia je nevratná.`,
      buttons: [
        { text: 'Zrušiť', role: 'cancel' },
        {
          text: 'Zmazať',
          role: 'destructive',
          cssClass: 'alert-danger-button',
          handler: async () => {
            try {
              await this.supabase.zmazatInventuru(inv.id);
              this.toast('Inventúra bola odstránená.', 'success');
              this.nacitajZoznam();
            } catch (e) {
              console.error(e);
              this.toast('Chyba pri mazaní.', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async toast(msg: string, color: string) {
    const t = await this.toastCtrl.create({ message: msg, duration: 2500, color, position: 'top' });
    t.present();
  }

  // --- SŤAHOVANIE (Export) ---

  private stiahnutBlob(blob: Blob, nazovSuboru: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nazovSuboru;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  async stiahnutExcel(inv: Inventura) {
    const vysledok = await this.generovatExcelSubor(inv);
    if (vysledok) {
      const excelBuffer = XLSX.write(vysledok.wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      this.stiahnutBlob(blob, vysledok.nazovSuboru);
      this.toast(`Excel stiahnutý.`, 'success');
    }
  }

  async stiahnutPDF(inv: Inventura) {
    const vysledok = await this.generovatPDFDokument(inv);
    if (vysledok) {
      const pdfBlob = vysledok.doc.output('blob');
      this.stiahnutBlob(pdfBlob, vysledok.nazovSuboru);
      this.toast('PDF stiahnuté.', 'success');
    }
  }

  private async generovatExcelSubor(inv: Inventura) {
    try {
      const rawData = await this.supabase.getDetailInventuryPreExport(inv.id);
      if (!rawData || rawData.length === 0) {
        this.toast('Inventúra je prázdna.', 'warning');
        return null;
      }
      const excelData = rawData.map((item: any) => ({
        'Produkt': item['Produkt'],
        'Stav': Number(item['Spočítané Množstvo']),
        'Sklad': item['Sklad'],
        'Regál': item['Regál'],
        'Kategória': item['Kategória'],
        'EAN': item['EAN']
      }));
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventúra');

      const bezpecnyNazov = inv.nazov.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      return { wb, nazovSuboru: `Inventura_${bezpecnyNazov}.xlsx` };
    } catch (e) { return null; }
  }

  private async generovatPDFDokument(inv: Inventura) {
    try {
      const rawData = await this.supabase.getDetailInventuryPreExport(inv.id);
      if (!rawData || rawData.length === 0) {
        this.toast('Inventúra je prázdna.', 'warning');
        return null;
      }
      const doc = new jsPDF();
      doc.addFileToVFS('Roboto-Regular.ttf', fontRobotoRegular);
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
      doc.setFont('Roboto');
      doc.text(`Inventúra: ${inv.nazov}`, 14, 20);

      const bodyData = rawData.map((item: any) => [
        item['Produkt'], `${item['Spočítané Množstvo']}`, item['Sklad'], item['Regál']
      ]);

      autoTable(doc, {
        head: [['Produkt', 'Ks', 'Sklad', 'Regál']],
        body: bodyData,
        startY: 30,
        styles: { font: 'Roboto', fontStyle: 'normal' }
      });

      const bezpecnyNazov = inv.nazov.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      return { doc, nazovSuboru: `Inventura_${bezpecnyNazov}.pdf` };
    } catch (e) { return null; }
  }
}