import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ViewWillEnter } from '@ionic/angular';
import {
  ModalController, ToastController, AlertController
} from '@ionic/angular';

// 👇 1. OPRAVA: Pridané IonRefresher a IonRefresherContent
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton,
  IonSegment, IonSegmentButton, IonLabel, IonIcon, IonChip,
  IonItem, IonSelect, IonSelectOption, IonSearchbar, IonSpinner,
  IonList, IonCard, IonFab, IonFabButton,
  IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import {
  add, addOutline, searchOutline, filterOutline,
  caretDownOutline, clipboardOutline, cubeOutline,
  arrowUpOutline, locationOutline, listOutline,
  checkmarkCircle, checkmarkDoneOutline, timeOutline,
  addCircleOutline // Pre tlačidlo pridania skladu/regálu
} from 'ionicons/icons';

import { SupabaseService, Sklad, Regal, SkladovaZasobaView, Inventura } from 'src/app/services/supabase.service';
import { CalculatorModalComponent } from 'src/app/components/calculator-modal/calculator-modal.component';
import { NovyProduktModalComponent } from 'src/app/components/novy-produkt-modal/novy-produkt-modal.component';
import { NovaLokaciaModalComponent } from 'src/app/components/nova-lokacia-modal/nova-lokacia-modal.component';

@Component({
  selector: 'app-inventory',
  standalone: true,
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss'],
  // 👇 2. OPRAVA: Pridané do imports poľa
  imports: [
    CommonModule,
    FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton,
    IonSegment, IonSegmentButton, IonLabel, IonIcon, IonChip,
    IonItem, IonSelect, IonSelectOption, IonSearchbar, IonSpinner,
    IonList, IonCard, IonFab, IonFabButton,
    IonRefresher, IonRefresherContent
  ],
  providers: [
    ModalController,
    ToastController,
    AlertController
  ]
})
export class InventoryComponent implements OnInit, ViewWillEnter {

  rezimZobrazenia: 'regal' | 'global' | 'v_inventure' = 'regal';
  jeGlobalnyPohlad = false;

  sklady: Sklad[] = [];
  regaly: Regal[] = [];
  aktivnaInventura: Inventura | null = null;

  zasoby: SkladovaZasobaView[] = [];
  filtrovaneZasoby: SkladovaZasobaView[] = [];

  vybranySkladId: number | null = null;
  vybranyRegalId: number | null = null;
  isLoading = false;

  searchQuery: string = '';
  filterKategoria: string = 'vsetky';

  constructor(
    private supabaseService: SupabaseService,
    private toastController: ToastController,
    private alertController: AlertController,
    private modalController: ModalController,
  ) {
    // 👇 3. OPRAVA: Vyčistené duplicity v ikonách
    addIcons({
      'add': add,
      'add-outline': addOutline,
      'add-circle-outline': addCircleOutline,
      'search-outline': searchOutline,
      'filter-outline': filterOutline,
      'caret-down-outline': caretDownOutline,
      'clipboard-outline': clipboardOutline,
      'cube-outline': cubeOutline,
      'arrow-up-outline': arrowUpOutline,
      'location-outline': locationOutline,
      'list-outline': listOutline,
      'checkmark-circle': checkmarkCircle,
      'checkmark-done-outline': checkmarkDoneOutline,
      'time-outline': timeOutline
    });
  }

  ngOnInit() {
    this.nacitajSklady();
  }

  async ionViewWillEnter() {
    console.log('🔄 ionViewWillEnter: Obnovujem dáta...');
    await this.checkInventura();
    await this.obnovitZoznamPodlaRezimu();
  }

  // 👇 4. OPRAVA: Pridaná chýbajúca funkcia doRefresh
  async doRefresh(event: any) {
    console.log('🔄 Manuálny refresh...');
    await this.checkInventura();
    await this.nacitajSklady();
    await this.obnovitZoznamPodlaRezimu();
    event.target.complete();
  }

  // --- LOGIKA NAČÍTANIA DÁT ---

  async checkInventura() {
    try {
      this.aktivnaInventura = await this.supabaseService.getOtvorenaInventura();
      if (this.aktivnaInventura) {
        // Voliteľný toast, ak chcete
        // this.zobrazToast(`🔵 Režim INVENTÚRA: ${this.aktivnaInventura.nazov}`, 'primary');
      }
    } catch (e) {
      console.error(e);
    }
  }

  async nacitajSklady() {
    try {
      this.sklady = await this.supabaseService.getSklady();
    } catch (error) {
      this.zobrazToast('Nepodarilo sa načítať sklady.', 'danger');
    }
  }

  async obnovitZoznamPodlaRezimu() {
    this.isLoading = true;
    try {
      if (this.rezimZobrazenia === 'global') {
        this.zasoby = await this.supabaseService.getVsetkyZasoby();
      }
      else if (this.rezimZobrazenia === 'v_inventure' && this.aktivnaInventura) {
        const hotove = await this.supabaseService.getPolozkyVInventure(this.aktivnaInventura.id);
        this.zasoby = hotove.map(z => ({ ...z, v_inventure: true }));
      }
      else if (this.rezimZobrazenia === 'regal' && this.vybranyRegalId) {
        this.zasoby = await this.supabaseService.getZasobyNaRegali(this.vybranyRegalId);
      } else {
        // Ak sme v režime regal ale nemáme vybraný regal, zoznam je prázdny
        this.zasoby = [];
      }

      this.aktualizovatFilter();

    } catch (e) {
      console.error('❌ Chyba pri sťahovaní:', e);
    } finally {
      this.isLoading = false;
    }
  }

