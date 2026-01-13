import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ViewWillEnter } from '@ionic/angular';
import {
  ModalController, ToastController, AlertController
} from '@ionic/angular';


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
  addCircleOutline
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

  imports: [
    CommonModule,
    FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton,
    IonSegment, IonSegmentButton, IonLabel, IonIcon, IonChip,
    IonSelect, IonSelectOption, IonSpinner,
    IonCard, IonFab, IonFabButton,
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


  async doRefresh(event: any) {
    console.log('🔄 Manuálny refresh...');
    await this.checkInventura();
    await this.nacitajSklady();
    await this.obnovitZoznamPodlaRezimu();
    event.target.complete();
  }



  async checkInventura() {
    try {
      this.aktivnaInventura = await this.supabaseService.getOtvorenaInventura();
      if (this.aktivnaInventura) {


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
      console.log('🔄 Sťahujem dáta pre režim:', this.rezimZobrazenia);

      // 1. ZÍSKANIE ZOZNAMU PRODUKTOV (ZÁSOB)
      if (this.rezimZobrazenia === 'global') {
        this.zasoby = await this.supabaseService.getVsetkyZasoby();
      }
      else if (this.rezimZobrazenia === 'regal' && this.vybranyRegalId) {
        this.zasoby = await this.supabaseService.getZasobyNaRegali(this.vybranyRegalId);
      }
      else if (this.rezimZobrazenia === 'v_inventure' && this.aktivnaInventura) {
        // Pre záložku "Hotové" nepotrebujeme párovanie, tam sú len hotové veci
        const hotove = await this.supabaseService.getPolozkyVInventure(this.aktivnaInventura.id);
        this.zasoby = hotove.map(z => ({ ...z, v_inventure: true }));
        this.aktualizovatFilter();
        this.isLoading = false;
        return;
      }
      else {
        this.zasoby = [];
        this.aktualizovatFilter();
        this.isLoading = false;
        return;
      }

      // 2. PÁROVANIE S INVENTÚROU (Slepá inventúra)
      if (this.aktivnaInventura) {
        console.log('📋 Aplikujem dáta z inventúry:', this.aktivnaInventura.nazov);

        // Stiahneme SUROVÉ dáta z inventúry (produkt_id, regal_id, mnozstvo)
        const rawInventura = await this.supabaseService.getRawInventuraData(this.aktivnaInventura.id);

        console.log(`🔍 Nájdených ${rawInventura.length} záznamov v inventúre.`);

        // Vytvoríme Mapu pre super-rýchle vyhľadávanie
        // Kľúč bude reťazec: "PRODUKT_ID-REGAL_ID"
        const mapa = new Map<string, number>();
        rawInventura.forEach(item => {
          const kluc = `${item.produkt_id}-${item.regal_id}`;
          mapa.set(kluc, item.mnozstvo);
        });

        // Prejdeme všetky zobrazené zásoby a aktualizujeme ich
        this.zasoby.forEach(z => {
          // Uistíme sa, že máme regal_id (globálny pohľad ho má, regálový ho má)
          // Ak sme v režime 'regal', z.regal_id môže byť undefined v objekte, ale máme this.vybranyRegalId
          const regalId = z.regal_id || this.vybranyRegalId;

          if (regalId) {
            const kluc = `${z.produkt_id}-${regalId}`;

            if (mapa.has(kluc)) {
              // ✅ NÁJDENÁ ZHODA: Nastavíme hodnotu z inventúry
              z.v_inventure = true;
              z.mnozstvo_ks = mapa.get(kluc) || 0;
            } else {
              // ❌ NENÁJDENÁ ZHODA: Nastavíme 0 (Slepá inventúra)
              z.v_inventure = false;
              z.mnozstvo_ks = 0;
            }
          }
        });
      }

      this.aktualizovatFilter();

    } catch (e) {
      console.error('❌ Chyba pri sťahovaní:', e);
    } finally {
      this.isLoading = false;
    }
  }
  private ulozenyStavRegal = {
    skladId: null as number | null,
    regalId: null as number | null,
    search: '',
    kategoria: 'vsetky'
  };
  async zmenitRezim(event: any) {
    const novyRezim = event.detail.value;

    // A) Ak odchádzame zo záložky 'regal', uložíme si aktuálny stav
    if (this.rezimZobrazenia === 'regal') {
      this.ulozenyStavRegal = {
        skladId: this.vybranySkladId,
        regalId: this.vybranyRegalId,
        search: this.searchQuery,
        kategoria: this.filterKategoria
      };
    }

    // B) Prepnutie režimu
    this.rezimZobrazenia = novyRezim;

    // C) Nastavenie dát pre nový režim
    if (this.rezimZobrazenia === 'regal') {
      // 🔙 VRACIAME SA DO 'REGAL': Obnovíme uložené dáta
      this.jeGlobalnyPohlad = false;

      this.vybranySkladId = this.ulozenyStavRegal.skladId;
      this.vybranyRegalId = this.ulozenyStavRegal.regalId;
      this.searchQuery = this.ulozenyStavRegal.search;
      this.filterKategoria = this.ulozenyStavRegal.kategoria;

      // Ak máme vybraný sklad ale nemáme načítané regály (napr. po refreshi), načítame ich
      if (this.vybranySkladId && this.regaly.length === 0) {
        try {
          this.regaly = await this.supabaseService.getRegaly(this.vybranySkladId);
        } catch (e) { console.error(e); }
      }

    } else {
      // 🆕 PRECHÁDZAME DO 'GLOBAL' alebo 'HOTLOVE':
      this.jeGlobalnyPohlad = true;

      // Vyčistíme filtre, aby globálny pohľad nebol ovplyvnený hľadaním z regálu
      // (Ale nevymažeme vybranySkladId/RegalId, tie ostanú v pamäti 'ulozenyStavRegal')
      this.searchQuery = '';
      this.filterKategoria = 'vsetky';

      // Pre vizuálny poriadok môžeme nastaviť lokálne premenné na null, 
      // ale vďaka zálohe o ne neprídeme.
      this.vybranyRegalId = null;
    }

    // D) Nakoniec obnovíme zoznam produktov
    await this.obnovitZoznamPodlaRezimu();
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



  async otvoritNovuLokaciu() {
    const modal = await this.modalController.create({
      component: NovaLokaciaModalComponent,
      initialBreakpoint: 0.6,
      breakpoints: [0, 0.6, 0.9]
    });

    await modal.present();

    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') {

      await this.nacitajSklady();

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


    const cielovyRegalId = this.jeGlobalnyPohlad ? zasoba.regal_id : this.vybranyRegalId;

    if (!cielovyRegalId && !this.aktivnaInventura) {
      this.zobrazToast('Chyba: Neviem určiť regál pre tento produkt.', 'warning');
      return;
    }

    try {
      this.isLoading = true;

      if (this.aktivnaInventura && cielovyRegalId) {

        await this.supabaseService.zapisatDoInventury(
          this.aktivnaInventura.id,
          zasoba.produkt_id,
          cielovyRegalId,
          novyStav
        );
        zasoba.v_inventure = true;
        await this.zobrazToast(`Zapísané do inventúry: ${novyStav}`, 'primary');
      } else {

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