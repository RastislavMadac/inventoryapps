import { Component, OnInit, ChangeDetectorRef, ViewChild, Renderer2, ElementRef } from '@angular/core';
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
  , IonCardContent, IonButton, IonBadge, IonInfiniteScroll,
  IonInfiniteScrollContent
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import {
  add, addOutline, searchOutline, filterOutline,
  caretDownOutline, clipboardOutline, cubeOutline,
  arrowUpOutline, locationOutline, listOutline,
  checkmarkCircle, checkmarkDoneOutline, timeOutline,
  addCircleOutline, createOutline, trashOutline, closeCircle, settingsOutline
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
    IonButton, IonSearchbar, IonBadge, IonInfiniteScroll,
    IonInfiniteScrollContent
  ],
  providers: [
    ModalController,
    ToastController,
    AlertController
  ]
})
export class InventoryComponent implements OnInit, ViewWillEnter {

  // 1. Získame referenciu na tlačidlo
  @ViewChild('draggableFab', { read: ElementRef }) fabElement!: ElementRef;

  // 2. Premenné pre pohyb
  private lastX = 0;
  private lastY = 0;
  private currentX = 0;
  private currentY = 0;
  private isDragging = false;
  private realtimeSubscription: Subscription | null = null;
  @ViewChild('content', { static: false }) content!: IonContent;
  rezimZobrazenia: 'regal' | 'global' | 'v_inventure' = 'regal';
  jeGlobalnyPohlad = false;
  zoznamKategorii: string[] = [];
  sklady: Sklad[] = [];
  regaly: Regal[] = [];
  filtrovaneRegaly: Regal[] = [];

  aktivnaInventura: Inventura | null = null;
  private idPolozkyPreScroll: number | null = null;
  zasoby: SkladovaZasobaView[] = [];
  filtrovaneZasoby: SkladovaZasobaView[] = [];

  vybranySkladId: number | null = null;
  vybranyRegalId: number | null = null;
  isLoading = false;

  searchQuery: string = '';
  filterKategoria: string = 'vsetky';

  aktualnaRola: string = 'user';
  pocetNacitanych = 0;
  velkostStranky = 50; // Koľko sťahovať naraz
  vsetkyHotoveNacitane = false; // Či sme už na konci

  private ulozenyStavRegal = {
    skladId: null as number | null,
    regalId: null as number | null,
    search: '',
    kategoria: 'vsetky'
  };

  constructor(
    public supabaseService: SupabaseService,
    private toastController: ToastController,
    private alertController: AlertController,
    private modalController: ModalController,
    private cdr: ChangeDetectorRef,
    private modalCtrl: ModalController,
    private renderer: Renderer2
  ) {
    addIcons({ clipboardOutline, closeCircle, addCircleOutline, caretDownOutline, filterOutline, settingsOutline, arrowUpOutline, trashOutline, checkmarkDoneOutline, locationOutline, createOutline, add, searchOutline, addOutline, cubeOutline, listOutline, checkmarkCircle, timeOutline });
  }

  ngOnInit() {
    this.nacitajSklady();
  }

  async ionViewWillEnter() {
    console.log('🔄 ionViewWillEnter: Obnovujem dáta...');

    await this.nacitajKategoriePreFilter();
    await this.checkInventura();
    await this.obnovitZoznamPodlaRezimu();
    this.prihlasitOdberZmien();
    this.aktualnaRola = await this.supabaseService.ziskatRoluPouzivatela();
    console.log('👮 Prihlásený ako:', this.aktualnaRola);
  }

  get jeAdmin(): boolean {
    return this.aktualnaRola === 'admin';
  }

