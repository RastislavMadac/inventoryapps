import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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

// 👇 DÔLEŽITÉ: Importujeme už len Service a modely, žiadny createClient
import { SupabaseService, Sklad, Regal, SkladovaZasobaView, Inventura } from 'src/app/services/supabase.service';
import { CalculatorModalComponent } from 'src/app/components/calculator-modal/calculator-modal.component';
import { NovyProduktModalComponent } from 'src/app/components/novy-produkt-modal/novy-produkt-modal.component';
import { NovaLokaciaModalComponent } from 'src/app/components/nova-lokacia-modal/nova-lokacia-modal.component';
import { Subscription } from 'rxjs';

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
  private realtimeSubscription: Subscription | null = null;

  rezimZobrazenia: 'regal' | 'global' | 'v_inventure' = 'regal';
  jeGlobalnyPohlad = false;

  // ❌ VYMAZANÉ: public supabase: SupabaseClient; (nepotrebujeme to tu)

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
    public supabaseService: SupabaseService, // Musí byť public alebo private, ale hlavne injektované
    private toastController: ToastController,
    private alertController: AlertController,
    private modalController: ModalController,
    private cdr: ChangeDetectorRef
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
      'time-outline': timeOutline,
    });

    // ❌ VYMAZANÉ: this.supabase = createClient(...);
    // Všetku komunikáciu riešime cez this.supabaseService
  }

  ngOnInit() {
    this.nacitajSklady();
  }

  async ionViewWillEnter() {
    console.log('🔄 ionViewWillEnter: Obnovujem dáta...');
    await this.checkInventura();
    await this.obnovitZoznamPodlaRezimu();
    this.prihlasitOdberZmien();
  }

  ionViewWillLeave() {
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
      this.realtimeSubscription = null;
    }
    // Teraz to bude fungovať, ak ste v SupabaseService nastavili 'public supabase'
    this.supabaseService.supabase.removeAllChannels();
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

      // 2. PÁROVANIE S INVENTÚROU
      if (this.aktivnaInventura) {
        const rawInventura = await this.supabaseService.getRawInventuraData(this.aktivnaInventura.id);

        const mapa = new Map<string, number>();
        rawInventura.forEach(item => {
          const kluc = `${item.produkt_id}-${item.regal_id}`;
          mapa.set(kluc, item.mnozstvo);
        });

        this.zasoby.forEach(z => {
          const regalId = z.regal_id || this.vybranyRegalId;
          if (regalId) {
            const kluc = `${z.produkt_id}-${regalId}`;
            if (mapa.has(kluc)) {
              z.v_inventure = true;
              z.mnozstvo_ks = mapa.get(kluc) || 0;
            } else {
              z.v_inventure = false;
              // Pri slepej inventúre chceme vidieť 0, kým to nespočítame?
              // Alebo chceme vidieť pôvodný stav zo skladu?
              // Ak chcete vidieť stav zo skladu kým to nie je potvrdené, zmažte tento riadok:
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

    if (this.rezimZobrazenia === 'regal') {
      this.ulozenyStavRegal = {
        skladId: this.vybranySkladId,
        regalId: this.vybranyRegalId,
        search: this.searchQuery,
        kategoria: this.filterKategoria
      };
    }

    this.rezimZobrazenia = novyRezim;

    if (this.rezimZobrazenia === 'regal') {
      this.jeGlobalnyPohlad = false;
      this.vybranySkladId = this.ulozenyStavRegal.skladId;
      this.vybranyRegalId = this.ulozenyStavRegal.regalId;
      this.searchQuery = this.ulozenyStavRegal.search;
      this.filterKategoria = this.ulozenyStavRegal.kategoria;

      if (this.vybranySkladId && this.regaly.length === 0) {
        try {
          this.regaly = await this.supabaseService.getRegaly(this.vybranySkladId);
        } catch (e) { console.error(e); }
      }
    } else {
      this.jeGlobalnyPohlad = true;
      this.searchQuery = '';
      this.filterKategoria = 'vsetky';
      this.vybranyRegalId = null;
    }

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
    this.searchQuery = event.target.value;
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

    this.isLoading = true;

    // Poistka
    const safetyTimeout = setTimeout(() => {
      if (this.isLoading) {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    }, 5000); // Dal som 5000ms, 1000ms je niekedy málo pre pomalý internet

    try {
      if (this.aktivnaInventura && cielovyRegalId) {
        await this.supabaseService.zapisatDoInventury(
          this.aktivnaInventura.id,
          zasoba.produkt_id,
          cielovyRegalId,
          novyStav
        );
        zasoba.v_inventure = true;
        zasoba.mnozstvo_ks = novyStav;
        await this.zobrazToast(`Zapísané: ${novyStav}`, 'primary');
      } else {
        await this.supabaseService.updateZasobu(zasoba.id, zasoba.produkt_id, novyStav, zasoba.mnozstvo_ks);
        zasoba.mnozstvo_ks = novyStav;
        await this.zobrazToast(`Uložené: ${novyStav}`, 'success');
      }
      this.aktualizovatFilter();

    } catch (error: any) {
      console.error('Chyba:', error);
      alert('CHYBA: ' + error.message);
    } finally {
      clearTimeout(safetyTimeout);
      setTimeout(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }, 0);
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

  prihlasitOdberZmien() {
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
    }

    this.realtimeSubscription = this.supabaseService.listenToInventuraChanges().subscribe((payload) => {
      console.log('⚡ REALTIME ZMENA:', payload);
      this.spracovatZmenu(payload);
    });
  }

  spracovatZmenu(payload: any) {
    const novyZaznam = payload.new;
    const staryZaznam = payload.old;
    const typUdalosti = payload.eventType;

    if (novyZaznam && this.aktivnaInventura && novyZaznam.inventura_id !== this.aktivnaInventura.id) {
      return;
    }

    const index = this.zasoby.findIndex(z =>
      z.produkt_id === (novyZaznam?.produkt_id || staryZaznam?.produkt_id) &&
      z.regal_id === (novyZaznam?.regal_id || staryZaznam?.regal_id)
    );

    if (index > -1) {
      const zasoba = this.zasoby[index];
      if (typUdalosti === 'DELETE') {
        zasoba.v_inventure = false;
        zasoba.mnozstvo_ks = 0;
      } else {
        zasoba.mnozstvo_ks = novyZaznam.mnozstvo;
        zasoba.v_inventure = true;
      }
    } else if (typUdalosti === 'INSERT') {
      const patriSem = !this.jeGlobalnyPohlad || (novyZaznam.regal_id === this.vybranyRegalId);
      if (patriSem) {
        this.obnovitZoznamPodlaRezimu();
        return;
      }
    }

    this.aktualizovatFilter();
    this.cdr.detectChanges();
  }
}