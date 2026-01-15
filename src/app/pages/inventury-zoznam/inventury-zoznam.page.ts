import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButtons, IonBackButton, IonButton, IonIcon,
  IonList, IonListHeader, IonItem, IonLabel,
  ActionSheetController, IonSpinner // 👈 Pridaný import
} from '@ionic/angular/standalone';

import { AlertController, ToastController, NavController } from '@ionic/angular';
import { SupabaseService, Inventura } from '../../services/supabase.service';
import { ExportService } from 'src/app/services/export.service';
import { addIcons } from 'ionicons';
import {
  add, logOutOutline, checkmarkDoneOutline,
  ellipsisVertical, documentTextOutline, gridOutline,
  trashOutline, closeOutline, warningOutline, closeCircle
} from 'ionicons/icons';
import { DoplnitIdModalComponent } from 'src/app/components/doplnit-id-modal/doplnit-id-modal.component';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-inventury-zoznam',
  standalone: true,
  templateUrl: './inventury-zoznam.page.html',
  styleUrls: ['./inventury-zoznam.page.scss'],
  imports: [
    CommonModule,
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonButtons, IonBackButton, IonButton, IonIcon,
    IonList, IonListHeader, IonItem, IonLabel,
    IonSpinner // 👈 Pridané do imports
  ],
  providers: [ActionSheetController, ModalController]
})
export class InventuryZoznamPage implements OnInit {

  zoznam: Inventura[] = [];
  isLoading = false; // 👈 Pridaná premenná pre spinner

