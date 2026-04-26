import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButtons, IonBackButton, IonButton, IonIcon,
  IonList, IonListHeader, IonItem, IonLabel,
  ActionSheetController, IonSpinner
} from '@ionic/angular/standalone';

import { AlertController, ToastController, NavController } from '@ionic/angular';
import { SupabaseService, Inventura } from '../../services/supabase.service';
import { ExportService } from 'src/app/services/export.service';
import { addIcons } from 'ionicons';
import {
  add, logOutOutline, checkmarkDoneOutline,
  ellipsisVertical, documentTextOutline, gridOutline,
  trashOutline, closeOutline, warningOutline, closeCircle, reload, downloadOutline
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
    IonSpinner
  ],
  providers: [ActionSheetController, ModalController]
})
export class InventuryZoznamPage implements OnInit {

  zoznam: Inventura[] = [];
  isLoading = false;

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
      closeCircle,
      reload,
      downloadOutline
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
    this.isLoading = true;
    try {
      this.zoznam = await this.supabase.getZoznamInventur();
    } catch (e) {
      console.error(e);
      this.toast('Nepodarilo sa načítať zoznam.', 'danger');
    } finally {
      this.isLoading = false;
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

      this.isLoading = true;
      await this.supabase.vytvoritInventuru(nazov);
      await this.nacitajZoznam();
    } catch (e: any) {
      this.isLoading = false;
      this.toast(e.message, 'danger');
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
      const user = await this.supabase.getCurrentUser();
      if (!user) {
        this.toast('Nepodarilo sa overiť prihlásenie. Skúste sa prosím prihlásiť znova.', 'danger');
        this.navCtrl.navigateRoot('/login');
        this.isLoading = false;
        return;
      }
      await this.supabase.uzavrietInventuru(id);
      await this.nacitajZoznam();
    } catch (e: any) {
      this.isLoading = false;
      this.toast(e.message, 'danger');
    }
  }

  async znovuOtvorit(inv: Inventura) {
    const alert = await this.alertCtrl.create({
      header: 'Znovu otvoriť inventúru?',
      message: 'Naozaj chcete znovu otvoriť túto inventúru?',
      buttons: [
        'Zrušiť',
        {
          text: 'Áno, otvoriť',
          handler: async () => {
            try {
              this.isLoading = true;
              const user = await this.supabase.getCurrentUser();
              if (!user) {
                this.toast('Nepodarilo sa overiť prihlásenie. Skúste sa prosím prihlásiť znova.', 'danger');
                this.navCtrl.navigateRoot('/login');
                this.isLoading = false;
                return;
              }
              await this.supabase.znovuOtvoritInventuru(inv.id);
              await this.nacitajZoznam();
              this.toast('Inventúra bola znovu otvorená.', 'success');
            } catch (e: any) {
              this.isLoading = false;
              this.toast(e.message, 'danger');
            } finally {
              this.isLoading = false;
            }
          }
        }
      ]
    });
    await alert.present();
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

        // {
        //   text: 'Export pre blueGastro (Štandard.xls)', // Pôvodný - len naskenované
        //   icon: 'document-text-outline',
        //   handler: () => { this.spustitExport(inv, 'tlacova_zostava'); }
        // },

        //0 polozky z importu
        {
          text: 'Export pre blueGastro (Kompletný.xls)', // Nový - vrátane nenaskenovaných (0)
          icon: 'document-text-outline',
          handler: () => { this.spustitExport(inv, 'tlacova_zostava_s_exportom'); }
        },
        //Bez 0 poloziek z importu + nazvy poloziek
        {
          text: 'Export s názvami položiek (.xls)', // Opravený preklep v názve
          icon: 'document-text-outline',
          handler: () => { this.spustitExport(inv, 'tlacova_zostava_nazvy'); } // <-- Nový identifikátor
        },
        //S 0 poloziek z importu + nazvy poloziek
        {
          text: 'Export s názvami položiek + 0. položky', // Opravený preklep v názve
          icon: 'document-text-outline',
          handler: () => { this.spustitExport(inv, 'tlacova_zostava_s_exportom_s_polozkami'); } // <-- Nový identifikátor
        },
        // {
        //   text: 'Export celej DB nez nazvu položiek (Nenaskenované = 0)',
        //   icon: 'document-text-outline',
        //   handler: () => { this.spustitExport(inv, 'tlacova_zostava_komplet_db'); }
        // },
        {
          text: 'Export celej DB (Nenaskenované = 0)',
          icon: 'document-text-outline',
          handler: () => { this.spustitExport(inv, 'tlacova_zostava_komplet_db1'); }
        },
        // {
        //   text: 'Doplniť chýbajúce ID (Formulár)',
        //   icon: 'create-outline',
        //   handler: () => {
        //     this.otvoritFormularBezId(inv);
        //   }
        // },
        // {
        //   text: 'PDF Kompaktné (2 stĺpce)',
        //   icon: 'print-outline',
        //   handler: () => { this.spustitExport(inv, 'pdf_2col'); }
        // },
        // {
        //   text: 'Excel (Kompletný - 2 hárky)',
        //   icon: 'grid-outline',
        //   handler: () => { this.spustitExport(inv, 'excel_komplet'); }
        // },
        {
          text: 'Excel (Len s ID)',
          icon: 'grid-outline',
          handler: () => { this.spustitExport(inv, 'excel_id'); }
        },
        // {
        //   text: 'Excel (Len bez ID)',
        //   icon: 'grid-outline',
        //   handler: () => { this.spustitExport(inv, 'excel_noid'); }
        // },
        {
          text: 'PDF (Len s ID)',
          icon: 'document-text-outline',
          handler: () => { this.spustitExport(inv, 'pdf_id'); }
        },

        {
          text: 'Celý sklad (Excel)',
          icon: 'download-outline',
          handler: () => { this.exportovatCelySklad(); }
        },
        // {
        //   text: 'PDF (Len bez ID)',
        //   icon: 'document-text-outline',
        //   handler: () => { this.spustitExport(inv, 'pdf_noid'); }
        // },
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
      let data: any[] = [];

      // ---------------------------------------------------------
      // 1. KROK: ROZHODOVACIA LOGIKA PRE ZDROJ DÁT
      // ---------------------------------------------------------
      const typyPreKompletneData = [
        'tlacova_zostava_s_exportom',
        'tlacova_zostava_s_exportom_s_polozkami'
      ];

      if (typyPreKompletneData.includes(typ)) {
        // Ťahá spojené dáta: Excel import z 'importy_temp' + reálne naskenované položky
        data = await this.supabase.getKompletneDataPreZostavuBezDB(inv.id);
      }
      else if (typ === 'tlacova_zostava_komplet_db') {
        // Ťahá spojené dáta: Úplne CELÝ katalóg z DB + reálne naskenované položky (Nenájdené majú množstvo 0)
        data = await this.supabase.getKompletnyKatalogSInventurou(inv.id);
      }
      else {
        // Štandardný fallback: Ťahá iba čisto naskenované položky, ktoré fyzicky existujú v 'inventura_polozky'
        data = await this.supabase.getDetailInventuryPreExport(inv.id);
      }

      // ---------------------------------------------------------
      // 2. KROK: VALIDÁCIA DÁT
      // ---------------------------------------------------------
      if (!data || data.length === 0) {
        this.toast('Inventúra neobsahuje žiadne dáta na export.', 'warning');
        return;
      }

      let uspech = true;

      // ---------------------------------------------------------
      // 3. KROK: DELEGOVANIE NA EXPORT SERVICE
      // ---------------------------------------------------------
      switch (typ) {
        // ---1. tlacova zostava iba spocitanene polozky bez nazvu  ---
        case 'tlacova_zostava':
          uspech = this.exportService.generovatTlacovuZostavu(data, inv.nazov);
          break;
        case 'tlacova_zostava_s_exportom':
          uspech = this.exportService.generovatTlacovuZostavuSExportom(data, inv.nazov);
          break;
        case 'tlacova_zostava_s_exportom_s_polozkami':
          uspech = this.exportService.generovatTlacovuZostavuKompletDBSPolozkami(data, inv.nazov);
          break;
        case 'tlacova_zostava_nazvy':
          uspech = this.exportService.generovatTlacovuZostavuSNazvamiPoloziek(data, inv.nazov);
          break;
        case 'tlacova_zostava_komplet_db':
          uspech = this.exportService.generovatTlacovuZostavuSExportomSPolozkami(data, inv.nazov);
          break;
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
        default:
          this.toast('Neznámy typ exportu.', 'danger');
          uspech = false;
          break;
      }

      // ---------------------------------------------------------
      // 4. KROK: SPÄTNÁ VÄZBA PRE POUŽÍVATEĽA
      // ---------------------------------------------------------
      if (uspech) {
        this.toast('Súbor bol úspešne stiahnutý.', 'success');
      }

    } catch (e) {
      console.error('Chyba pri generovaní exportu:', e);
      this.toast('Nastala chyba pri príprave exportu.', 'danger');
    }
  }


  async toast(msg: string, color: string) {
    const t = await this.toastCtrl.create({ message: msg, duration: 2000, color, position: 'top' });
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

  async exportovatCelySklad() {
    this.isLoading = true;
    try {
      // Získanie dát celého skladu (vyžaduje existenciu metódy v SupabaseService)
      const dataSkladu = await this.supabase.getCelySkladPreExport();

      if (!dataSkladu || dataSkladu.length === 0) {
        this.toast('Sklad je momentálne prázdny.', 'warning');
        return;
      }

      const uspech = this.exportService.generovatExcelCelehoSkladu(dataSkladu);

      if (uspech) {
        this.toast('Stav skladu bol úspešne exportovaný.', 'success');
      }
    } catch (e: any) {
      console.error('Chyba pri exporte skladu:', e);
      this.toast('Nepodarilo sa exportovať sklad.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }
}