  async nacitajKategoriePreFilter() {

    // 🅰️ REŽIM: HOTOVÉ (V INVENTÚRE)
    // Tu filtrujeme kategórie dynamicky podľa toho, čo je reálne v zozname
    if (this.rezimZobrazenia === 'v_inventure') {

      // 1. Zoberieme všetky načítané položky
      let relevantnePolozky = this.zasoby;

      // 2. Ak je vybraný SKLAD, zúžime výber
      if (this.vybranySkladId) {
        relevantnePolozky = relevantnePolozky.filter(z => z.sklad_id === this.vybranySkladId);
      }

      // 3. Ak je vybraný REGÁL, zúžime výber ešte viac
      if (this.vybranyRegalId) {
        relevantnePolozky = relevantnePolozky.filter(z => z.regal_id === this.vybranyRegalId);
      }

      // 4. Vytiahneme unikátne názvy kategórií
      const unikatneKategorie = new Set<string>();
      relevantnePolozky.forEach(z => {
        if (z.kategoria && z.kategoria !== 'Bez kategórie') {
          unikatneKategorie.add(z.kategoria);
        }
      });

      // 5. Zoradíme ich podľa abecedy
      this.zoznamKategorii = Array.from(unikatneKategorie).sort((a, b) => a.localeCompare(b));

      console.log('📂 Lokálne prepočítané kategórie:', this.zoznamKategorii);
    }

    // 🅱️ REŽIM: REGÁL alebo GLOBAL
    // Tu sa pýtame servera, lebo nemáme všetky dáta v pamäti
    else {
      let idPreServer = null;

      if (this.rezimZobrazenia === 'regal' && this.vybranyRegalId) {
        idPreServer = this.vybranyRegalId;
      }

      // Voláme existujúcu funkciu zo servisu
      this.zoznamKategorii = await this.supabaseService.getKategoriePreFilter(idPreServer);
    }

    // Kontrola: Ak sme mali vybranú kategóriu, ktorá v novom zozname nie je, prepneme na "Všetky"
    if (this.filterKategoria !== 'vsetky' && !this.zoznamKategorii.includes(this.filterKategoria)) {
      this.filterKategoria = 'vsetky';
      // Ak sme v Hotových, musíme prefiltrovať zoznam znova, lebo sa zmenil filter
      if (this.rezimZobrazenia === 'v_inventure') {
        this.aplikovatFiltre();
      }
    }
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
  async nacitatDalsieHotove(event: any) {
    if (this.vsetkyHotoveNacitane || !this.aktivnaInventura) {
      if (event) event.target.complete();
      return;
    }

    try {
      const od = this.pocetNacitanych;
      const do_poctu = this.pocetNacitanych + this.velkostStranky - 1;

      console.log(`📥 Sťahujem hotové od ${od} do ${do_poctu}`);

      const noveData = await this.supabaseService.getPolozkyVInventure(
        this.aktivnaInventura.id,
        od,
        do_poctu
      );

      // Pridáme nové dáta k existujúcim (neprepisujeme!)
      this.zasoby = [...this.zasoby, ...noveData.map(z => ({ ...z, v_inventure: true }))];

      this.pocetNacitanych += noveData.length;

      // Ak sme stiahli menej ako limit, znamená to, že sme na konci
      if (noveData.length < this.velkostStranky) {
        this.vsetkyHotoveNacitane = true;
      }

      this.aplikovatFiltre();

    } catch (e) {
      console.error(e);
    } finally {
      if (event) event.target.complete(); // Povieme scrolleru, že sme hotoví
    }
  }
  async obnovitZoznamPodlaRezimu() {
    this.isLoading = true;
    try {
      console.log('🚀 Sťahujem dáta... Režim:', this.rezimZobrazenia);


      if (this.rezimZobrazenia === 'v_inventure' && this.aktivnaInventura) {
        // Resetujeme stránkovanie
        this.pocetNacitanych = 0;
        this.vsetkyHotoveNacitane = false;
        this.zasoby = []; // Vyčistíme zoznam

        // Načítame prvú stranu (0 až 49)
        await this.nacitatDalsieHotove(null);
      }


      else {
        let hladatSkladId = null;
        let hladatRegalId = null;



        let textPreServer = this.searchQuery;

        if (this.rezimZobrazenia === 'regal') {
          if (!this.vybranyRegalId) {
            this.filtrovaneZasoby = [];
            this.isLoading = false;
            return;
          }
          hladatSkladId = this.vybranySkladId;
          hladatRegalId = this.vybranyRegalId;


          textPreServer = '';
        }


        const vysledky = await this.supabaseService.getZasobyFiltrovaneServer(
          hladatSkladId,
          hladatRegalId,
          this.filterKategoria,
          textPreServer,
          100
        );

        this.zasoby = vysledky;


        if (this.aktivnaInventura) {

          const rawInventura = await this.supabaseService.getRawInventuraData(this.aktivnaInventura.id);
          const mapa = new Map<string, number>();
          rawInventura.forEach(item => mapa.set(`${item.produkt_id}-${item.regal_id}`, item.mnozstvo));

          this.zasoby.forEach(z => {
            const regal = z.regal_id || this.vybranyRegalId;
            if (regal) {
              const kluc = `${z.produkt_id}-${regal}`;

              if (mapa.has(kluc)) {
                z.v_inventure = true;
                // Namiesto prepísania mnozstvo_ks si to uložíme bokom
                (z as any).spocitane_mnozstvo = mapa.get(kluc);
              } else {
                z.v_inventure = false;
                // Ak tovar v inventúre ešte nie je, spočítané je 0
                (z as any).spocitane_mnozstvo = 0;
              }
            }
          });
        }




        this.aplikovatFiltre();
      }

    } catch (e) {
      console.error('❌ Chyba:', e);
    } finally {
      this.isLoading = false;
    }
  }

  handleSearch(event: any) {
    this.searchQuery = event.target.value;


    if (this.rezimZobrazenia === 'v_inventure' || this.rezimZobrazenia === 'regal') {
      this.aplikovatFiltre();
    }

    else {
      this.obnovitZoznamPodlaRezimu();
    }
  }

  zmenitFilterKategorie(event: any) {
    this.filterKategoria = event.detail.value;
    this.obnovitZoznamPodlaRezimu();
  }




  aktualizovatFilter() {



    let temp = [...this.zasoby];

  }
  async zmenitRezim(event: any) {
    const novyRezim = event.detail.value;
    console.log('🔄 Mením režim na:', novyRezim);

    // 1. ULOŽENIE STAVU: Ak odchádzame z režimu "Regál", zapamätáme si, čo tam bolo
    if (this.rezimZobrazenia === 'regal') {
      this.ulozenyStavRegal = {
        skladId: this.vybranySkladId,
        regalId: this.vybranyRegalId,
        search: this.searchQuery,
        kategoria: this.filterKategoria // Tu si zapamätáme napr. "Spojovací materiál"
      };
    }

    // 2. PREPNUTIE REŽIMU
    this.rezimZobrazenia = novyRezim;

    // 3. LOGIKA PRE JEDNOTLIVÉ REŽIMY

    // A) REŽIM: HOTOVÉ (V INVENTÚRE) -> TOTO JE TO, ČO VÁM NEŠLO
    if (this.rezimZobrazenia === 'v_inventure') {
      this.jeGlobalnyPohlad = false;

      // Resetujeme Sklad a Regál
      this.vybranySkladId = null;
      this.vybranyRegalId = null;
      this.filtrovaneRegaly = [];

      // Resetujeme vyhľadávanie
      this.searchQuery = '';

      // 🔥 TVRDÝ RESET KATEGÓRIE 🔥
      // Nastavíme 'vsetky' a použijeme setTimeout, aby to Angular určite zaregistroval
      this.filterKategoria = 'vsetky';

      // Pre istotu vymažeme zoznam, kým sa nenačíta nový
      this.zasoby = [];
      this.filtrovaneZasoby = [];
    }

    // B) REŽIM: GLOBAL (Všetky)
    else if (this.rezimZobrazenia === 'global') {
      this.jeGlobalnyPohlad = true;
      this.vybranySkladId = null;
      this.vybranyRegalId = null;
      this.searchQuery = '';
      this.filterKategoria = 'vsetky';
      this.filtrovaneRegaly = [];
    }

    // C) REŽIM: REGÁL (Návrat späť)
    else if (this.rezimZobrazenia === 'regal') {
      this.jeGlobalnyPohlad = false;

      // Obnovíme hodnoty z pamäte
      this.vybranySkladId = this.ulozenyStavRegal.skladId;
      this.vybranyRegalId = this.ulozenyStavRegal.regalId;
      this.searchQuery = this.ulozenyStavRegal.search || '';

      // Tu vrátime naspäť tú starú kategóriu
      this.filterKategoria = this.ulozenyStavRegal.kategoria || 'vsetky';

      if (this.vybranySkladId) {
        this.filtrovaneRegaly = await this.supabaseService.getRegaly(this.vybranySkladId);
        this.regaly = this.filtrovaneRegaly;
      }
    }

    // 4. AKTUALIZÁCIA DÁT
    // Použijeme setTimeout, aby sme dali UI čas na resetovanie premenných
    setTimeout(async () => {

      // 1. KROK: Najprv musíme stiahnuť dáta (aby sme mali čo analyzovať)
      await this.obnovitZoznamPodlaRezimu();

      // 2. KROK: Až keď máme dáta, vypočítame, aké kategórie v nich sú
      await this.nacitajKategoriePreFilter();

    }, 50);
  }

  async priZmeneSkladu() {
    console.log('🏭 Zmena skladu na ID:', this.vybranySkladId);
    this.vybranyRegalId = null;

    this.isLoading = true;
    try {
      if (this.vybranySkladId) {
        this.filtrovaneRegaly = await this.supabaseService.getRegaly(this.vybranySkladId);
        this.regaly = this.filtrovaneRegaly;
      } else {
        this.filtrovaneRegaly = [];
      }
    } catch (error) {
      console.error(error);
    } finally {
      this.isLoading = false;
    }

    // 🔥 TOTO TU CHÝBALO:
    // Po zmene skladu musíme aktualizovať zoznam kategórií (aby sedeli na nový sklad)
    await this.nacitajKategoriePreFilter();

    if (this.rezimZobrazenia === 'v_inventure') {
      this.aplikovatFiltre();
    }
    else if (this.rezimZobrazenia === 'regal') {
      this.zasoby = [];
      this.filtrovaneZasoby = [];
    }
  }

  async priZmeneRegalu() {
    console.log('📍 Zmena regálu na ID:', this.vybranyRegalId);


    await this.nacitajKategoriePreFilter();

    if (this.rezimZobrazenia === 'v_inventure') {

      this.aplikovatFiltre();
    } else {

      await this.obnovitZoznamPodlaRezimu();
    }
  }

  async otvoritNovyProdukt() {

    const modal = await this.modalController.create({
      component: NovyProduktModalComponent
    });

    await modal.present();
    const { data, role } = await modal.onWillDismiss();


    if (role === 'confirm' && data) {
      this.zobrazToast(`Produkt "${data.nazov}" uložený.`, 'success');


      const smeNaSpravnomRegali = Number(data.regal_id) === Number(this.vybranyRegalId);

      if (smeNaSpravnomRegali || this.rezimZobrazenia === 'global') {



        this.searchQuery = data.nazov;
        this.filterKategoria = 'vsetky';


        await new Promise(resolve => setTimeout(resolve, 200));


        await this.obnovitZoznamPodlaRezimu();


        const noveId = data.id || data.produkt_id;
        if (noveId) {
          this.idPolozkyPreScroll = Number(noveId);
          setTimeout(() => this.skrolovatNaZapamatanuPolozku(), 300);
        }

      } else {

        console.log('Tovar pridaný na iný regál. Ostávam tu.');
      }
    }
  }





  // src/app/pages/inventory/inventory.component.ts

  async upravitProduktDetail(zasoba: SkladovaZasobaView) {
    console.log('🛠️ Otváram úpravu pre:', zasoba);
    this.idPolozkyPreScroll = zasoba.id;

    const modal = await this.modalController.create({
      component: NovyProduktModalComponent,
      componentProps: {
        produktNaUpravu: {
          // ... (kód ostáva rovnaký) ...
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
      this.isLoading = true;
      try {
        // 1. Aktualizácia údajov produktu (Názov, EAN, Balenie...)
        // Tieto zmeny sa prejavia všade, kde je produkt naskladnený
        const updateData = {
          nazov: data.nazov,
          vlastne_id: data.vlastne_id,
          jednotka: data.jednotka,
          balenie_ks: data.balenie_ks,
          kategoria_id: data.kategoria_id
        };

        // Vyčistenie undefined hodnôt
        Object.keys(updateData).forEach(key =>
          (updateData as any)[key] === undefined && delete (updateData as any)[key]
        );

        if (Object.keys(updateData).length > 0) {
          await this.supabaseService.updateProdukt(zasoba.produkt_id, updateData);
        }

        // 2. LOGIKA PRE UMIESTNENIE (TU JE ZMENA)
        const novyRegalId = Number(data.novyRegalId || data.regal_id);
        const staryRegalId = Number(zasoba.regal_id);

        // Ak sa zmenil regál (alebo sklad) a produkt už existuje
        if (zasoba.id > 0 && novyRegalId && novyRegalId !== staryRegalId) {

          // --- STARÝ KÓD (Presun) ---
          // await this.supabaseService.presunutZasobu(zasoba.id, novyRegalId);

          // --- NOVÝ KÓD (Pridanie nového umiestnenia) ---
          // Vytvoríme novú zásobu na novom regáli s 0 ks. Pôvodná ostane nedotknutá.
          await this.supabaseService.insertZasobu(zasoba.produkt_id, novyRegalId, 0);

          this.zobrazToast('Nové umiestnenie pridané. Pôvodné ostalo zachované.', 'success');

        } else if (zasoba.id === 0 && novyRegalId) {
          // Ak tovar ešte nikde nebol (bol len v katalógu), vytvoríme ho tam
          await this.supabaseService.insertZasobu(zasoba.produkt_id, novyRegalId, 0);
          this.zobrazToast('Produkt bol priradený na regál.', 'success');
        } else {
          // Regál sa nezmenil, len sme upravili názov/EAN
          this.zobrazToast('Údaje o produkte aktualizované.', 'success');
        }

        await this.obnovitZoznamPodlaRezimu();
        this.skrolovatNaZapamatanuPolozku();

      } catch (error: any) {
        console.error('❌ Chyba:', error);
        // Ošetrenie duplicity (ak už na tom novom regáli tovar je)
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





    if (
      (this.rezimZobrazenia === 'regal' && this.vybranyRegalId) ||
      (this.rezimZobrazenia === 'v_inventure')
    ) {


      await this.spustitKalkulacku(zasoba);
    }
    else {


      await this.vybratSkladPreZapis(zasoba);
    }
  }



  async vybratSkladPreZapis(zasoba: SkladovaZasobaView) {
    this.isLoading = true;
    const sklady = await this.supabaseService.getSklady();
    this.isLoading = false;

    const alert = await this.alertController.create({
      header: 'Kde chcete produkt spočítať?',
      subHeader: 'Najprv vyberte Sklad',
      inputs: sklady.map(s => ({
        type: 'radio',
        label: s.nazov,
        value: s.id
      })),
      buttons: [
        { text: 'Zrušiť', role: 'cancel' },
        {
          text: 'Ďalej',
          handler: async (skladId) => {
            if (!skladId) {

              return false;
            }


            this.isLoading = true;
            const existujuca = await this.supabaseService.getZasobaVSklade(zasoba.produkt_id, skladId);
            this.isLoading = false;

            if (existujuca) {

              const nazovRegalu = (existujuca.regaly as any)?.nazov || 'Neznámy regál';

              const errorAlert = await this.alertController.create({
                header: 'Duplicita v sklade!',
                subHeader: 'Tento produkt sa v tomto sklade už nachádza.',
                message: `Našli sme ho na pozícii: "${nazovRegalu}" (Množstvo: ${existujuca.mnozstvo_ks} ks).\n\nNemôžete vytvoriť ďalšie umiestnenie v tom istom sklade.`,
                cssClass: 'custom-alert',
                buttons: ['Rozumiem']
              });
              await errorAlert.present();

              return true;
            }


            else {
              this.vybratRegalPreZapis(zasoba, skladId);
              return true;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async vybratRegalPreZapis(zasoba: SkladovaZasobaView, skladId: number) {
    this.isLoading = true;
    const regaly = await this.supabaseService.getRegaly(skladId);
    this.isLoading = false;

    if (regaly.length === 0) {
      this.zobrazToast('Tento sklad nemá žiadne regály.', 'warning');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Vyberte Regál',
      inputs: regaly.map(r => ({
        type: 'radio',
        label: r.nazov,
        value: r.id
      })),
      buttons: [
        { text: 'Späť', handler: () => this.vybratSkladPreZapis(zasoba) },
        {
          text: 'Vybrať',
          handler: (regalId) => {
            if (regalId) {

              const novaZasoba = {
                ...zasoba,
                id: 0,
                regal_id: regalId,
                mnozstvo_ks: 0
              };
              this.spustitKalkulacku(novaZasoba);
            }
          }
        }
      ]
    });
    await alert.present();
  }


  async spustitKalkulacku(zasoba: SkladovaZasobaView) {
    this.idPolozkyPreScroll = zasoba.id || zasoba.produkt_id;

    const modal = await this.modalController.create({
      component: CalculatorModalComponent,
      cssClass: 'my-custom-modal',
      componentProps: {
        nazovProduktu: zasoba.nazov,
        // aktualnyStav: zasoba.mnozstvo_ks,
        aktualnyStav: this.aktivnaInventura
          ? ((zasoba as any).spocitane_mnozstvo ?? 0)
          : zasoba.mnozstvo_ks,
        balenie: zasoba.balenie_ks
      }
    });

    await modal.present();
    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm') {
      const novyStav = data.novyStav;


      await this.ulozitZmenu(zasoba, novyStav);

      this.cdr.detectChanges();


      if (this.rezimZobrazenia === 'global') {

      }
    } else {
      this.idPolozkyPreScroll = null;
    }
  }
  async ulozitZmenu(zasoba: SkladovaZasobaView, novyStavInput: string | number) {
    // 1. Prevedieme vstup na číslo
    let suroveCislo = Number(novyStavInput);

    // 2. Ošetrenie: Ak to nie je číslo, skončíme
    if (isNaN(suroveCislo)) {
      this.zobrazToast('Zadaná hodnota nie je číslo', 'warning');
      return;
    }

    // 3. 🔥 ZAOKRÚHLENIE NA 2 DESATINNÉ MIESTA 🔥
    // (Math.round(X * 100) / 100) je štandardný trik pre peniaze a váhu
    const novyStav = Math.round((suroveCislo + Number.EPSILON) * 100) / 100;


    let cielovyRegalId = zasoba.regal_id || this.vybranyRegalId;
    const cielovyProduktId = zasoba.produkt_id;

    if (!cielovyRegalId) {
      this.zobrazToast('Chyba: Nie je vybraný regál pre zápis.', 'danger');
      return;
    }

    console.log(`💾 Ukladám... ID: ${zasoba.id}, Regál: ${cielovyRegalId}, Množstvo: ${novyStav}`);

    try {



      if (zasoba.id === 0) {
        await this.supabaseService.insertZasobu(zasoba.produkt_id, cielovyRegalId, novyStav);
        this.zobrazToast(`Vytvorené: ${novyStav} ks`, 'success');
        if (this.aktivnaInventura) {
          await this.supabaseService.zapisatDoInventury(this.aktivnaInventura.id, zasoba.produkt_id, cielovyRegalId, novyStav);
        }
      } else {
        if (this.aktivnaInventura) {
          if (novyStav > 0) {
            await this.supabaseService.zapisatDoInventury(this.aktivnaInventura.id, zasoba.produkt_id, cielovyRegalId, novyStav);
            this.zobrazToast(`Zapísané: ${novyStav} ks`, 'primary');
          } else {
            await this.supabaseService.zmazatZaznamZInventury(this.aktivnaInventura.id, zasoba.produkt_id, cielovyRegalId);
            this.zobrazToast('Vymazané', 'medium');
          }
        } else {
          await this.supabaseService.updateZasobu(zasoba.id, zasoba.produkt_id, novyStav, zasoba.mnozstvo_ks);
          this.zobrazToast(`Aktualizované: ${novyStav} ks`, 'success');
        }
      }




      await this.obnovitZoznamPodlaRezimu();




      const najdenaPolozka = this.filtrovaneZasoby.find(z =>
        z.produkt_id === cielovyProduktId &&
        z.regal_id === cielovyRegalId
      );

      if (najdenaPolozka) {
        console.log('📍 Položka nájdená v zozname, Nové ID:', najdenaPolozka.id);


        this.idPolozkyPreScroll = najdenaPolozka.id;


        this.cdr.detectChanges();


        setTimeout(() => {
          this.skrolovatNaZapamatanuPolozku();
        }, 150);

      } else {
        console.warn('⚠️ Položka sa v novom zozname nenašla (filtre?).');
      }

    } catch (error: any) {
      console.error('❌ Chyba pri zápise:', error);
      alert('CHYBA: ' + error.message);
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

    this.cdr.detectChanges();
  }

  async zmazatPolozku(zasoba: SkladovaZasobaView, event: Event) {
    event.stopPropagation();
    if (this.rezimZobrazenia !== 'v_inventure' && zasoba.id === 0 && !zasoba.v_inventure) {
      this.zobrazToast('Túto položku nie je možné zmazať (nie je na sklade).', 'warning');
      return;
    }
    let nadpis = 'Potvrdenie';
    let textSpravy = 'Naozaj chcete vykonať túto akciu?';
    let tlacidloText = 'OK';
    let cssClass = '';
    const nazovProduktu = zasoba.nazov || 'túto položku';

    if (this.rezimZobrazenia === 'v_inventure') {
      nadpis = 'Zrušiť inventúrny zápis?';
      textSpravy = `Naozaj chcete odstrániť "${nazovProduktu}" zo zoznamu spočítaných položiek?\n\n(Tovar ostane v databáze, len sa vymaže z tejto inventúry)`;
      tlacidloText = 'Zrušiť zápis';
      cssClass = 'alert-button-cancel';
    } else {
      nadpis = 'Odstrániť tovar?';
      textSpravy = `Naozaj chcete kompletne odstrániť "${nazovProduktu}" z tohto umiestnenia?\n\n(Vymaže sa zo skladu aj z inventúry)`;
      tlacidloText = 'Odstrániť';
      cssClass = 'alert-button-delete';
    }

    const alert = await this.alertController.create({
      header: nadpis,
      message: textSpravy,
      cssClass: 'custom-alert',
      buttons: [
        { text: 'Zrušiť', role: 'cancel', cssClass: 'secondary' },
        {
          text: tlacidloText,
          role: 'destructive',
          cssClass: cssClass,
          handler: async () => {
            await this.vykonatVymazanie(zasoba);
          }
        }
      ]
    });
    await alert.present();
  }

  async vykonatVymazanie(zasoba: SkladovaZasobaView) {
    this.isLoading = true;
    try {
      const regalId = zasoba.regal_id || this.vybranyRegalId;
      if (this.rezimZobrazenia === 'v_inventure') {
        if (this.aktivnaInventura && regalId) {
          await this.supabaseService.zmazatZaznamZInventury(
            this.aktivnaInventura.id,
            zasoba.produkt_id,
            regalId
          );
          this.zobrazToast('Zápis bol zrušený.', 'success');
        }
      } else {
        if (this.aktivnaInventura && regalId) {
          try {
            await this.supabaseService.zmazatZaznamZInventury(
              this.aktivnaInventura.id,
              zasoba.produkt_id,
              regalId
            );
          } catch (e) { }
        }
        if (zasoba.id > 0) {
          await this.supabaseService.zmazatZasobuZoSkladu(zasoba.id);
          this.zobrazToast('Položka kompletne odstránená.', 'success');
        }
      }
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
    this.filtrovaneRegaly = [];
    await this.obnovitZoznamPodlaRezimu();
  }

  odstranitDiakritiku(text: string): string {
    if (!text) return '';
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
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
      this.sklady = await this.supabaseService.getSklady();
      if (this.vybranySkladId) {
        await this.priZmeneSkladu();
      }
      this.zobrazToast('Lokácia bola úspešne pridaná', 'success');
    }
  }

  async skrolovatNaZapamatanuPolozku() {
    if (!this.idPolozkyPreScroll) return;
    setTimeout(() => {
      const targetId = 'polozka-' + this.idPolozkyPreScroll;
      const element = document.getElementById(targetId);
      if (element) {
        console.log('✅ Scrollujem na:', targetId);
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        element.classList.add('highlight-anim');
        setTimeout(() => element.classList.remove('highlight-anim'), 2000);
        this.idPolozkyPreScroll = null;
      } else {
        console.log('❌ Element sa nenašiel (možno ešte nie je v DOMe)');
      }
    }, 300);
  }

  trackByZasoby(index: number, item: SkladovaZasobaView): number {
    return item.id;
  }
  aplikovatFiltre() {
    console.log('🔍 Aplikujem lokálne filtre...');


    let data = [...this.zasoby];


    if (this.searchQuery) {
      const q = this.odstranitDiakritiku(this.searchQuery);
      data = data.filter(z => {
        const nazov = this.odstranitDiakritiku(z.nazov || '');
        const ean = (z.ean || '').toLowerCase();
        return nazov.includes(q) || ean.includes(q);
      });
    }


    if (this.filterKategoria && this.filterKategoria !== 'vsetky') {
      data = data.filter(z => z.kategoria === this.filterKategoria);
    }


    if (this.rezimZobrazenia === 'v_inventure') {
      if (this.vybranySkladId) data = data.filter(z => z.sklad_id === this.vybranySkladId);
      if (this.vybranyRegalId) data = data.filter(z => z.regal_id === this.vybranyRegalId);
    }


    this.filtrovaneZasoby = data;
  }

  onDragStart(event: TouchEvent) {
    // Uložíme počiatočnú pozíciu dotyku
    this.lastX = event.touches[0].clientX;
    this.lastY = event.touches[0].clientY;
    this.isDragging = true;

    // Pridáme triedu pre vizuálny efekt (v SCSS)
    this.renderer.addClass(this.fabElement.nativeElement, 'is-dragging');
  }

  onDragMove(event: TouchEvent) {
    if (!this.isDragging) return;

    // Zabránime scrollovaniu stránky, kým ťaháme tlačidlo
    event.preventDefault();

    // Získame aktuálnu pozíciu dotyku
    const clientX = event.touches[0].clientX;
    const clientY = event.touches[0].clientY;

    // Vypočítame o koľko sa prst pohol (delta)
    const deltaX = clientX - this.lastX;
    const deltaY = clientY - this.lastY;

    // Pripočítame to k aktuálnej pozícii elementu
    this.currentX += deltaX;
    this.currentY += deltaY;

    // Aktualizujeme "last" pozíciu pre ďalší cyklus
    this.lastX = clientX;
    this.lastY = clientY;

    // Aplikujeme pohyb cez CSS transform
    this.renderer.setStyle(
      this.fabElement.nativeElement,
      'transform',
      `translate3d(${this.currentX}px, ${this.currentY}px, 0)`
    );
  }

  onDragEnd() {
    this.isDragging = false;
    this.renderer.removeClass(this.fabElement.nativeElement, 'is-dragging');

    // (Voliteľné) Tu by sa dala uložiť pozícia do localStorage, 
    // aby si tlačidlo pamätalo miesto aj po reštarte aplikácie.
  }

}