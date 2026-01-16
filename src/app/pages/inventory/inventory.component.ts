import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ViewWillEnter } from '@ionic/angular';
import {
  ModalController, ToastController, AlertController, IonicSafeString
} from '@ionic/angular';

import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton, ActionSheetController,
  IonSegment, IonSegmentButton, IonLabel, IonIcon, IonChip,
  IonItem, IonSelect, IonSelectOption, IonSearchbar, IonSpinner,
  IonList, IonCard, IonFab, IonFabButton,
  IonRefresher, IonRefresherContent
  , IonCardContent, IonButton
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import {
  add, addOutline, searchOutline, filterOutline,
  caretDownOutline, clipboardOutline, cubeOutline,
  arrowUpOutline, locationOutline, listOutline,
  checkmarkCircle, checkmarkDoneOutline, timeOutline,
  addCircleOutline, createOutline, trashOutline, closeCircle
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
    IonRefresher, IonRefresherContent, IonCardContent,
    IonButton
  ],
  providers: [
    ModalController,
    ToastController,
    AlertController
  ]
})
export class InventoryComponent implements OnInit, ViewWillEnter {
  private realtimeSubscription: Subscription | null = null;
  @ViewChild('content', { static: false }) content!: IonContent;
  rezimZobrazenia: 'regal' | 'global' | 'v_inventure' = 'regal';
  jeGlobalnyPohlad = false;

  sklady: Sklad[] = [];
  regaly: Regal[] = [];
  filtrovaneRegaly: Regal[] = []; // ✅ Pridané: Toto chýbalo pre filtrovanie v selecte

