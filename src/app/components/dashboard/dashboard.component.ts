import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from 'src/app/services/supabase.service';
import { addIcons } from 'ionicons';
import {
  statsChartOutline, alertCircleOutline, refreshOutline,
  closeCircleOutline, alertCircle, checkmarkCircleOutline,
  createOutline, checkmarkDoneCircleOutline, chevronForwardOutline, timeOutline
} from 'ionicons/icons';
import { AlertController, ToastController } from '@ionic/angular';

import {
  IonCard, IonCardContent, IonIcon, IonSpinner, IonList,
  IonItem, IonLabel, IonBadge, IonButton
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    IonCard, IonCardContent, IonIcon, IonSpinner,
    IonList, IonItem, IonLabel, IonBadge, IonButton
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

  // 2. Pridaj jednoduchú funkciu na prepínanie
  toggleInventury() {
    this.isInvExpanded = !this.isInvExpanded;
  }
  @ViewChild('zoznamRef') zoznamElement!: ElementRef;
  zobrazeneProdukty: any[] = [];
  nadpisZoznamu: string = '';
  isLoadingZoznam = false;

  constructor(
    private supabase: SupabaseService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {
    addIcons({
      statsChartOutline, alertCircleOutline, refreshOutline,
      closeCircleOutline, alertCircle, checkmarkCircleOutline,
      createOutline, checkmarkDoneCircleOutline, chevronForwardOutline, timeOutline
    });
  }

  async ngOnInit() {
    await this.obnovitStatistiky();
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