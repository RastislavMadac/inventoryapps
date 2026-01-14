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
  addCircleOutline, createOutline
} from 'ionicons/icons';

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

  sklady: Sklad[] = [];
  regaly: Regal[] = [];
  filtrovaneRegaly: Regal[] = []; // ✅ Pridané: Toto chýbalo pre filtrovanie v selecte

  aktivnaInventura: Inventura | null = null;

  zasoby: SkladovaZasobaView[] = []; // Všetky stiahnuté dáta
  filtrovaneZasoby: SkladovaZasobaView[] = []; // Dáta zobrazené na obrazovke (po filtri)

  vybranySkladId: number | null = null;
  vybranyRegalId: number | null = null;
  isLoading = false;

  searchQuery: string = '';
  filterKategoria: string = 'vsetky';

  constructor(
    public supabaseService: SupabaseService,
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
      'create-outline': createOutline
    });
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
    this.supabaseService.supabase.removeAllChannels();
  }

  async doRefresh(event: any) {
    console.log('🔄 Manuálny refresh...');
    await this.checkInventura();
    await this.nacitajSklady();
    // Ak máme vybraný sklad, znova načítame aj regály
    if (this.vybranySkladId) {
      this.filtrovaneRegaly = await this.supabaseService.getRegaly(this.vybranySkladId);
    }
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

  // --- HLAVNÁ LOGIKA SŤAHOVANIA DÁT ---
  async obnovitZoznamPodlaRezimu() {
    this.isLoading = true;
    try {
      console.log('🔄 Sťahujem dáta pre režim:', this.rezimZobrazenia);

      // 1. ZÍSKANIE ZOZNAMU PRODUKTOV
      if (this.rezimZobrazenia === 'regal') {
        if (this.vybranyRegalId) {
          // Režim "Po Regáloch": Sťahujeme len to, čo je na regáli
          this.zasoby = await this.supabaseService.getZasobyNaRegali(this.vybranyRegalId);
        } else {
          this.zasoby = [];
        }
      }
      else if (this.rezimZobrazenia === 'global') {
        // Režim "Všetky": Sťahujeme celý katalóg
        this.zasoby = await this.supabaseService.getVsetkyProduktyKatalog();
      }
      else if (this.rezimZobrazenia === 'v_inventure' && this.aktivnaInventura) {
        // Režim "Hotové"
        const hotove = await this.supabaseService.getPolozkyVInventure(this.aktivnaInventura.id);
        this.zasoby = hotove.map(z => ({ ...z, v_inventure: true }));
        this.aktualizovatFilter();
        this.isLoading = false;
        return; // Tu končíme, netreba párovať
      }
      else {
        this.zasoby = [];
        this.aktualizovatFilter();
        this.isLoading = false;
        return;
      }

      // 2. PÁROVANIE S INVENTÚROU (Ak je aktívna)
      if (this.aktivnaInventura) {
        const rawInventura = await this.supabaseService.getRawInventuraData(this.aktivnaInventura.id);

        // Mapa: "produktID-regalID" -> množstvo
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
              // Pre "slepú" inventúru: ak nie je spočítané, ukáž 0 (aby užívateľ musel zadať)
              z.mnozstvo_ks = 0;
            }
          }
        });
      }

      // 3. Aplikujeme filtre
      this.aktualizovatFilter();

    } catch (e) {
      console.error('❌ Chyba pri sťahovaní:', e);
    } finally {
      this.isLoading = false;
    }
  }

  // --- FILTROVANIE A VYHĽADÁVANIE ---

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

    // Filter Kategória
    if (this.filterKategoria && this.filterKategoria !== 'vsetky') {
      temp = temp.filter(z => (z.kategoria || 'Bez kategórie') === this.filterKategoria);
    }

    // Filter Text (Názov)
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      temp = temp.filter(z => z.nazov && z.nazov.toLowerCase().includes(q));
    }

    this.filtrovaneZasoby = temp;
  }

  get unikatneKategorie(): string[] {
    const kategorie = this.zasoby.map(z => z.kategoria || 'Bez kategórie');
    return [...new Set(kategorie)].sort();
  }

  // --- UI LOGIKA (Zmena Skladu/Regálu/Režimu) ---

  private ulozenyStavRegal = {
    skladId: null as number | null,
    regalId: null as number | null,
    search: '',
    kategoria: 'vsetky'
  };

  async zmenitRezim(event: any) {
    const novyRezim = event.detail.value;

    // Uložíme stav pred zmenou
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

      if (this.vybranySkladId) {
        // Ak sme sa vrátili a máme vybraný sklad, obnovíme regály
        this.filtrovaneRegaly = await this.supabaseService.getRegaly(this.vybranySkladId);
      }
    } else {
      this.jeGlobalnyPohlad = true;
      this.searchQuery = '';
      this.filterKategoria = 'vsetky';
      // this.vybranyRegalId = null;
    }

    await this.obnovitZoznamPodlaRezimu();
  }

  // ✅ Opravená funkcia pre zmenu skladu
  async priZmeneSkladu() {
    console.log('Zmena skladu na ID:', this.vybranySkladId);

    this.vybranyRegalId = null;
    this.zasoby = [];
    this.filtrovaneZasoby = [];

    if (this.vybranySkladId) {
      try {
        this.isLoading = true;
        this.filtrovaneRegaly = await this.supabaseService.getRegaly(this.vybranySkladId);
        this.regaly = this.filtrovaneRegaly;
      } catch (error) {
        this.zobrazToast('Nepodarilo sa načítať regály.', 'danger');
      } finally {
        this.isLoading = false;
      }
    } else {
      this.filtrovaneRegaly = [];
    }

    this.aktualizovatFilter();
  }

  // ✅ Opravená funkcia pre zmenu regálu
  async priZmeneRegalu() {
    console.log('Zmena regálu na ID:', this.vybranyRegalId);
    if (this.rezimZobrazenia === 'regal') {
      await this.obnovitZoznamPodlaRezimu();
    } else {
      this.aktualizovatFilter();
    }
  }

  // --- MODALY (Nová Lokácia, Nový Produkt, Úprava) ---

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
        // ✅ Voláme správnu funkciu
        await this.priZmeneSkladu();
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

  async upravitProduktDetail(zasoba: SkladovaZasobaView) {
    const modal = await this.modalController.create({
      component: NovyProduktModalComponent,
      componentProps: {
        produktNaUpravu: {
          id: zasoba.produkt_id,
          nazov: zasoba.nazov,
          vlastne_id: '',
          kategoria_id: null,
          jednotka: zasoba.jednotka,
          balenie_ks: zasoba.balenie_ks
        }
      }
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') {
      this.obnovitZoznamPodlaRezimu();
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

  // --- ZÁPIS DO DATABÁZY ---

  async ulozitZmenu(zasoba: SkladovaZasobaView, novyStavInput: string | number) {
    const novyStav = Number(novyStavInput);
    if (isNaN(novyStav)) return;

    let cielovyRegalId = zasoba.regal_id;

    if (!cielovyRegalId) {
      cielovyRegalId = this.vybranyRegalId || undefined;
    }

    if (!cielovyRegalId) {
      const alert = await this.alertController.create({
        header: 'Kam to mám zapísať?',
        message: 'Vybrali ste nový produkt, ale nemáte určenú pozíciu. Prosím, najprv hore vo filtri vyberte Sklad a Regál.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    this.isLoading = true;
    const safetyTimeout = setTimeout(() => {
      if (this.isLoading) {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    }, 5000);

    try {
      if (this.aktivnaInventura) {
        // --- REŽIM INVENTÚRY ---
        if (novyStav > 0) {
          await this.supabaseService.zapisatDoInventury(
            this.aktivnaInventura.id,
            zasoba.produkt_id,
            cielovyRegalId,
            novyStav
          );
          zasoba.v_inventure = true;
          zasoba.mnozstvo_ks = novyStav;
          if (!zasoba.regal_id) zasoba.regal_id = cielovyRegalId;
          await this.zobrazToast(`Zapísané: ${novyStav} ks`, 'primary');

        } else {
          // Nula = Zmazať z inventúry
          await this.supabaseService.zmazatZaznamZInventury(
            this.aktivnaInventura.id,
            zasoba.produkt_id,
            cielovyRegalId
          );
          zasoba.v_inventure = false;
          zasoba.mnozstvo_ks = 0;
          await this.zobrazToast('Položka odstránená z inventúry', 'medium');
        }

      } else {
        // --- BEŽNÝ REŽIM (MIMO INVENTÚRY) ---
        if (zasoba.id === 0) {
          await this.supabaseService.insertZasobu(zasoba.produkt_id, cielovyRegalId, novyStav);
        } else {
          await this.supabaseService.updateZasobu(zasoba.id, zasoba.produkt_id, novyStav, zasoba.mnozstvo_ks);
        }
        zasoba.mnozstvo_ks = novyStav;
        if (!zasoba.regal_id) zasoba.regal_id = cielovyRegalId;
        await this.zobrazToast(`Uložené na sklad: ${novyStav}`, 'success');
      }

      this.aktualizovatFilter();

    } catch (error: any) {
      console.error('Chyba:', error);
      alert('CHYBA ZÁPISU: ' + (error.message || JSON.stringify(error)));
    } finally {
      clearTimeout(safetyTimeout);
      setTimeout(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }, 0);
    }
  }

  // --- REALTIME & HELPERY ---

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