  aktivnaInventura: Inventura | null = null;
  private idPolozkyPreScroll: number | null = null;
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
    private cdr: ChangeDetectorRef,
    private modalCtrl: ModalController
  ) {
    addIcons({ clipboardOutline, closeCircle, addCircleOutline, caretDownOutline, searchOutline, filterOutline, arrowUpOutline, createOutline, trashOutline, checkmarkDoneOutline, locationOutline, add, addOutline, cubeOutline, listOutline, checkmarkCircle, timeOutline });
  }
  ngOnInit() {
    this.nacitajSklady();
  }
  aktualnaRola: string = 'user';

  async ionViewWillEnter() {
    console.log('🔄 ionViewWillEnter: Obnovujem dáta...');
    await this.checkInventura();
    await this.obnovitZoznamPodlaRezimu();
    this.prihlasitOdberZmien();
    this.aktualnaRola = await this.supabaseService.ziskatRoluPouzivatela();
    console.log('👮 Prihlásený ako:', this.aktualnaRola);
  }

  get jeAdmin(): boolean {
    return this.aktualnaRola === 'admin';
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


  async obnovitZoznamPodlaRezimu() {
    this.isLoading = true;
    try {
      console.log('🔄 Sťahujem dáta. Režim:', this.rezimZobrazenia, 'Regál:', this.vybranyRegalId);

      // 1. ZÍSKANIE ZOZNAMU PRODUKTOV
      if (this.vybranyRegalId && this.rezimZobrazenia !== 'v_inventure') {
        this.zasoby = await this.supabaseService.getZasobyNaRegali(this.vybranyRegalId);
      }
      else if (this.rezimZobrazenia === 'regal' && !this.vybranyRegalId) {
        this.zasoby = [];
      }
      else if (this.rezimZobrazenia === 'global') {
        this.zasoby = await this.supabaseService.getVsetkyProduktyKatalog();
      }
      else if (this.rezimZobrazenia === 'v_inventure' && this.aktivnaInventura) {
        const hotove = await this.supabaseService.getPolozkyVInventure(this.aktivnaInventura.id);
        this.zasoby = hotove.map(z => ({ ...z, v_inventure: true }));
      }
      else {
        this.zasoby = [];
      }

      // 2. PÁROVANIE S INVENTÚROU
      // Ak je otvorená inventúra, chceme vidieť len to, čo sme už pípli (alebo 0 ak ešte nie)
      if (this.aktivnaInventura && this.rezimZobrazenia !== 'v_inventure') {
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
              // A) Položka UŽ BOLA zapísaná v inventúre -> Zobrazíme to číslo
              z.v_inventure = true;
              z.mnozstvo_ks = mapa.get(kluc) || 0;
            } else {
              // B) Položka EŠTE NEBOLA zapísaná -> Nastavíme 0 (Slepá inventúra)
              z.v_inventure = false;
              z.mnozstvo_ks = 0; // 👈 TOTO JE KĽÚČOVÁ ZMENA
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

    // 1. DEBUG: Aby sme videli, čo sa deje
    console.log('Filtrujem...', temp.length, 'položiek. Režim:', this.rezimZobrazenia);

    // ---------------------------------------------------------
    // A) FILTER PODĽA REGÁLU (Najvyššia priorita)
    // ---------------------------------------------------------
    if (this.vybranyRegalId) {
      temp = temp.filter(z => z.regal_id == this.vybranyRegalId);
    }

    // ---------------------------------------------------------
    // B) FILTER PODĽA SKLADU (Ak nie je vybraný konkrétny regál)
    // ---------------------------------------------------------
    else if (this.vybranySkladId) {

      // Získame zoznam IDčiek regálov, ktoré patria do vybraného skladu
      // (Toto pole 'filtrovaneRegaly' sa naplní, keď vyberiete sklad v dropdown menu)
      const idckaRegalovVSklade = this.filtrovaneRegaly.map(r => r.id);

      temp = temp.filter(z => {
        // VÝNIMKA PRE GLOBAL REŽIM (Katalógové položky):
        // Ak je to katalógová položka (id=0) a nemá určený regál, necháme ju zobrazenú
        if (this.rezimZobrazenia === 'global' && z.id === 0 && !z.regal_id) {
          return true;
        }

        // KĽÚČOVÁ OPRAVA PRE "HOTOVÉ":
        // Ak má položka 'regal_id', skontrolujeme, či je tento regál v zozname regálov vybraného skladu.
        if (z.regal_id) {
          // Používame 'loose equality' (==) pre prípad, že jedno je string a druhé number
          return idckaRegalovVSklade.some(id => id == z.regal_id);
        }

        // Fallback: Ak má položka priamo sklad_id (niektoré views to majú)
        if ((z as any).sklad_id) {
          return (z as any).sklad_id == this.vybranySkladId;
        }

        return false;
      });
    }

    // ---------------------------------------------------------
    // C) FILTER PODĽA KATEGÓRIE
    // ---------------------------------------------------------
    if (this.filterKategoria && this.filterKategoria !== 'vsetky') {
      temp = temp.filter(z => (z.kategoria || 'Bez kategórie') === this.filterKategoria);
    }

    // ---------------------------------------------------------
    // D) FILTER PODĽA TEXTU (Názov / EAN)
    // ---------------------------------------------------------
    if (this.searchQuery) {
      // 👇 "Vyčistíme" to, čo používateľ napísal (napr. "stava" ostane "stava")
      const q = this.odstranitDiakritiku(this.searchQuery);

      temp = temp.filter(z => {
        // 👇 "Vyčistíme" názov produktu (napr. "Šťava" sa zmení na "stava")
        const nazovBezDiakritiky = this.odstranitDiakritiku(z.nazov || '');

        // EAN zvyčajne diakritiku nemá, stačí len include
        const ean = (z.ean || '').toLowerCase();

        return nazovBezDiakritiky.includes(q) || ean.includes(q);
      });
    }

    this.filtrovaneZasoby = temp;
    // console.log('Výsledok filtra:', this.filtrovaneZasoby.length);
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

    // 1. Ak sme boli doteraz v režime 'regal', ULOŽÍME si aktuálny stav
    if (this.rezimZobrazenia === 'regal') {
      this.ulozenyStavRegal = {
        skladId: this.vybranySkladId,
        regalId: this.vybranyRegalId,
        search: this.searchQuery,
        kategoria: this.filterKategoria
      };
    }

    this.rezimZobrazenia = novyRezim;

    // 2. Ak prepíname NA 'regal', OBNOVÍME uložený stav
    if (this.rezimZobrazenia === 'regal') {
      this.jeGlobalnyPohlad = false;

      // Obnovíme hodnoty z pamäte
      this.vybranySkladId = this.ulozenyStavRegal.skladId;
      this.vybranyRegalId = this.ulozenyStavRegal.regalId;
      this.searchQuery = this.ulozenyStavRegal.search || '';
      this.filterKategoria = this.ulozenyStavRegal.kategoria || 'vsetky';

      // DÔLEŽITÉ: Ak máme vybraný sklad, musíme znova načítať zoznam regálov,
      // inak by dropdown regálu ukazoval len ID alebo nič, lebo by nemal zoznam možností.
      if (this.vybranySkladId) {
        this.isLoading = true;
        try {
          this.filtrovaneRegaly = await this.supabaseService.getRegaly(this.vybranySkladId);
          this.regaly = this.filtrovaneRegaly;
        } catch (e) {
          console.error(e);
        } finally {
          this.isLoading = false;
        }
      }
    }

    // 3. Ak prepíname NA 'global' (Všetky), VYNULUJEME filtre
    else if (this.rezimZobrazenia === 'global') {
      this.jeGlobalnyPohlad = true;

      // Toto zabezpečí, že sa filter podľa skladu/regálu neaplikuje
      this.vybranySkladId = null;
      this.vybranyRegalId = null;

      this.searchQuery = '';
      this.filterKategoria = 'vsetky';
    }

    // 4. Ak prepíname na 'v_inventure' (Hotové)
    else {
      this.jeGlobalnyPohlad = false;
      // Tiež vynulujeme, aby sme videli všetky hotové položky (nie len z jedného regálu)
      this.vybranySkladId = null;
      this.vybranyRegalId = null;
      this.searchQuery = '';
    }

    // Nakoniec načítame dáta pre nový režim
    await this.obnovitZoznamPodlaRezimu();
  }
  async priZmeneSkladu() {
    console.log('🏭 Zmena skladu na ID:', this.vybranySkladId);

    // 1. HNEĎ NA ZAČIATKU resetujeme premenné (aby sme nevideli staré dáta)
    this.vybranyRegalId = null;
    this.filterKategoria = 'vsetky';

    // Vymažeme zoznam produktov, kým sa nenačítajú nové
    if (this.rezimZobrazenia === 'regal') {
      this.zasoby = [];
      this.filtrovaneZasoby = [];
    }

    // 2. Načítame regály pre nový sklad
    this.isLoading = true;
    try {
      if (this.vybranySkladId) {
        // Stiahneme regály z databázy
        const regalyZoServera = await this.supabaseService.getRegaly(this.vybranySkladId);
        this.filtrovaneRegaly = regalyZoServera;
        this.regaly = regalyZoServera;

        // 👇👇👇 3. AUTOMATICKÝ VÝBER A NAČÍTANIE TOVARU 👇👇👇
        if (this.filtrovaneRegaly.length > 0) {
          // Nastavíme prvý regál ako vybraný
          this.vybranyRegalId = this.filtrovaneRegaly[0].id;
          console.log('✅ Automaticky vybraný regál:', this.vybranyRegalId);

          // HNEĎ spustíme načítanie tovaru pre tento regál
          // (Toto prepíše 'isLoading' na true vnútri funkcie, takže to nevadí)
          await this.obnovitZoznamPodlaRezimu();
        } else {
          // Ak sklad nemá žiadne regály, ukončíme loading
          this.isLoading = false;
        }

      } else {
        // Ak sme odznačili sklad (žiaden výber)
        this.filtrovaneRegaly = [];
        this.isLoading = false;
      }
    } catch (error) {
      console.error('Chyba pri zmene skladu:', error);
      this.zobrazToast('Nepodarilo sa načítať regály.', 'danger');
      this.isLoading = false;
    }

    // ⚠️ POZOR: Tu na konci už NIKDY nemažte this.zasoby, 
    // lebo by ste si vymazali to, čo sa o pár riadkov vyššie načítalo.
  }
  async priZmeneRegalu() {
    console.log('Zmena regálu na ID:', this.vybranyRegalId);

    // 👇👇👇 PRIDANÉ: Reset kategórie na "Všetky" 👇👇👇
    this.filterKategoria = 'vsetky';
    // (Voliteľné: this.searchQuery = '';)

    if (this.rezimZobrazenia === 'regal') {
      await this.obnovitZoznamPodlaRezimu();
    } else {
      this.aktualizovatFilter();
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
      this.cdr.detectChanges();
      // 1. Obnovíme zoznam
      await this.obnovitZoznamPodlaRezimu();

      // 2. 👇 ZÍSKAME ID NOVÉHO PRODUKTU Z MODALU
      // (Predpokladám, že modal vracia objekt, kde je napr. data.id alebo data.produkt_id)
      const noveId = data.id || data.produkt_id || data.newItemId;

      if (noveId) {
        this.idPolozkyPreScroll = Number(noveId);

        // 3. 👇 ZAVOLÁME SCROLLOVANIE
        this.skrolovatNaZapamatanuPolozku();
      }
    }
  }

  async upravitProduktDetail(zasoba: SkladovaZasobaView) {
    console.log('🛠️ Otváram úpravu pre:', zasoba);

    // 👇 1. ZMENA: Uložíme si ID (Opravené z 'z.id' na 'zasoba.id')
    this.idPolozkyPreScroll = zasoba.id;

    const modal = await this.modalController.create({
      component: NovyProduktModalComponent,
      componentProps: {
        produktNaUpravu: {
          id: zasoba.produkt_id,
          nazov: zasoba.nazov,
          vlastne_id: zasoba.ean || '',
          jednotka: zasoba.jednotka,
          balenie_ks: zasoba.balenie_ks,
          kategoria: zasoba.kategoria,
          sklad_id: this.vybranySkladId || (zasoba as any).sklad_id,
          regal_id: zasoba.regal_id
        }
      }
    });

    await modal.present();
    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm' && data) {
      console.log('📦 DÁTA Z MODALU:', data);

      this.isLoading = true;
      try {
        // --- 1. Update Produktu ---
        const updateData = {
          nazov: data.nazov || data.produktData?.nazov,
          vlastne_id: data.vlastne_id || data.produktData?.vlastne_id,
          jednotka: data.jednotka || data.produktData?.jednotka,
          balenie_ks: data.balenie_ks || data.produktData?.balenie_ks,
          kategoria_id: data.kategoria_id || data.produktData?.kategoria_id
        };

        Object.keys(updateData).forEach(key =>
          (updateData as any)[key] === undefined && delete (updateData as any)[key]
        );

        if (Object.keys(updateData).length > 0) {
          await this.supabaseService.updateProdukt(zasoba.produkt_id, updateData);
        }

        // --- 2. Riešenie Lokácie ---
        const novyRegalId = Number(data.novyRegalId || data.regal_id);
        const staryRegalId = Number(zasoba.regal_id);

        // A) Presun existujúcej zásoby
        if (zasoba.id > 0 && novyRegalId && novyRegalId !== staryRegalId) {
          console.log(`🚚 Presúvam zásobu ${zasoba.id} na regál ${novyRegalId}`);
          await this.supabaseService.presunutZasobu(zasoba.id, novyRegalId);
          this.zobrazToast('Produkt aktualizovaný a PRESUNUTÝ.', 'success');
        }

        // B) Pridanie novej zásoby z katalógu
        else if (zasoba.id === 0 && novyRegalId) {
          console.log(`✨ Vytváram novú zásobu pre produkt ${zasoba.produkt_id} na regáli ${novyRegalId}`);
          // Tu by bolo ideálne získať nové ID, ak by sme chceli scrollovať na novú položku,
          // ale zatiaľ to necháme takto.
          await this.supabaseService.insertZasobu(zasoba.produkt_id, novyRegalId, 0);
          this.zobrazToast('Produkt bol priradený na regál.', 'success');
        }

        else {
          this.zobrazToast('Produkt aktualizovaný.', 'success');
        }

        // --- 3. Refresh a Scroll ---
        await this.obnovitZoznamPodlaRezimu();

        // 👇 2. ZMENA: Zavoláme funkciu na scrollovanie
        this.skrolovatNaZapamatanuPolozku();

      } catch (error: any) {
        console.error('❌ Chyba:', error);

        if (error.code === '23505' || (error.message && error.message.includes('duplicate key'))) {
          this.zobrazToast('⚠️ Tento produkt už na vybranom regáli existuje.', 'warning');
        } else {
          this.zobrazToast('Chyba: ' + (error.message || error), 'danger');
        }
      } finally {
        this.isLoading = false;
      }
    }
  }

  async otvoritUpravu(zasoba: SkladovaZasobaView) {
    // 1. 👇 Zapamätáme si ID položky pred otvorením modalu
    this.idPolozkyPreScroll = zasoba.id;

    const modal = await this.modalController.create({
      component: CalculatorModalComponent,
      cssClass: 'my-custom-modal',
      componentProps: {
        nazovProduktu: zasoba.nazov,
        aktualnyStav: zasoba.mnozstvo_ks,
        balenie: zasoba.balenie_ks
      }
    });

    await modal.present();

    // 2. 👇 Počkáme na zatvorenie modalu (nahradili sme .then za await)
    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm') {
      // Skontrolujte, či vraciate dáta priamo, alebo zabalené. 
      // Zvyčajne je to takto: data = { novyStav: 15 }
      const novyStav = data.novyStav;

      // 3. 👇 Zavoláme uloženie a POČKAME kým sa dokončí (await)
      // Predpokladám, že funkcia ulozitZmenu() robí aj refresh zoznamu (obnovitZoznamPodlaRezimu)
      await this.ulozitZmenu(zasoba, novyStav);

      // 4. 👇 Až teraz, keď je zoznam obnovený, sa vrátime na pozíciu
      this.skrolovatNaZapamatanuPolozku();
    } else {
      // Ak užívateľ dal "Zrušiť", zabudneme ID
      this.idPolozkyPreScroll = null;
    }
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
    }, 1000);

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
  async zmazatPolozku(zasoba: SkladovaZasobaView, event: Event) {
    event.stopPropagation();

    // 1. DEBUG: Vypíšeme si, s čím pracujeme
    console.log('🗑️ Mazem polozku:', zasoba);
    console.log('👀 Rezim:', this.rezimZobrazenia);

    // Kontrola, či môžeme mazať (Katalógové položky)
    if (this.rezimZobrazenia !== 'v_inventure' && zasoba.id === 0 && !zasoba.v_inventure) {
      this.zobrazToast('Túto položku nie je možné zmazať (nie je na sklade).', 'warning');
      return;
    }

    // 2. Inicializácia premenných s predvolenými hodnotami (aby nikdy neboli undefined)
    let nadpis = 'Potvrdenie';
    let textSpravy = 'Naozaj chcete vykonať túto akciu?';
    let tlacidloText = 'OK';
    let cssClass = '';
    const nazovProduktu = zasoba.nazov || 'túto položku'; // Poistka ak chýba názov

    // 3. Logika naplnenia textu
    if (this.rezimZobrazenia === 'v_inventure') {
      // --- Režim HOTOVÉ ---
      nadpis = 'Zrušiť inventúrny zápis?';
      textSpravy = `Naozaj chcete odstrániť "${nazovProduktu}" zo zoznamu spočítaných položiek?\n\n(Tovar ostane v databáze, len sa vymaže z tejto inventúry)`;
      tlacidloText = 'Zrušiť zápis';
      cssClass = 'alert-button-cancel';
    } else {
      // --- Ostatné Režimy ---
      nadpis = 'Odstrániť tovar?';
      textSpravy = `Naozaj chcete kompletne odstrániť "${nazovProduktu}" z tohto umiestnenia?\n\n(Vymaže sa zo skladu aj z inventúry)`;
      tlacidloText = 'Odstrániť';
      cssClass = 'alert-button-delete';
    }

    // 4. DEBUG: Skontrolujeme, či je správa naplnená
    console.log('📝 Text správy:', textSpravy);

    // 5. Vytvorenie Alertu (Zatiaľ bez IonicSafeString pre istotu)
    const alert = await this.alertController.create({
      header: nadpis,
      message: textSpravy, // Tu posielame obyčajný string
      cssClass: 'custom-alert',
      buttons: [
        {
          text: 'Zrušiť',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: tlacidloText,
          role: 'destructive',
          cssClass: cssClass,
          handler: async () => {
            console.log('✅ Potvrdené mazanie');
            await this.vykonatVymazanie(zasoba);
          }
        }
      ]
    });

    await alert.present();
  }

  // 2. VYKONANIE MAZANIA (Logika podľa režimu)
  async vykonatVymazanie(zasoba: SkladovaZasobaView) {
    this.isLoading = true;
    try {

      // Zistíme ID regálu (v režime Hotové je priamo v objekte, inak z filtra)
      const regalId = zasoba.regal_id || this.vybranyRegalId;

      // ==========================================
      // SCENÁR A: Sme v záložke "HOTOVÉ"
      // ==========================================
      if (this.rezimZobrazenia === 'v_inventure') {
        if (this.aktivnaInventura && regalId) {
          // Len vymažeme riadok z tabuľky 'inventura_polozky'
          await this.supabaseService.zmazatZaznamZInventury(
            this.aktivnaInventura.id,
            zasoba.produkt_id,
            regalId
          );
          this.zobrazToast('Zápis bol zrušený.', 'success');
        }
      }

      // ==========================================
      // SCENÁR B: Sme v záložke "REGÁL" alebo "VŠETKY"
      // ==========================================
      else {
        // 1. Najprv z inventúry (ak existuje), aby nebola chyba cudzích kľúčov
        if (this.aktivnaInventura && regalId) {
          try {
            await this.supabaseService.zmazatZaznamZInventury(
              this.aktivnaInventura.id,
              zasoba.produkt_id,
              regalId
            );
          } catch (e) { /* Ignorujeme, ak nebolo v inventúre */ }
        }

        // 2. Potom fyzicky zo skladu
        if (zasoba.id > 0) {
          await this.supabaseService.zmazatZasobuZoSkladu(zasoba.id);
          this.zobrazToast('Položka kompletne odstránená.', 'success');
        }
      }

      // Obnovíme zoznam
      await this.obnovitZoznamPodlaRezimu();

    } catch (e: any) {
      console.error(e);
      this.zobrazToast('Chyba pri mazaní: ' + e.message, 'danger');
    } finally {
      this.isLoading = false;
    }
  }
  async zrusitFiltre() {
    this.vybranySkladId = null;
    this.vybranyRegalId = null;
    this.searchQuery = '';
    this.filterKategoria = 'vsetky';
    this.filtrovaneRegaly = []; // Vyčistíme zoznam regálov

    // Obnovíme dáta (stiahne sa všetko nanovo podľa aktuálneho režimu)
    await this.obnovitZoznamPodlaRezimu();
  }
  odstranitDiakritiku(text: string): string {
    if (!text) return '';
    return text
      .normalize("NFD")                 // Rozdelí znaky (napr. "č" na "c" + "ˇ")
      .replace(/[\u0300-\u036f]/g, "")  // Odstráni tie oddelené značky
      .toLowerCase();                   // Zmení na malé písmená
  }

  async otvoritNovuLokaciu() {
    const modal = await this.modalCtrl.create({
      component: NovaLokaciaModalComponent,
      initialBreakpoint: 0.6,
      breakpoints: [0, 0.6, 0.9]
    });

    await modal.present();

    const { role } = await modal.onWillDismiss();

    if (role === 'confirm') {
      // 1. Obnovíme zoznam všetkých skladov (ak pribudol nový sklad)
      this.sklady = await this.supabaseService.getSklady();

      // 2. Ak máme práve vybratý nejaký sklad, obnovíme aj jeho regály (ak pribudol regál)
      if (this.vybranySkladId) {
        await this.priZmeneSkladu(); // Použijeme vašu existujúcu metódu
      }

      this.zobrazToast('Lokácia bola úspešne pridaná', 'success');
    }
  }
  async skrolovatNaZapamatanuPolozku() {
    if (!this.idPolozkyPreScroll) return;

    console.log('🚀 Začínam proces hľadania ID:', this.idPolozkyPreScroll);

    // Poistka: Ak content ešte nie je načítaný
    if (!this.content) {
      console.error('❌ CHYBA: Premenná "content" je undefined! Skrolovanie nemôže fungovať.');
      return;
    }

    let pokusy = 0;
    const maxPokusov = 40; // 4 sekundy

    const interval = setInterval(async () => {
      const elementId = 'polozka-' + this.idPolozkyPreScroll;
      const element = document.getElementById(elementId);

      if (element) {
        clearInterval(interval);
        console.log('✅ Element nájdený v HTML!');

        try {
          // 1. Získame samotný skrolovací element z Ionicu
          const scrollElement = await this.content.getScrollElement();

          // 2. Zistíme, kde sa element nachádza relatívne k oknu
          const rect = element.getBoundingClientRect();

          // 3. Zistíme, kde sme teraz odscrollovaní
          const currentScrollTop = scrollElement.scrollTop;

          // 4. Vypočítame PRESNÚ pozíciu:
          // (Kde je element na obrazovke) + (Koľko sme už odscrollovali) - (Rezerva zhora)
          // rect.top môže byť záporné, ak je element hore mimo obrazovky, preto pripočítavame scrollTop
          // -150 je rezerva, aby bol element v strede obrazovky, nie nalepený hore pod headerom
          const y = rect.top + currentScrollTop - 150;

          console.log(`🧮 Výpočet: rect.top(${Math.round(rect.top)}) + scrollTop(${Math.round(currentScrollTop)}) = ${Math.round(y)}`);

          // 5. Vykonáme scroll
          await this.content.scrollToPoint(0, y, 600);

          // 6. Animácia
          element.classList.add('highlight-anim');
          setTimeout(() => element.classList.remove('highlight-anim'), 2000);

          console.log('🏁 Scroll príkaz odoslaný.');
          this.idPolozkyPreScroll = null;

        } catch (err) {
          console.error('❌ Chyba pri výpočte súradníc:', err);
        }

      } else {
        pokusy++;
        // console.log(`⏳ Čakám... (${pokusy}/${maxPokusov})`);

        if (pokusy >= maxPokusov) {
          console.warn(`⚠️ Timeout: Element s ID ${elementId} sa nenašiel.`);
          clearInterval(interval);
          this.idPolozkyPreScroll = null;
        }
      }
    }, 100);
  }
}