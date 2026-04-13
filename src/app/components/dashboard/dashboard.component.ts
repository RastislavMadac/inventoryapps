import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from 'src/app/services/supabase.service';
import { ExportService } from 'src/app/services/export.service';
import { addIcons } from 'ionicons';
import {
  statsChartOutline, alertCircleOutline, refreshOutline,
  closeCircleOutline, alertCircle, checkmarkCircleOutline,
  createOutline, checkmarkDoneCircleOutline, chevronForwardOutline, timeOutline, cloudUploadOutline, documentTextOutline, listOutline, addCircle, chevronDown, warningOutline, cubeOutline
} from 'ionicons/icons';
import { AlertController, ToastController, LoadingController } from '@ionic/angular';

import {
  IonCard, IonCardContent, IonIcon, IonSpinner, IonList,
  IonItem, IonLabel, IonBadge, IonButton, IonCardHeader,
  IonCardTitle, IonCardSubtitle, IonListHeader, IonNote, IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonContent
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    IonCard, IonCardContent, IonIcon, IonSpinner,
    IonList, IonItem, IonLabel, IonBadge, IonButton, IonCardHeader, IonCardTitle, IonCardSubtitle, IonListHeader, IonNote, IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonContent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {

  // Globálne štatistiky katalógu
  stats = { celkovo: 0, bezId: 0, spocitaneGlobal: 0 };

  // Zoznam všetkých inventúr s ich počtami
  zoznamInventurStats: any[] = [];

  isLoadingStats = true;
  // 1. Pridaj premennú do triedy DashboardComponent
  isInvExpanded: boolean = false;
  isModalOpen: boolean = false;

  vysledokPorovnania: any[] = [];
  isLoadingZoznam = false;
  neznameProdukty: any[] = [];
  // 2. Pridaj jednoduchú funkciu na prepínanie
  toggleInventury() {
    this.isInvExpanded = !this.isInvExpanded;
  }
  @ViewChild('zoznamRef') zoznamElement!: ElementRef;
  zobrazeneProdukty: any[] = [];
  nadpisZoznamu: string = '';


  constructor(
    private supabase: SupabaseService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private exportService: ExportService,
    private loadingCtrl: LoadingController
  ) {
    addIcons({ statsChartOutline, alertCircleOutline, cloudUploadOutline, closeCircleOutline, warningOutline, cubeOutline, timeOutline, createOutline, refreshOutline, alertCircle, checkmarkCircleOutline, checkmarkDoneCircleOutline, chevronForwardOutline, documentTextOutline, listOutline, addCircle, chevronDown });
  }



  async ngOnInit() {
    await this.obnovitStatistiky();
  }

  // 🔥 NOVÁ METÓDA PRE IMPORT EXCELU
  async onFileChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    // 1. Zistíme, či máme otvorenú inventúru, do ktorej budeme importovať
    const otvorena = await this.supabase.getOtvorenaInventura();
    if (!otvorena) {
      const toast = await this.toastCtrl.create({
        message: 'Chyba: Neexistuje žiadna otvorená inventúra pre import.',
        color: 'danger', duration: 3000
      });
      toast.present();
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Spracovávam Excel...' });
    await loading.present();

    try {
      const jsonData = await this.exportService.parsovatExcelImport(file);
      await this.supabase.nahratImportDoTemp(otvorena.id, jsonData);

      // Spustíme obe kontroly naraz (paralelne pre vyššiu rýchlosť)
      const [rozdiely, nezname] = await Promise.all([
        this.supabase.porovnatImportSInventurou(otvorena.id),
        this.supabase.skontrolovatNeznameProdukty(otvorena.id) // 🔥 Nové volanie
      ]);

      this.vysledokPorovnania = rozdiely;
      this.neznameProdukty = nezname; // 🔥 Uloženie do premennej

      // Modal otvoríme, ak sa našla chyba buď v inventúre, ALEBO v chýbajúcich produktoch
      if (this.vysledokPorovnania.length > 0 || this.neznameProdukty.length > 0) {
        this.isModalOpen = true;
      } else {
        const t = await this.toastCtrl.create({
          message: 'Excel je v 100% zhode a všetky produkty existujú!',
          color: 'success', duration: 3000
        });
        t.present();
      }
    } catch (error) {
      console.error(error);

      // Vytvoríme si bezpečnú správu
      const msg = error instanceof Error ? error.message : 'Neznáma chyba pri spracovaní súboru';

      const errToast = await this.toastCtrl.create({
        message: 'Chyba importu: ' + msg,
        color: 'danger',
        duration: 4000
      });
      errToast.present();
    } finally {
      await loading.dismiss(); // 🔥 MUSÍ tu byť await
      event.target.value = '';
    }
  }

  async obnovitStatistiky() {
    this.isLoadingStats = true;
    try {
      // 1. Základné dáta katalógu
      const katalog = await this.supabase.getStatistikyKatalogu();
      const global = await this.supabase.getPocetSpocitanychGlobal();

      this.stats = {
        celkovo: katalog.celkovo,
        bezId: katalog.bezId,
        spocitaneGlobal: global
      };

      // 2. Načítame zoznam všetkých inventúr a ich progres (musíš mať túto funkciu v SupabaseService)
      this.zoznamInventurStats = await this.supabase.getZoznamInventurSoStats();

    } catch (e) {
      console.error('Chyba pri načítaní Dashboardu:', e);
    } finally {
      this.isLoadingStats = false;
    }
  }

  // Zobrazenie detailného zoznamu pre konkrétnu inventúru
  async zobrazitDetailInventury(inv: any) {
    this.nadpisZoznamu = `Položky: ${inv.nazov}`;
    this.isLoadingZoznam = true;
    this.zobrazeneProdukty = [];

    try {
      // Stiahneme prvých 100 položiek danej inventúry
      this.zobrazeneProdukty = await this.supabase.getPolozkyVInventure(inv.id, 0, 100);
      this.scrollToList();
    } catch (e) {
      console.error(e);
    } finally {
      this.isLoadingZoznam = false;
    }
  }

  async zobrazitSpocitaneGlobal() {
    this.nadpisZoznamu = 'Všetky vykonané zápisy (História)';
    this.isLoadingZoznam = true;
    try {
      const { data, error } = await this.supabase.supabase
        .from('inventura_polozky')
        .select(`id, mnozstvo, produkty:produkt_id ( nazov, vlastne_id )`)
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      this.zobrazeneProdukty = data.map((d: any) => ({
        id: d.id, nazov: d.produkty?.nazov, vlastne_id: d.produkty?.vlastne_id, mnozstvo_ks: d.mnozstvo
      }));
      this.scrollToList();
    } catch (e) { console.error(e); } finally { this.isLoadingZoznam = false; }
  }

  async zobrazitBezId() {
    this.nadpisZoznamu = 'Produkty bez vlastného ID';
    this.isLoadingZoznam = true;
    try {
      this.zobrazeneProdukty = await this.supabase.getProduktyBezIdZoznam();
      this.scrollToList();
    } catch (e) { console.error(e); } finally { this.isLoadingZoznam = false; }
  }

  async zobrazitVsetky() {
    this.nadpisZoznamu = 'Všetky produkty v katalógu';
    this.isLoadingZoznam = true;
    try {
      this.zobrazeneProdukty = await this.supabase.getVsetkyProduktyZoznam();
      this.scrollToList();
    } catch (e) { console.error(e); } finally { this.isLoadingZoznam = false; }
  }

  private scrollToList() {
    setTimeout(() => {
      if (this.zoznamElement) {
        this.zoznamElement.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  }

  zavrietZoznam() {
    this.nadpisZoznamu = '';
    this.zobrazeneProdukty = [];
  }

  async zmenitId(p: any) { /* Tvoja existujúca funkcia na zmenu ID */ }
  async ulozitNoveId(id: number, noveId: string) { /* Tvoja existujúca funkcia */ }
}