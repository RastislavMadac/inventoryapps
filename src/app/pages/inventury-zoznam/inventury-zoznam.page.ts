import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  // 👇 1. DÔLEŽITÉ: Importujeme konkrétne UI komponenty zo 'standalone'
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButtons, IonBackButton, IonButton, IonIcon,
  IonList, IonListHeader, IonItem, IonLabel
} from '@ionic/angular/standalone';

import { AlertController, ToastController, NavController } from '@ionic/angular';
import { SupabaseService, Inventura } from '../../services/supabase.service';
import { addIcons } from 'ionicons';
import { fontRobotoRegular } from 'src/app/font';

import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import * as XLSX from 'xlsx';
import { add, downloadOutline, printOutline, shareSocialOutline, logOutOutline } from 'ionicons/icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-inventury-zoznam',
  standalone: true,
  templateUrl: './inventury-zoznam.page.html',
  styleUrls: ['./inventury-zoznam.page.scss'],
  // 👇 2. DÔLEŽITÉ: Tu musíme vymenovať všetko, čo používaš v HTML
  imports: [
    CommonModule,
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonButtons,    // <ion-buttons> (Toto ti chýbalo)
    IonBackButton, // <ion-back-button> (Toto ti chýbalo)
    IonButton,     // <ion-button>
    IonIcon,       // <ion-icon>
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
      'share-social-outline': shareSocialOutline,
      'log-out-outline': logOutOutline,
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

  // Dialóg na vytvorenie novej inventúry
  async novaInventura() {
    const otvorena = this.zoznam.find(i => i.stav === 'otvorena');
    if (otvorena) {
      this.toast('Najprv musíte uzavrieť starú inventúru!', 'warning');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Nová Inventúra',
      inputs: [
        {
          name: 'nazov',
          type: 'text',
          placeholder: 'Napr. Január 2026'
        }
      ],
      buttons: [
        { text: 'Zrušiť', role: 'cancel' },
        {
          text: 'Vytvoriť',
          handler: async (data) => {
            if (data.nazov) {
              await this.vytvorit(data.nazov);
            }
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
      this.nacitajZoznam(); // Refresh
    } catch (e) {
      this.toast('Chyba pri vytváraní', 'danger');
    }
  }

  async toast(msg: string, color: string) {
    const t = await this.toastCtrl.create({ message: msg, duration: 2000, color });
    t.present();
  }

  // 🔥 Logika pre uzavretie
  async potvrditUzavretie(inv: Inventura) {
    const alert = await this.alertCtrl.create({
      header: 'Uzavrieť inventúru?',
      message: `Naozaj chcete uzavrieť "${inv.nazov}"? \n\n⚠️ Údaje v živom sklade sa prepíšu podľa tejto inventúry! Táto akcia sa nedá vrátiť.`,
      buttons: [
        {
          text: 'Zrušiť',
          role: 'cancel'
        },
        {
          text: 'Áno, prepísať sklad',
          cssClass: 'alert-danger-button',
          handler: () => {
            this.vykonatUzavretie(inv.id);
          }
        }
      ]
    });

    await alert.present();
  }

  async vykonatUzavretie(id: number) {
    try {
      await this.supabase.uzavrietInventuru(id);
      this.toast('Inventúra úspešne uzavretá. Sklad bol aktualizovaný.', 'success');
      this.nacitajZoznam();
    } catch (e) {
      console.error(e);
      this.toast('Chyba pri uzatváraní inventúry.', 'danger');
    }
  }

  // ⚙️ POMOCNÁ FUNKCIA: Iba vygeneruje Excel objekt
  private async generovatExcelSubor(inv: Inventura): Promise<{ wb: XLSX.WorkBook, nazovSuboru: string } | null> {
    try {
      const rawData = await this.supabase.getDetailInventuryPreExport(inv.id);

      if (!rawData || rawData.length === 0) {
        this.toast('Táto inventúra je prázdna.', 'warning');
        return null;
      }

      const excelData = rawData.map((item: any) => ({
        'Názov Produktu': item['Produkt'],
        'Stav (ks)': Number(item['Spočítané Množstvo']),
        'Sklad': item['Sklad'],
        'Regál': item['Regál'],
        'Kategória': item['Kategória'],
        'EAN': item['EAN'],
        'Balenie': Number(item['Balenie']),
      }));

      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(excelData);

      const colWidths = Object.keys(excelData[0]).map(key => {
        const maxDataLength = Math.max(
          ...excelData.map((row: any) => (row[key] ? row[key].toString().length : 0)),
          key.length + 2
        );
        return { wch: maxDataLength + 2 };
      });

      ws['!cols'] = colWidths;

      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventúra');

      const datum = new Date();
      const formatovanyDatum = datum.toISOString().slice(0, 10);
      const cas = datum.toTimeString().slice(0, 5).replace(':', '');
      const bezpecnyNazov = inv.nazov.replace(/[^a-z0-9]/gi, '_').toLowerCase();

      const nazovSuboru = `Inventura_${bezpecnyNazov}_${formatovanyDatum}_${cas}.xlsx`;

      return { wb, nazovSuboru };

    } catch (e) {
      console.error(e);
      this.toast('Chyba pri generovaní Excelu.', 'danger');
      return null;
    }
  }

  async poslatExcelEmailom(inv: Inventura) {
    const vysledok = await this.generovatExcelSubor(inv);
    if (vysledok) {
      const excelBuffer = XLSX.write(vysledok.wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      await this.zdielatSubor(blob, vysledok.nazovSuboru, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }
  }

  async stiahnutExcel(inv: Inventura) {
    const vysledok = await this.generovatExcelSubor(inv);
    if (vysledok) {
      XLSX.writeFile(vysledok.wb, vysledok.nazovSuboru);
      this.toast(`Súbor "${vysledok.nazovSuboru}" bol stiahnutý.`, 'success');
    }
  }

  private async generovatPDFDokument(inv: Inventura): Promise<{ doc: jsPDF, nazovSuboru: string } | null> {
    try {
      const rawData = await this.supabase.getDetailInventuryPreExport(inv.id);
      if (!rawData || rawData.length === 0) {
        this.toast('Táto inventúra je prázdna.', 'warning');
        return null;
      }

      const doc = new jsPDF();
      doc.addFileToVFS('Roboto-Regular.ttf', fontRobotoRegular);
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
      doc.setFont('Roboto');

      doc.setFontSize(18);
      doc.setTextColor(40);
      doc.text('INVENTÚRNY SÚPIS', 14, 22);

      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Názov: ${inv.nazov}`, 14, 32);

      const datumUzavretia = inv.datum_uzavretia
        ? new Date(inv.datum_uzavretia).toLocaleString('sk-SK')
        : 'Neuzavretá';
      doc.text(`Dátum uzavretia: ${datumUzavretia}`, 14, 38);

      const bodyData = rawData.map((item: any) => [
        item['Produkt'],
        `${item['Spočítané Množstvo']} ${item['Jednotka'] || 'ks'}`,
        item['Kategória'],
        `${item['Sklad']} - ${item['Regál']}`,
        `${item['Balenie']} ${item['Jednotka'] || 'ks'}`,
      ]);

      autoTable(doc, {
        head: [['Produkt', 'Stav', 'Kategória', 'Umiestnenie', 'Balenie']],
        body: bodyData,
        startY: 45,
        theme: 'grid',
        styles: {
          font: 'Roboto',
          fontStyle: 'normal',
          fontSize: 9,
          cellPadding: 3
        },
        headStyles: {
          fillColor: [56, 128, 255],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { halign: 'right', fontStyle: 'bold' }
        },
        didParseCell: (data) => {
          if (data.section === 'body') {
            if (data.column.index === 0) data.cell.styles.font = 'Roboto';
            if (data.column.index === 1) {
              data.cell.styles.textColor = [255, 0, 0];
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fontSize = 11;
              data.cell.styles.font = 'Roboto';
            }
            if (data.column.index === 3) data.cell.styles.fontSize = 8;
            if (data.column.index === 4) {
              const textBunky = String(data.cell.raw);
              const hodnota = parseFloat(textBunky);
              if (hodnota === 1) {
                data.cell.text = ['-'];
                data.cell.styles.halign = 'center';
              }
            }
          }
        }
      });

      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Strana ${i} z ${pageCount}`, 195, 290, { align: 'right' });
      }

      const bezpecnyNazov = inv.nazov.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const nazovSuboru = `Inventura_${bezpecnyNazov}.pdf`;

      return { doc, nazovSuboru };

    } catch (e) {
      console.error(e);
      this.toast('Chyba pri generovaní PDF.', 'danger');
      return null;
    }
  }

  async stiahnutPDF(inv: Inventura) {
    const vysledok = await this.generovatPDFDokument(inv);
    if (vysledok) {
      vysledok.doc.save(vysledok.nazovSuboru);
      this.toast('PDF bolo stiahnuté.', 'success');
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(blob);
    });
  }

  async zdielatSubor(blob: Blob, nazovSuboru: string, format: string) {
    try {
      const base64DataWithHeader = await this.blobToBase64(blob);
      const base64Data = base64DataWithHeader.split(',')[1];

      const savedFile = await Filesystem.writeFile({
        path: nazovSuboru,
        data: base64Data,
        directory: Directory.Cache
      });

      await Share.share({
        title: 'Odoslať inventúru',
        text: `Posielam súbor: ${nazovSuboru}`,
        url: savedFile.uri,
        dialogTitle: 'Zdieľať inventúru'
      });

    } catch (error) {
      console.error('Chyba pri zdieľaní:', error);
      this.toast('Zdieľanie zlyhalo, skúšam stiahnuť...', 'warning');

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nazovSuboru;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  }

  async poslatPDFEmailom(inv: Inventura) {
    const vysledok = await this.generovatPDFDokument(inv);
    if (vysledok) {
      const pdfBlob = vysledok.doc.output('blob');
      await this.zdielatSubor(pdfBlob, vysledok.nazovSuboru, 'application/pdf');
    }
  }
}