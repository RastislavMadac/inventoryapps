import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ModalController,
  ToastController,
  AlertController
} from '@ionic/angular';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton,
  IonSegment, IonSegmentButton, IonLabel, IonIcon, IonChip,
  IonItem, IonSelect, IonSelectOption, IonSearchbar, IonSpinner,
  IonList, IonCard, IonFab, IonFabButton
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  add, removeOutline, addOutline, saveOutline,
  searchOutline, listOutline, fileTrayOutline,
  arrowUpOutline, globeOutline, filterOutline,
  fileTrayStackedOutline, locationOutline,
  caretDownOutline, clipboardOutline, cubeOutline, checkmarkCircle,
  checkmarkDoneOutline,
  timeOutline
} from 'ionicons/icons';
import { SupabaseService, Sklad, Regal, SkladovaZasobaView, Inventura } from 'src/app/services/supabase.service';
import { CalculatorModalComponent } from 'src/app/components/calculator-modal/calculator-modal.component';
import { NovyProduktModalComponent } from 'src/app/components/novy-produkt-modal/novy-produkt-modal.component';

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
    IonItem, IonSelect, IonSelectOption, IonSearchbar, IonSpinner,
    IonList, IonCard, IonFab, IonFabButton
  ],


  providers: [
    ModalController,
    ToastController,
    AlertController
  ]

})
export class InventoryComponent implements OnInit {

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

  async otvoritNovyProdukt() {
    const modal = await this.modalController.create({
      component: NovyProduktModalComponent
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm' && data) {
      console.log('Nový produkt vytvorený:', data);

      this.zobrazToast('Produkt úspešne pridaný', 'success');
      if (this.vybranyRegalId) {
        this.onRegalChange(this.vybranyRegalId);
      } else if (this.rezimZobrazenia === 'global') {
        this.nacitajVsetkoGlobalne();
      }
    }
  }

  get unikatneKategorie(): string[] {
    const kategorie = this.zasoby.map(z => z.kategoria || 'Bez kategórie');
    return [...new Set(kategorie)].sort();
  }

  async ngOnInit() {
    await this.nacitajSklady();
    await this.checkInventura();
  }


  async checkInventura() {
    try {
      this.aktivnaInventura = await this.supabaseService.getOtvorenaInventura();
      if (this.aktivnaInventura) {
        this.zobrazToast(`🔵 Režim INVENTÚRA: ${this.aktivnaInventura.nazov}`, 'primary');
      }
    } catch (e) {
      console.error(e);
    }
  }

  async nacitajSklady() {
    try {
      this.isLoading = true;
      this.sklady = await this.supabaseService.getSklady();
    } catch (error) {
      this.zobrazToast('Nepodarilo sa načítať sklady.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  zmenitRezim(event: any) {
    this.rezimZobrazenia = event.detail.value;
    this.searchQuery = '';
    this.filterKategoria = 'vsetky';

    if (this.rezimZobrazenia === 'global') {
      this.jeGlobalnyPohlad = true;
      this.nacitajVsetkoGlobalne();
    } else if (this.rezimZobrazenia === 'v_inventure') {
      this.jeGlobalnyPohlad = true;
      this.nacitajPolozkyVInventure();
    } else {
      this.jeGlobalnyPohlad = false;
      this.zasoby = [];
      this.filtrovaneZasoby = [];
      this.vybranyRegalId = null;
    }
  }


  async nacitajPolozkyVInventure() {
    if (!this.aktivnaInventura) return;

    try {
      this.isLoading = true;

      const hotovePolozky = await this.supabaseService.getPolozkyVInventure(this.aktivnaInventura.id);


      this.zasoby = hotovePolozky.map(z => ({ ...z, v_inventure: true }));

      this.aktualizovatFilter();
    } catch (e) {
      this.zobrazToast('Chyba pri načítaní hotových položiek', 'danger');
    } finally {
      this.isLoading = false;
    }
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
    this.searchQuery = '';
    this.filterKategoria = 'vsetky';

    try {
      this.isLoading = true;
      this.zasoby = await this.supabaseService.getZasobyNaRegali(regalId);
      this.aktualizovatFilter();
    } catch (error) {
      this.zobrazToast('Chyba pri načítaní zásob', 'danger');
    } finally {
      this.isLoading = false;
    }
  }


  async nacitajVsetkoGlobalne() {
    this.vybranySkladId = null;
    this.vybranyRegalId = null;
    try {
      this.isLoading = true;
      this.zasoby = await this.supabaseService.getVsetkyZasoby();
      this.aktualizovatFilter();
      this.zobrazToast('Zobrazené všetky produkty vo firme', 'primary');
    } catch (e) {
      this.zobrazToast('Chyba načítania', 'danger');
    } finally {
      this.isLoading = false;
    }
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
    if (!cielovyRegalId) return;

    try {
      this.isLoading = true;
      if (this.aktivnaInventura) {
        await this.supabaseService.zapisatDoInventury(
          this.aktivnaInventura.id,
          zasoba.produkt_id,
          cielovyRegalId,
          novyStav
        );


        zasoba.v_inventure = true;

        await this.zobrazToast(`Zapísané: ${novyStav}`, 'primary');
      } else {
        await this.supabaseService.updateZasobu(zasoba.id, zasoba.produkt_id, novyStav, zasoba.mnozstvo_ks);
        await this.zobrazToast(`Uložené: ${novyStav}`, 'success');
      }

      zasoba.mnozstvo_ks = novyStav;
      this.aktualizovatFilter();
    } catch (error) {
      this.zobrazToast('Chyba ukladania', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  async zobrazToast(sprava: string, farba: 'success' | 'danger' | 'warning' | 'primary') {
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