import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from 'src/app/services/supabase.service';
import { addIcons } from 'ionicons';
import {
  statsChartOutline, alertCircleOutline, refreshOutline,
  closeCircleOutline, alertCircle, checkmarkCircleOutline
} from 'ionicons/icons';

// Importujeme všetky potrebné Ionic komponenty pre Standalone
import {
  IonCard, IonCardContent, IonIcon, IonSpinner, IonList,
  IonItem, IonLabel, IonBadge, IonButton, IonNote
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  // Pridali sme komponenty pre zoznam
  imports: [
    CommonModule,
    IonCard, IonCardContent, IonIcon, IonSpinner,
    IonList, IonItem, IonLabel, IonBadge, IonButton, IonNote
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {

  stats = { celkovo: 0, bezId: 0 };
  isLoadingStats = true;

  // Premenné pre vnútorný zoznam
  zobrazeneProdukty: any[] = [];
  nadpisZoznamu: string = '';
  isLoadingZoznam = false;

  constructor(private supabase: SupabaseService) {
    addIcons({
      statsChartOutline, alertCircleOutline, refreshOutline,
      closeCircleOutline, alertCircle, checkmarkCircleOutline
    });
  }

  async ngOnInit() {
    await this.obnovitStatistiky();
  }

  async obnovitStatistiky() {
    this.isLoadingStats = true;
    try {
      this.stats = await this.supabase.getStatistikyKatalogu();
    } catch (e) {
      console.error(e);
    } finally {
      this.isLoadingStats = false;
    }
  }

  // --- LOGIKA ZOBRAZENIA ZOZNAMU PRIAMO V DASHBOARDE ---

  async zobrazitBezId() {
    if (this.stats.bezId === 0) return; // Ak nie sú chyby, nič neotváraj

    this.nadpisZoznamu = 'Produkty bez vlastného ID';
    this.isLoadingZoznam = true;
    this.zobrazeneProdukty = []; // Reset

    try {
      this.zobrazeneProdukty = await this.supabase.getProduktyBezIdZoznam();
    } catch (e) {
      console.error(e);
    } finally {
      this.isLoadingZoznam = false;
    }
  }

  async zobrazitVsetky() {
    this.nadpisZoznamu = 'Všetky produkty v katalógu';
    this.isLoadingZoznam = true;
    this.zobrazeneProdukty = [];

    try {
      this.zobrazeneProdukty = await this.supabase.getVsetkyProduktyZoznam();
    } catch (e) {
      console.error(e);
    } finally {
      this.isLoadingZoznam = false;
    }
  }

  zavrietZoznam() {
    this.nadpisZoznamu = '';
    this.zobrazeneProdukty = [];
  }
}