  constructor(
    private modalCtrl: ModalController,
    private supabase: SupabaseService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private exportService: ExportService,
    private actionSheetCtrl: ActionSheetController
  ) {
    addIcons({
      add,
      logOutOutline,
      checkmarkDoneOutline,
      warningOutline,
      ellipsisVertical,
      documentTextOutline,
      gridOutline,
      trashOutline,
      closeOutline,
      closeCircle
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
    this.isLoading = true; // 👈 Zapneme spinner
    try {
      this.zoznam = await this.supabase.getZoznamInventur();
    } catch (e) {
      console.error(e);
      this.toast('Nepodarilo sa načítať zoznam.', 'danger');
    } finally {
      this.isLoading = false; // 👈 Vypneme spinner (aj pri chybe)
    }
  }

  async novaInventura() {
    const alert = await this.alertCtrl.create({
      header: 'Nová Inventúra',
      inputs: [{ name: 'nazov', type: 'text', placeholder: 'Napr. Január 2026' }],
      buttons: ['Zrušiť', { text: 'Vytvoriť', handler: (d) => { if (d.nazov) this.vytvorit(d.nazov) } }]
    });
    await alert.present();
  }

  async vytvorit(nazov: string) {
    try {
      // Aj tu môžeme zapnúť loading, ak chceme
      this.isLoading = true;
      await this.supabase.vytvoritInventuru(nazov);
      await this.nacitajZoznam(); // Toto už rieši loading vnútri
    } catch (e) {
      this.isLoading = false;
    }
  }

  async potvrditUzavretie(inv: Inventura) {
    const alert = await this.alertCtrl.create({
      header: 'Uzavrieť inventúru?',
      message: 'Naozaj? Dáta v sklade sa prepíšu.',
      buttons: ['Zrušiť', { text: 'Áno', handler: () => this.vykonatUzavretie(inv.id) }]
    });
    await alert.present();
  }

  async vykonatUzavretie(id: number) {
    try {
      this.isLoading = true;
      await this.supabase.uzavrietInventuru(id);
      await this.nacitajZoznam();
    } catch (e) {
      this.isLoading = false;
    }
  }

  async zmazat(inv: Inventura) {
    try {
      this.isLoading = true;
      await this.supabase.zmazatInventuru(inv.id);
      await this.nacitajZoznam();
    } catch (e) {
      this.isLoading = false;
    }
  }

  async otvoritFormularBezId(inv: Inventura) {
    const modal = await this.modalCtrl.create({
      component: DoplnitIdModalComponent,
      componentProps: {
        inventuraId: inv.id
      }
    });
    await modal.present();
  }

  async otvoritMoznosti(inv: Inventura) {
    const actionSheet = await this.actionSheetCtrl.create({
      header: `Možnosti: ${inv.nazov}`,
      buttons: [
        {
          text: 'Doplniť chýbajúce ID (Formulár)',
          icon: 'create-outline',
          handler: () => {
            this.otvoritFormularBezId(inv);
          }
        },
        {
          text: 'PDF Kompaktné (2 stĺpce)',
          icon: 'print-outline', // alebo document-text-outline
          handler: () => { this.spustitExport(inv, 'pdf_2col'); }
        },
        {
          text: 'Excel (Kompletný - 2 hárky)',
          icon: 'grid-outline',
          handler: () => { this.spustitExport(inv, 'excel_komplet'); }
        },
        {
          text: 'Excel (Len s ID)',
          icon: 'grid-outline',
          handler: () => { this.spustitExport(inv, 'excel_id'); }
        },
        {
          text: 'Excel (Len bez ID)',
          icon: 'grid-outline',
          handler: () => { this.spustitExport(inv, 'excel_noid'); }
        },
        {
          text: 'PDF (Len s ID)',
          icon: 'document-text-outline',
          handler: () => { this.spustitExport(inv, 'pdf_id'); }
        },
        {
          text: 'PDF (Len bez ID)',
          icon: 'document-text-outline',
          handler: () => { this.spustitExport(inv, 'pdf_noid'); }
        },
        {
          text: 'Zmazať inventúru',
          role: 'destructive',
          icon: 'trash-outline',
          handler: () => { this.zmazat(inv); }
        },
        {
          text: 'Zrušiť',
          role: 'cancel',
          icon: 'close-outline'
        }
      ]
    });

    await actionSheet.present();
  }

  async spustitExport(inv: Inventura, typ: string) {
    this.toast('Pripravujem súbor...', 'primary');

    try {
      const data = await this.supabase.getDetailInventuryPreExport(inv.id);

      if (!data || data.length === 0) {
        this.toast('Inventúra je prázdna.', 'warning');
        return;
      }

      let uspech = true;

      switch (typ) {
        case 'excel_komplet':
          this.exportService.generovatExcelKomplet(data, inv.nazov);
          break;

        case 'excel_id':
          uspech = this.exportService.generovatExcelSId(data, inv.nazov);
          if (!uspech) this.toast('Žiadne položky s ID.', 'warning');
          break;
        case 'pdf_2col':
          uspech = this.exportService.generovatPdfDvaStlpce(data, inv.nazov);
          break;

        case 'excel_noid':
          uspech = this.exportService.generovatExcelBezId(data, inv.nazov);
          if (!uspech) this.toast('Žiadne položky bez ID.', 'warning');
          break;

        case 'pdf_id':
          uspech = this.exportService.generovatPdfSId(data, inv.nazov);
          if (!uspech) this.toast('Žiadne položky s ID.', 'warning');
          break;

        case 'pdf_noid':
          uspech = this.exportService.generovatPdfBezId(data, inv.nazov);
          if (!uspech) this.toast('Žiadne položky bez ID.', 'warning');
          break;
      }

      if (uspech) {
        this.toast('Súbor stiahnutý.', 'success');
      }

    } catch (e) {
      console.error(e);
      this.toast('Chyba pri exporte.', 'danger');
    }
  }

  async toast(msg: string, color: string) {
    const t = await this.toastCtrl.create({ message: msg, duration: 2000, color, position: 'bottom' });
    t.present();
  }

  async spravovatNezname(inv: Inventura) {
    const modal = await this.modalCtrl.create({
      component: DoplnitIdModalComponent,
      componentProps: {
        inventuraId: inv.id
      }
    });

    await modal.present();
    await modal.onWillDismiss();
    this.nacitajZoznam();
  }


}