  // --- OVLÁDANIE FILTROV A VÝBEROV ---

  zmenitRezim(event: any) {
    this.rezimZobrazenia = event.detail.value;
    this.searchQuery = '';
    this.filterKategoria = 'vsetky';

    if (this.rezimZobrazenia === 'global' || this.rezimZobrazenia === 'v_inventure') {
      this.jeGlobalnyPohlad = true;
    } else {
      this.jeGlobalnyPohlad = false;
      this.vybranyRegalId = null;
    }

    this.obnovitZoznamPodlaRezimu();
  }

  async onSkladChange(skladId: number) {
    this.vybranySkladId = skladId;
    this.vybranyRegalId = null;
    this.zasoby = [];
    this.filtrovaneZasoby = [];

    try {
      this.isLoading = true;
      this.regaly = await this.supabaseService.getRegaly(skladId);
    } catch (error) {
      console.error(error);
    } finally {
      this.isLoading = false;
    }
  }

  async onRegalChange(regalId: number) {
    this.vybranyRegalId = regalId;
    await this.obnovitZoznamPodlaRezimu();
  }

  handleSearch(event: any) {
    const val = event.target.value;
    this.searchQuery = val;
    this.aktualizovatFilter();
  }

  zmenitFilterKategorie(event: any) {
    this.filterKategoria = event.detail.value;
    this.aktualizovatFilter();
  }

  aktualizovatFilter() {
    let temp = [...this.zasoby];

    if (this.filterKategoria && this.filterKategoria !== 'vsetky') {
      temp = temp.filter(z => (z.kategoria || 'Bez kategórie') === this.filterKategoria);
    }
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      temp = temp.filter(z => z.nazov.toLowerCase().includes(q));
    }
    this.filtrovaneZasoby = temp;
  }

  get unikatneKategorie(): string[] {
    const kategorie = this.zasoby.map(z => z.kategoria || 'Bez kategórie');
    return [...new Set(kategorie)].sort();
  }

  // --- MODÁLNE OKNÁ ---

  async otvoritNovuLokaciu() {
    const modal = await this.modalController.create({
      component: NovaLokaciaModalComponent,
      initialBreakpoint: 0.6,
      breakpoints: [0, 0.6, 0.9]
    });

    await modal.present();

    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') {
      // Obnovíme zoznam skladov, lebo mohol pribudnúť sklad
      await this.nacitajSklady();
      // Ak máme vybraný sklad, obnovíme ho (mohli pribudnúť regále)
      if (this.vybranySkladId) {
        await this.onSkladChange(this.vybranySkladId);
      }
    }
  }

  async otvoritNovyProdukt() {
    const modal = await this.modalController.create({
      component: NovyProduktModalComponent
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm' && data) {
      this.zobrazToast('Produkt úspešne pridaný', 'success');
      // Po pridaní produktu obnovíme dáta
      await this.obnovitZoznamPodlaRezimu();
    }
  }

  async otvoritUpravu(zasoba: SkladovaZasobaView) {
    const modal = await this.modalController.create({
      component: CalculatorModalComponent,
      cssClass: 'my-custom-modal',
      componentProps: {
        nazovProduktu: zasoba.nazov,
        aktualnyStav: zasoba.mnozstvo_ks,
        balenie: zasoba.balenie_ks
      }
    });

    modal.onWillDismiss().then((data) => {
      if (data.role === 'confirm') {
        const novyStav = data.data.novyStav;
        this.ulozitZmenu(zasoba, novyStav);
      }
    });

    return await modal.present();
  }

  async ulozitZmenu(zasoba: SkladovaZasobaView, novyStavInput: string | number) {
    const novyStav = Number(novyStavInput);
    if (isNaN(novyStav)) return;

    // Určíme, kam to zapísať (na ktorý regál)
    const cielovyRegalId = this.jeGlobalnyPohlad ? zasoba.regal_id : this.vybranyRegalId;

    if (!cielovyRegalId && !this.aktivnaInventura) {
      this.zobrazToast('Chyba: Neviem určiť regál pre tento produkt.', 'warning');
      return;
    }

    try {
      this.isLoading = true;

      if (this.aktivnaInventura && cielovyRegalId) {
        // Zápis do inventúry
        await this.supabaseService.zapisatDoInventury(
          this.aktivnaInventura.id,
          zasoba.produkt_id,
          cielovyRegalId,
          novyStav
        );
        zasoba.v_inventure = true;
        await this.zobrazToast(`Zapísané do inventúry: ${novyStav}`, 'primary');
      } else {
        // Zápis priamo do skladu (mimo inventúry)
        await this.supabaseService.updateZasobu(zasoba.id, zasoba.produkt_id, novyStav, zasoba.mnozstvo_ks);
        await this.zobrazToast(`Uložené: ${novyStav}`, 'success');
      }

      zasoba.mnozstvo_ks = novyStav;
      this.aktualizovatFilter();
    } catch (error) {
      this.zobrazToast('Chyba ukladania', 'danger');
      console.error(error);
    } finally {
      this.isLoading = false;
    }
  }

  async zobrazToast(sprava: string, farba: string) {
    const toast = await this.toastController.create({
      message: sprava,
      duration: 2000,
      color: farba,
      position: 'top',
      mode: 'ios',
      cssClass: 'top-toast'
    });
    await toast.present();
  }
}