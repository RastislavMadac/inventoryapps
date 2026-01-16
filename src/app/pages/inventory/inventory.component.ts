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

              z.v_inventure = true;
              z.mnozstvo_ks = mapa.get(kluc) || 0;
            } else {

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


    console.log('Filtrujem...', temp.length, 'položiek. Režim:', this.rezimZobrazenia);




    if (this.vybranyRegalId) {
      temp = temp.filter(z => z.regal_id == this.vybranyRegalId);
    }




    else if (this.vybranySkladId) {



      const idckaRegalovVSklade = this.filtrovaneRegaly.map(r => r.id);

      temp = temp.filter(z => {


        if (this.rezimZobrazenia === 'global' && z.id === 0 && !z.regal_id) {
          return true;
        }



        if (z.regal_id) {

          return idckaRegalovVSklade.some(id => id == z.regal_id);
        }


        if ((z as any).sklad_id) {
          return (z as any).sklad_id == this.vybranySkladId;
        }

        return false;
      });
    }




    if (this.filterKategoria && this.filterKategoria !== 'vsetky') {
      temp = temp.filter(z => (z.kategoria || 'Bez kategórie') === this.filterKategoria);
    }




    if (this.searchQuery) {

      const q = this.odstranitDiakritiku(this.searchQuery);

      temp = temp.filter(z => {

        const nazovBezDiakritiky = this.odstranitDiakritiku(z.nazov || '');


        const ean = (z.ean || '').toLowerCase();

        return nazovBezDiakritiky.includes(q) || ean.includes(q);
      });
    }

    this.filtrovaneZasoby = temp;

  }

  get unikatneKategorie(): string[] {
    const kategorie = this.zasoby.map(z => z.kategoria || 'Bez kategórie');
    return [...new Set(kategorie)].sort();
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
      this.searchQuery = this.ulozenyStavRegal.search || '';
      this.filterKategoria = this.ulozenyStavRegal.kategoria || 'vsetky';



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


    else if (this.rezimZobrazenia === 'global') {
      this.jeGlobalnyPohlad = true;


      this.vybranySkladId = null;
      this.vybranyRegalId = null;

      this.searchQuery = '';
      this.filterKategoria = 'vsetky';
    }


    else {
      this.jeGlobalnyPohlad = false;

      this.vybranySkladId = null;
      this.vybranyRegalId = null;
      this.searchQuery = '';
    }


    await this.obnovitZoznamPodlaRezimu();
  }
  async priZmeneSkladu() {
    console.log('🏭 Zmena skladu na ID:', this.vybranySkladId);


    this.vybranyRegalId = null;
    this.filterKategoria = 'vsetky';


    if (this.rezimZobrazenia === 'regal') {
      this.zasoby = [];
      this.filtrovaneZasoby = [];
    }


    this.isLoading = true;
    try {
      if (this.vybranySkladId) {

        const regalyZoServera = await this.supabaseService.getRegaly(this.vybranySkladId);
        this.filtrovaneRegaly = regalyZoServera;
        this.regaly = regalyZoServera;


        if (this.filtrovaneRegaly.length > 0) {

          this.vybranyRegalId = this.filtrovaneRegaly[0].id;
          console.log('✅ Automaticky vybraný regál:', this.vybranyRegalId);



          await this.obnovitZoznamPodlaRezimu();
        } else {

          this.isLoading = false;
        }

      } else {

        this.filtrovaneRegaly = [];
        this.isLoading = false;
      }
    } catch (error) {
      console.error('Chyba pri zmene skladu:', error);
      this.zobrazToast('Nepodarilo sa načítať regály.', 'danger');
      this.isLoading = false;
    }



  }
  async priZmeneRegalu() {
    console.log('Zmena regálu na ID:', this.vybranyRegalId);


    this.filterKategoria = 'vsetky';


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
      console.log('📦 RODIČ PRIJAL DÁTA:', data);



      const suroveId = data.id || data.produkt_id;
      const noveId = suroveId ? Number(suroveId) : null;

      if (noveId) {
        console.log('✅ Mám ID nového produktu:', noveId);


        this.idPolozkyPreScroll = noveId;


        await this.obnovitZoznamPodlaRezimu();


        this.cdr.detectChanges();


        this.skrolovatNaZapamatanuPolozku();
      } else {
        console.error('❌ CHYBA: V dátach z modalu chýba ID!', data);
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
          console.log(`🚚 Presúvam zásobu ${zasoba.id} na regál ${novyRegalId}`);
          await this.supabaseService.presunutZasobu(zasoba.id, novyRegalId);
          this.zobrazToast('Produkt aktualizovaný a PRESUNUTÝ.', 'success');
        }


        else if (zasoba.id === 0 && novyRegalId) {
          console.log(`✨ Vytváram novú zásobu pre produkt ${zasoba.produkt_id} na regáli ${novyRegalId}`);


          await this.supabaseService.insertZasobu(zasoba.produkt_id, novyRegalId, 0);
          this.zobrazToast('Produkt bol priradený na regál.', 'success');
        }

        else {
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
    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm') {
      const novyStav = data.novyStav;


      await this.ulozitZmenu(zasoba, novyStav);


      this.cdr.detectChanges();


      setTimeout(() => {
        this.skrolovatNaZapamatanuPolozku();
      }, 50);

    } else {
      this.idPolozkyPreScroll = null;
    }
  }

  async ulozitZmenu(zasoba: SkladovaZasobaView, novyStavInput: string | number) {
    const novyStav = Number(novyStavInput);
    if (isNaN(novyStav)) return;

    let cielovyRegalId = zasoba.regal_id;

    if (!cielovyRegalId) {
      cielovyRegalId = this.vybranyRegalId || undefined;
    }

    if (!cielovyRegalId) {

      return;
    }







    try {
      if (this.aktivnaInventura) {

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


      this.cdr.detectChanges();

    } catch (error: any) {
      console.error('Chyba:', error);
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
    this.aktualizovatFilter();
    this.cdr.detectChanges();
  }
  async zmazatPolozku(zasoba: SkladovaZasobaView, event: Event) {
    event.stopPropagation();


    console.log('🗑️ Mazem polozku:', zasoba);
    console.log('👀 Rezim:', this.rezimZobrazenia);


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


    console.log('📝 Text správy:', textSpravy);


    const alert = await this.alertController.create({
      header: nadpis,
      message: textSpravy,
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
      }




      else {

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
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
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


        element.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });


        element.classList.add('highlight-anim');
        setTimeout(() => element.classList.remove('highlight-anim'), 2000);

        this.idPolozkyPreScroll = null;
      } else {
        console.log('❌ Element sa nenašiel (možno ešte nie je v DOMe)');
      }

    }, 300);
  }


  private spustitHladanieElementu(targetId: string) {
    let pokusy = 0;

    const interval = setInterval(async () => {
      const element = document.getElementById(targetId);

      if (element) {
        clearInterval(interval);
        console.log('✅ Element NAJDENÝ! Scrollujem.');

        try {

          const offset = element.offsetTop;




          const vyskaHlavicky = 220;
          const finalY = Math.max(0, offset - vyskaHlavicky);


          if (this.content) {
            await this.content.scrollToPoint(0, finalY, 600);
          }


          element.classList.add('highlight-anim');
          setTimeout(() => element.classList.remove('highlight-anim'), 2000);


          this.idPolozkyPreScroll = null;

        } catch (e) {
          console.error('Scroll error:', e);
        }

      } else {
        pokusy++;

        if (pokusy > 20) {
          clearInterval(interval);
          console.warn('❌ Element sa nenašiel v HTML:', targetId);
          this.idPolozkyPreScroll = null;
        }
      }
    }, 100);
  }


  trackByZasoby(index: number, item: SkladovaZasobaView): number {
    return item.id;
  }
}