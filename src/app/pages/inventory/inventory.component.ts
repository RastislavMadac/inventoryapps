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
  , IonCardContent, IonButton,
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
    IonButton, IonSearchbar
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
    private modalCtrl: ModalController
  ) {
    addIcons({ clipboardOutline, closeCircle, addCircleOutline, caretDownOutline, searchOutline, filterOutline, arrowUpOutline, createOutline, trashOutline, checkmarkDoneOutline, locationOutline, add, addOutline, cubeOutline, listOutline, checkmarkCircle, timeOutline });
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
    let idPreServer = null;




    if (this.rezimZobrazenia === 'regal' && this.vybranyRegalId) {
      idPreServer = this.vybranyRegalId;
    }

    console.log('🔄 Aktualizujem kategórie. Režim:', this.rezimZobrazenia, 'ID regálu:', idPreServer);

    this.zoznamKategorii = await this.supabaseService.getKategoriePreFilter(idPreServer);


    if (this.filterKategoria !== 'vsetky' && !this.zoznamKategorii.includes(this.filterKategoria)) {
      this.filterKategoria = 'vsetky';
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

  async obnovitZoznamPodlaRezimu() {
    this.isLoading = true;
    try {
      console.log('🚀 Sťahujem dáta... Režim:', this.rezimZobrazenia);


      if (this.rezimZobrazenia === 'v_inventure' && this.aktivnaInventura) {
        const hotove = await this.supabaseService.getPolozkyVInventure(this.aktivnaInventura.id);
        this.zasoby = hotove.map(z => ({ ...z, v_inventure: true }));


        if (this.searchQuery) {
          const q = this.odstranitDiakritiku(this.searchQuery);
          this.filtrovaneZasoby = this.zasoby.filter(z => {
            const nazov = this.odstranitDiakritiku(z.nazov || '');
            const ean = (z.ean || '').toLowerCase();
            return nazov.includes(q) || ean.includes(q);
          });
        } else {
          this.filtrovaneZasoby = this.zasoby;
        }
      }


      else {
        let hladatSkladId = null;
        let hladatRegalId = null;


        if (this.rezimZobrazenia === 'regal') {
          if (!this.vybranyRegalId) {
            this.filtrovaneZasoby = [];
            this.isLoading = false;
            return;
          }
          hladatSkladId = this.vybranySkladId;
          hladatRegalId = this.vybranyRegalId;
        }


        const vysledky = await this.supabaseService.getZasobyFiltrovaneServer(
          hladatSkladId,
          hladatRegalId,
          this.filterKategoria,
          this.searchQuery,
          100
        );

        this.filtrovaneZasoby = vysledky;


        if (this.aktivnaInventura) {
          const rawInventura = await this.supabaseService.getRawInventuraData(this.aktivnaInventura.id);
          const mapa = new Map<string, number>();
          rawInventura.forEach(item => mapa.set(`${item.produkt_id}-${item.regal_id}`, item.mnozstvo));

          this.filtrovaneZasoby.forEach(z => {
            const regal = z.regal_id || this.vybranyRegalId;
            if (regal) {
              const kluc = `${z.produkt_id}-${regal}`;

              if (mapa.has(kluc)) {

                z.v_inventure = true;
                z.mnozstvo_ks = mapa.get(kluc) || 0;
              } else {

                z.v_inventure = false;
                z.mnozstvo_ks = 0;
              }
            }
          });
        }
      }
    } catch (e) {
      console.error('❌ Chyba:', e);
    } finally {
      this.isLoading = false;
    }
  }

  handleSearch(event: any) {
    this.searchQuery = event.target.value;
    this.obnovitZoznamPodlaRezimu();
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
      this.searchQuery = this.ulozenyStavRegal.search || '';
      this.filterKategoria = this.ulozenyStavRegal.kategoria || 'vsetky';


      if (this.vybranySkladId && this.filtrovaneRegaly.length === 0) {
        this.filtrovaneRegaly = await this.supabaseService.getRegaly(this.vybranySkladId);
      }
    }
    else if (this.rezimZobrazenia === 'global') {
      this.jeGlobalnyPohlad = true;
      this.vybranySkladId = null;
      this.vybranyRegalId = null;
      this.searchQuery = '';
      this.filterKategoria = 'vsetky';
    }
    else {

      this.jeGlobalnyPohlad = false;
    }


    await this.nacitajKategoriePreFilter();


    await this.obnovitZoznamPodlaRezimu();
  }

  async priZmeneSkladu() {
    console.log('🏭 Zmena skladu na ID:', this.vybranySkladId);
    this.vybranyRegalId = null; // Reset regálu

    this.isLoading = true;
    try {
      if (this.vybranySkladId) {
        // Načítame regály pre dropdown menu
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

    // 🔥 Ak sme v Hotových, len prefiltrujeme zoznam
    if (this.rezimZobrazenia === 'v_inventure') {
      this.aplikovatFiltre();
    }
    // Ak sme v Regál režime, vymažeme zoznam (lebo čakáme na výber regálu)
    else if (this.rezimZobrazenia === 'regal') {
      this.zasoby = [];
      this.filtrovaneZasoby = [];
    }
  }

  async priZmeneRegalu() {
    console.log('📍 Zmena regálu na ID:', this.vybranyRegalId);

    // Načítame kategórie pre tento regál (aby dropdown kategórií dával zmysel)
    await this.nacitajKategoriePreFilter();

    if (this.rezimZobrazenia === 'v_inventure') {
      // V Hotových len filtrujeme
      this.aplikovatFiltre();
    } else {
      // V Regál režime sťahujeme dáta
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





  async upravitProduktDetail(zasoba: SkladovaZasobaView) {

    console.log('🛠️ Otváram úpravu pre:', zasoba);
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

        const novyRegalId = Number(data.novyRegalId || data.regal_id);
        const staryRegalId = Number(zasoba.regal_id);

        if (zasoba.id > 0 && novyRegalId && novyRegalId !== staryRegalId) {
          await this.supabaseService.presunutZasobu(zasoba.id, novyRegalId);
          this.zobrazToast('Produkt aktualizovaný a PRESUNUTÝ.', 'success');
        } else if (zasoba.id === 0 && novyRegalId) {
          await this.supabaseService.insertZasobu(zasoba.produkt_id, novyRegalId, 0);
          this.zobrazToast('Produkt bol priradený na regál.', 'success');
        } else {
          this.zobrazToast('Produkt aktualizovaný.', 'success');
        }

        await this.obnovitZoznamPodlaRezimu();
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

    // LOGIKA ROZHODOVANIA:
    // 1. Ak sme v režime "Regál" a máme vybraný regál -> Vieme kde sme.
    // 2. Ak sme v režime "Hotové" (v_inventure) -> Tovar už má svoje miesto v inventúre.

    if (
      (this.rezimZobrazenia === 'regal' && this.vybranyRegalId) ||
      (this.rezimZobrazenia === 'v_inventure')
    ) {
      // ✅ Vieme presne, kde tovar je -> Otvárame priamo kalkulačku
      // (V režime 'v_inventure' má objekt zasoba.regal_id už vyplnené z databázy)
      await this.spustitKalkulacku(zasoba);
    }
    else {
      // 🛑 Sme v režime "Všetky" (Global).
      // Tu sa VŽDY pýtame na umiestnenie, aby ste potvrdili, kam tovar patrí.
      await this.vybratSkladPreZapis(zasoba);
    }
  }

  // V súbore: inventory.component.ts

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
              // Ak nevybral nič, okno sa len zatvorí (alebo ostane otvorené, ak dáme return false)
              return false;
            }

            // 🔥 KONTROLA SKLADU 🔥
            this.isLoading = true;
            const existujuca = await this.supabaseService.getZasobaVSklade(zasoba.produkt_id, skladId);
            this.isLoading = false;

            if (existujuca) {
              // 🛑 STOP! Produkt v tomto sklade už je.
              const nazovRegalu = (existujuca.regaly as any)?.nazov || 'Neznámy regál';

              const errorAlert = await this.alertController.create({
                header: 'Duplicita v sklade!',
                subHeader: 'Tento produkt sa v tomto sklade už nachádza.',
                message: `Našli sme ho na pozícii: "${nazovRegalu}" (Množstvo: ${existujuca.mnozstvo_ks} ks).\n\nNemôžete vytvoriť ďalšie umiestnenie v tom istom sklade.`,
                cssClass: 'custom-alert',
                buttons: ['Rozumiem']
              });
              await errorAlert.present();

              return true; // ✅ Zatvoríme okno výberu skladu, lebo nastala chyba
            }

            // ✅ Všetko OK, v tomto sklade ešte nie je
            else {
              this.vybratRegalPreZapis(zasoba, skladId);
              return true; // ✅ TOTO TU CHÝBALO: Zatvoríme okno skladu, lebo otvárame okno regálu
            }
          }
        }
      ]
    });
    await alert.present();
  }
  // Zjednodušená verzia, keďže kontrolu už robíme na úrovni skladu
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
              // Sklad je skontrolovaný, Regál vybraný -> Otvárame kalkulačku pre NOVÝ zápis
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

  // --- C) Spustenie Kalkulačky (túto funkciu už asi máte, len pre istotu) ---
  async spustitKalkulacku(zasoba: SkladovaZasobaView) {
    this.idPolozkyPreScroll = zasoba.id || zasoba.produkt_id;

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
    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm') {
      const novyStav = data.novyStav;

      // Tu už máme správne ID (buď existujúce alebo 0) a správny regal_id
      await this.ulozitZmenu(zasoba, novyStav);

      this.cdr.detectChanges();

      // Ak sme v Global režime, obnovíme zoznam, inak len scrollujeme
      if (this.rezimZobrazenia === 'global') {
        // Voliteľné: obnova zoznamu
      }
    } else {
      this.idPolozkyPreScroll = null;
    }
  }
  async ulozitZmenu(zasoba: SkladovaZasobaView, novyStavInput: string | number) {
    const novyStav = Number(novyStavInput);
    if (isNaN(novyStav)) {
      this.zobrazToast('Zadaná hodnota nie je číslo', 'warning');
      return;
    }

    // 1. Zistíme cieľový regál
    let cielovyRegalId = zasoba.regal_id || this.vybranyRegalId;

    if (!cielovyRegalId) {
      console.error('❌ CHYBA: Nemám cieľový regál!', zasoba);
      this.zobrazToast('Chyba: Nie je vybraný regál pre zápis.', 'danger');
      return;
    }

    console.log(`💾 Ukladám... ID: ${zasoba.id}, Regál: ${cielovyRegalId}, Množstvo: ${novyStav}`);

    try {
      // --- (TOTO OSTÁVA ROVNAKÉ - LOGIKA ZÁPISU) ---

      // 1. Nový tovar (ID 0) -> INSERT do skladu
      if (zasoba.id === 0) {
        await this.supabaseService.insertZasobu(zasoba.produkt_id, cielovyRegalId, novyStav);
        this.zobrazToast(`Vytvorené nové umiestnenie: ${novyStav} ks`, 'success');

        if (this.aktivnaInventura) {
          await this.supabaseService.zapisatDoInventury(this.aktivnaInventura.id, zasoba.produkt_id, cielovyRegalId, novyStav);
          zasoba.v_inventure = true;
        }
      }
      // 2. Existujúci tovar -> UPDATE alebo Inventúra
      else {
        if (this.aktivnaInventura) {
          if (novyStav > 0) {
            await this.supabaseService.zapisatDoInventury(this.aktivnaInventura.id, zasoba.produkt_id, cielovyRegalId, novyStav);
            zasoba.v_inventure = true;
            this.zobrazToast(`Zapísané do inventúry: ${novyStav} ks`, 'primary');
          } else {
            await this.supabaseService.zmazatZaznamZInventury(this.aktivnaInventura.id, zasoba.produkt_id, cielovyRegalId);
            zasoba.v_inventure = false;
            this.zobrazToast('Vymazané z inventúry', 'medium');
          }
        } else {
          await this.supabaseService.updateZasobu(zasoba.id, zasoba.produkt_id, novyStav, zasoba.mnozstvo_ks);
          this.zobrazToast(`Aktualizované: ${novyStav} ks`, 'success');
        }
      }

      // Lokálna aktualizácia
      zasoba.mnozstvo_ks = novyStav;
      if (!zasoba.regal_id) zasoba.regal_id = cielovyRegalId;

      this.cdr.detectChanges();

      // --- 🔥 TU JE OPRAVA SCROLLOVANIA 🔥 ---

      // Ak sme v Global režime, musíme stiahnuť nový zoznam, lebo sa mohli zmeniť IDčka
      if (this.rezimZobrazenia === 'global') {
        console.log('🔄 Sťahujem nový zoznam...');
        await this.obnovitZoznamPodlaRezimu();

        // TERAZ musíme nájsť tú položku v novom zozname, aby sme zistili jej NOVÉ ID
        const najdenaPolozka = this.filtrovaneZasoby.find(z =>
          z.produkt_id === zasoba.produkt_id &&
          z.regal_id === cielovyRegalId
        );

        if (najdenaPolozka) {
          console.log('📍 Položka nájdená v novom zozname, ID:', najdenaPolozka.id);
          // Nastavíme ID pre scroll na to NOVÉ ID z databázy
          this.idPolozkyPreScroll = najdenaPolozka.id;

          // Spustíme scroll
          setTimeout(() => this.skrolovatNaZapamatanuPolozku(), 100);
        } else {
          console.warn('⚠️ Položka sa v novom zozname nenašla.');
        }
      } else {
        // V režime Regál sa ID nemení tak často, ale pre istotu skrolujeme tiež
        this.skrolovatNaZapamatanuPolozku();
      }

    } catch (error: any) {
      console.error('❌ Chyba pri zápise:', error);
      alert('CHYBA ZÁPISU: ' + (error.message || JSON.stringify(error)));
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

  // V súbore: inventory.component.ts

  aplikovatFiltre() {
    // 1. Kópia dát
    let data = [...this.zasoby];

    // 2. Filter: Text (Hľadanie bez diakritiky)
    if (this.searchQuery) {
      // Odstránime diakritiku z hľadaného výrazu a dáme na malé písmená
      const q = this.odstranitDiakritiku(this.searchQuery);

      data = data.filter(z => {
        // To isté urobíme s názvom produktu
        const nazov = this.odstranitDiakritiku(z.nazov || '');
        const ean = (z.ean || '').toLowerCase();

        // Porovnávame "čisté" texty
        return nazov.includes(q) || ean.includes(q);
      });
    }

    // 3. Filter: Kategória
    if (this.filterKategoria && this.filterKategoria !== 'vsetky') {
      data = data.filter(z => z.kategoria === this.filterKategoria);
    }

    // 4. Filter pre "Hotové" (Sklad a Regál)
    if (this.rezimZobrazenia === 'v_inventure') {
      if (this.vybranySkladId) {
        data = data.filter(z => z.sklad_id === this.vybranySkladId);
      }
      if (this.vybranyRegalId) {
        data = data.filter(z => z.regal_id === this.vybranyRegalId);
      }
    }

    this.filtrovaneZasoby = data;
  }


}