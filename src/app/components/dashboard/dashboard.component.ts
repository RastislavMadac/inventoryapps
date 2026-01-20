import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from 'src/app/services/supabase.service';
import { addIcons } from 'ionicons';
import {
  statsChartOutline, alertCircleOutline, refreshOutline,
  closeCircleOutline, alertCircle, checkmarkCircleOutline, createOutline
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

  stats = { celkovo: 0, bezId: 0 };
  isLoadingStats = true;

  @ViewChild('zoznamRef') zoznamElement!: ElementRef;
  zobrazeneProdukty: any[] = [];
  nadpisZoznamu: string = '';
  isLoadingZoznam = false;

  constructor(private supabase: SupabaseService,
    private alertCtrl: AlertController, // Injectujeme Alert
    private toastCtrl: ToastController
  ) {
    addIcons({
      statsChartOutline, alertCircleOutline, refreshOutline,
      closeCircleOutline, alertCircle, checkmarkCircleOutline, createOutline
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



  async zobrazitBezId() {
    if (this.stats.bezId === 0) return;

    this.nadpisZoznamu = 'Produkty bez vlastného ID';
    this.isLoadingZoznam = true;
    this.zobrazeneProdukty = [];

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

  private scrollToList() {
    // Použijeme setTimeout, aby sme počkali, kým Angular vykreslí *ngIf
    setTimeout(() => {
      if (this.zoznamElement) {
        this.zoznamElement.nativeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'  // Toto zabezpečí, že zoznam bude v strede/hore obrazovky
        });
      }
    }, 100);
  }

  zavrietZoznam() {
    this.nadpisZoznamu = '';
    this.zobrazeneProdukty = [];
  }

  async zmenitId(produkt: any) {
    const alert = await this.alertCtrl.create({
      header: 'Pridať ID produktu',
      subHeader: produkt.nazov,
      inputs: [
        {
          name: 'noveId',
          type: 'text',
          placeholder: 'Naskenujte alebo zadajte ID',
          value: produkt.vlastne_id || '' // Ak tam niečo je, predvyplníme to
        }
      ],
      buttons: [
        {
          text: 'Zrušiť',
          role: 'cancel'
        },
        {
          text: 'Uložiť',
          handler: async (data) => {
            if (data.noveId) {
              await this.ulozitNoveId(produkt.id, data.noveId);
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async ulozitNoveId(id: number, noveId: string) {
    try {
      await this.supabase.aktualizovatVlastneId(id, noveId);

      // Zobrazíme potvrdenie
      const toast = await this.toastCtrl.create({
        message: 'ID bolo uložené ✅',
        duration: 2000,
        color: 'success',
        position: 'top'
      });
      toast.present();

      // Obnovíme zoznamy a štatistiky
      await this.obnovitStatistiky();

      // Ak máme otvorený zoznam "bez ID", obnovíme ho tiež
      if (this.nadpisZoznamu === 'Produkty bez vlastného ID') {
        await this.zobrazitBezId();
      } else if (this.nadpisZoznamu === 'Všetky produkty v katalógu') {
        await this.zobrazitVsetky();
      }

    } catch (error) {
      console.error(error);
      const toast = await this.toastCtrl.create({
        message: 'Chyba pri ukladaní ❌',
        duration: 2000,
        color: 'danger'
      });
      toast.present();
    }
  }
}