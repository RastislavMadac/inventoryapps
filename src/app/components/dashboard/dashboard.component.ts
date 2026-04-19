import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from 'src/app/services/supabase.service';
import { ExportService } from 'src/app/services/export.service';
import { addIcons } from 'ionicons';
import {
  statsChartOutline, alertCircleOutline, refreshOutline,
  closeCircleOutline, alertCircle, checkmarkCircleOutline,
  createOutline, checkmarkDoneCircleOutline, chevronForward, timeOutline, cloudUploadOutline, documentTextOutline, listOutline, addCircle, chevronDown, warningOutline, cubeOutline, informationCircleOutline
} from 'ionicons/icons';
import { AlertController, ToastController, LoadingController } from '@ionic/angular';

import {
  IonCard, IonCardContent, IonIcon, IonSpinner, IonList,
  IonItem, IonLabel, IonBadge, IonButton, IonCardHeader,
  IonCardTitle, IonCardSubtitle, IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonContent, IonCheckbox,
  IonSelect,
  IonSelectOption,
  IonInput, IonChip, IonSearchbar, IonRippleEffect
} from '@ionic/angular/standalone';

import { FormsModule } from '@angular/forms';
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonCard, IonCardContent, IonIcon, IonSpinner,
    IonList, IonItem, IonLabel, IonBadge, IonButton, IonCardHeader, IonCardTitle, IonCardSubtitle, IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonContent, FormsModule, IonChip,
    IonCheckbox, IonSearchbar,
    IonSelect,
    IonSelectOption,
    IonInput, IonRippleEffect
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {

  // Globálne štatistiky katalógu
  stats = { celkovo: 0, bezId: 0, spocitaneGlobal: 0 };
  aktualnaInventuraId: number | null = null;
  // Zoznam všetkých inventúr s ich počtami
  zoznamInventurStats: any[] = [];

  isLoadingStats = true;
  // 1. Pridaj premennú do triedy DashboardComponent
  isInvExpanded: boolean = false;
  isModalOpen: boolean = false;
  searchQueryModal: string = '';
  vysledokPorovnania: any[] = [];
  isLoadingZoznam = false;
  neznameProdukty: any[] = [];

  kategorie: any[] = [];
  strediska: any[] = [];
  maNahranyImport: boolean = false; // 🔥 Hore pri ostatných premenných
  vsetkyProduktyKatalog: any[] = [];
  regalySkladu: any[] = [];
  // 2. Pridaj jednoduchú funkciu na prepínanie
  toggleInventury() {
    this.isInvExpanded = !this.isInvExpanded;
  }
  @ViewChild('zoznamRef') zoznamElement!: ElementRef;
  zobrazeneProdukty: any[] = [];
  nadpisZoznamu: string = '';


  constructor(
    private supabase: SupabaseService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private exportService: ExportService,
    private loadingCtrl: LoadingController
  ) {
    addIcons({ statsChartOutline, alertCircleOutline, cloudUploadOutline, closeCircleOutline, warningOutline, informationCircleOutline, timeOutline, createOutline, cubeOutline, refreshOutline, alertCircle, checkmarkCircleOutline, checkmarkDoneCircleOutline, chevronForward, documentTextOutline, listOutline, addCircle, chevronDown });
  }



  async ngOnInit() {
    await this.obnovitStatistiky();
    this.kategorie = await this.supabase.getKategorie();
    this.strediska = await this.supabase.getStrediska();
    this.vsetkyProduktyKatalog = await this.supabase.getVsetkyProduktyZoznam();
    this.regalySkladu = await this.supabase.getVsetkyRegaly();
    await this.overitExistujuciImport();
  }

  get pocetVybranychNeznamych() {
    return this.neznameProdukty.filter(p => p.selected).length;
  }
  async overitExistujuciImport() {
    const otvorena = await this.supabase.getOtvorenaInventura();
    if (otvorena) {
      this.aktualnaInventuraId = otvorena.id;
      const pocet = await this.supabase.getPocetImportovTemp(otvorena.id);
      this.maNahranyImport = pocet > 0;
    } else {
      this.maNahranyImport = false;
    }
  }

  // 1. Zabezpečí len samotné nahratie nového súboru do databázy
  async onFileChange(event: any) {
    const file = event.target.files[0];
    if (!file || !this.aktualnaInventuraId) return;

    const loading = await this.loadingCtrl.create({ message: 'Nahrávam Excel na server...' });
    await loading.present();

    try {
      const jsonData = await this.exportService.parsovatExcelImport(file);
      await this.supabase.nahratImportDoTemp(this.aktualnaInventuraId, jsonData);
      this.maNahranyImport = true;

      await loading.dismiss(); // Vypneme starý loading
      await this.otvoritValidaciu(); // Otvoríme rovno validáciu

    } catch (error: any) {
      console.error(error);
      const errToast = await this.toastCtrl.create({ message: 'Chyba importu: ' + error.message, color: 'danger', duration: 4000 });
      errToast.present();
      await loading.dismiss();
    } finally {
      event.target.value = '';
    }
  }

  // 🔥 BLESKOVÁ (TURBO) A NEPRIESTRELNÁ METÓDA PRE VALIDACIU EXCELU
  async otvoritValidaciu() {
    if (!this.aktualnaInventuraId) {
      const err = await this.toastCtrl.create({ message: '❌ Chýba ID inventúry!', duration: 3000, color: 'danger', position: 'top' });
      err.present();
      return;
    }

    const startToast = await this.toastCtrl.create({ message: 'Spracovávam dáta...', duration: 1500, position: 'top', color: 'tertiary' });
    await startToast.present();

    try {
      // 🔥 TURBO KROK 1: Sťahujeme všetky 3 hlavné balíky dát NARAZ (Paralelne)
      const [rozdiely, nezname, spocitaneZaznamy] = await Promise.all([
        this.supabase.porovnatImportSInventurou(this.aktualnaInventuraId),
        this.supabase.skontrolovatNeznameProdukty(this.aktualnaInventuraId),
        this.supabase.getRawInventuraData(this.aktualnaInventuraId)
      ]);

      // 🔥 Ochrana proti tichému pádu
      const safeRozdiely = rozdiely || [];
      const safeNezname = nezname || [];
      const safeSpocitane = spocitaneZaznamy || [];
      const safeKatalog = this.vsetkyProduktyKatalog || [];

      const spocitaneProduktIds = new Set(safeSpocitane.map((z: any) => z.produkt_id));

      // 🔥 TURBO KROK 2: Zisťujeme lokácie pre všetky problémové produkty NARAZ (Paralelne)
      const vysledky = await Promise.all(safeRozdiely.map(async (r: any) => {
        let znameLokacie: any[] = [];
        let mozneZameny: any[] = [];

        if (r.produkt_id) {
          try {
            const zasoby = await this.supabase.ziskatLokacieProduktu(r.produkt_id);
            if (zasoby && zasoby.length > 0) {
              znameLokacie = zasoby.filter((z: any) => z.regaly).map((z: any) => {
                const regalObj = Array.isArray(z.regaly) ? z.regaly[0] : z.regaly;
                if (!regalObj) return null;
                const skladData = regalObj.sklady;
                const nazovSkladu = (Array.isArray(skladData) ? skladData[0]?.nazov : skladData?.nazov) || '';
                return { id: regalObj.id, nazov: `${nazovSkladu} - ${regalObj.nazov}`, mnozstvo: z.mnozstvo_ks };
              }).filter((item: any) => item !== null);
            }

            const produktVKatalogu = safeKatalog.find(p => p.id === r.produkt_id);
            const kategoriaId = produktVKatalogu ? produktVKatalogu.kategoria_id : null;

            if (kategoriaId) {
              mozneZameny = safeKatalog.filter(p =>
                p.kategoria_id === kategoriaId && spocitaneProduktIds.has(p.id) && p.id !== r.produkt_id
              );
            }
          } catch (innerErr) {
            console.warn('Chyba pri lokáciách:', innerErr);
          }
        }

        return {
          ...r, expanded: false, mnozstvo_uprava: null,
          regal_id: znameLokacie.length === 1 ? znameLokacie[0].id : null,
          odpocitat_z_id: null, mnozstvo_na_odpocet: null,
          zname_lokacie: znameLokacie, mozneZameny: mozneZameny
        };
      }));

      // 🔥 Prebúdzame Angular a otvárame modál bez sekania
      setTimeout(async () => {
        this.vysledokPorovnania = vysledky;

        this.neznameProdukty = safeNezname.map((p: any) => ({
          ...p, expanded: false, kategoria_id: null, stredisko_id: null,
          balenie_ks: 1, regal_id: null, odpocitat_z_id: null, mnozstvo_na_odpocet: null
        }));

        if (this.vysledokPorovnania.length > 0 || this.neznameProdukty.length > 0) {
          this.isModalOpen = true;
        } else {
          const t = await this.toastCtrl.create({ message: 'Excel je v 100% zhode!', color: 'success', duration: 4000, position: 'top' });
          await t.present();
        }
      }, 0);

    } catch (e: any) {
      console.error(e);
      const errToast = await this.toastCtrl.create({ message: '❌ CHYBA: ' + (e.message || 'Neznáma chyba databázy'), color: 'danger', duration: 8000, position: 'top' });
      await errToast.present();
    }
  }

  // 🔥 PRIDANÝ GETTER A METÓDA PRE OPRAVU CHÝB
  get pocetVybranychChyb() {
    return this.vysledokPorovnania.filter(c => c.selected).length;
  }

  // async opravitVybraneChyby() {
  //   const vybrane = this.vysledokPorovnania.filter(c => c.selected);
  //   if (vybrane.length === 0) return;

  //   const loading = await this.loadingCtrl.create({ message: 'Aplikujem opravy na sklad...' });
  //   await loading.present();

  //   try {
  //     for (const chyba of vybrane) {
  //       if (!chyba.produkt_id) {
  //         console.warn('Pozor: Produkt nemá ID, aktualizuj SQL funkciu.', chyba.nazov);
  //         continue;
  //       }

  //       // Zavoláme servis s regálom aj zámenou
  //       await this.supabase.opravitChybuNaSklade({
  //         produkt_id: chyba.produkt_id,
  //         mnozstvo_uprava: chyba.mnozstvo_uprava,
  //         regal_id: chyba.regal_id,
  //         odpocitat_z_id: chyba.odpocitat_z_id,
  //         mnozstvo_na_odpocet: chyba.mnozstvo_na_odpocet
  //       });
  //     }

  //     const toast = await this.toastCtrl.create({
  //       message: `Úspešne opravených ${vybrane.length} chýb v inventúre.`,
  //       duration: 3000, color: 'success'
  //     });
  //     await toast.present();

  //     this.vysledokPorovnania = this.vysledokPorovnania.filter(c => !c.selected);
  //     await this.obnovitStatistiky();

  //     if (this.neznameProdukty.length === 0 && this.vysledokPorovnania.length === 0) {
  //       this.isModalOpen = false;
  //     }
  //   } catch (error: any) {
  //     console.error('Chyba pri oprave:', error);
  //     const errToast = await this.toastCtrl.create({
  //       message: 'Chyba: ' + error.message,
  //       duration: 5000, color: 'danger'
  //     });
  //     await errToast.present();
  //   } finally {
  //     await loading.dismiss();
  //   }
  // }

  async obnovitStatistiky() {
    this.isLoadingStats = true;
    try {
      // 1. Základné dáta katalógu
      const katalog = await this.supabase.getStatistikyKatalogu();
      const global = await this.supabase.getPocetSpocitanychGlobal();

      this.stats = {
        celkovo: katalog.celkovo,
        bezId: katalog.bezId,
        spocitaneGlobal: global
      };

      // 2. Načítame zoznam všetkých inventúr a ich progres (musíš mať túto funkciu v SupabaseService)
      this.zoznamInventurStats = await this.supabase.getZoznamInventurSoStats();

    } catch (e) {
      console.error('Chyba pri načítaní Dashboardu:', e);
    } finally {
      this.isLoadingStats = false;
    }
  }

  // Zobrazenie detailného zoznamu pre konkrétnu inventúru
  async zobrazitDetailInventury(inv: any) {
    this.nadpisZoznamu = `Položky: ${inv.nazov}`;
    this.isLoadingZoznam = true;
    this.zobrazeneProdukty = [];

    try {
      // Stiahneme prvých 100 položiek danej inventúry
      this.zobrazeneProdukty = await this.supabase.getPolozkyVInventure(inv.id, 0, 100);
      this.scrollToList();
    } catch (e) {
      console.error(e);
    } finally {
      this.isLoadingZoznam = false;
    }
  }

  async zobrazitSpocitaneGlobal() {
    this.nadpisZoznamu = 'Všetky vykonané zápisy (História)';
    this.isLoadingZoznam = true;
    try {
      const { data, error } = await this.supabase.supabase
        .from('inventura_polozky')
        .select(`id, mnozstvo, produkty:produkt_id ( nazov, vlastne_id )`)
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      this.zobrazeneProdukty = data.map((d: any) => ({
        id: d.id, nazov: d.produkty?.nazov, vlastne_id: d.produkty?.vlastne_id, mnozstvo_ks: d.mnozstvo
      }));
      this.scrollToList();
    } catch (e) { console.error(e); } finally { this.isLoadingZoznam = false; }
  }

  async zobrazitBezId() {
    this.nadpisZoznamu = 'Produkty bez vlastného ID';
    this.isLoadingZoznam = true;
    try {
      this.zobrazeneProdukty = await this.supabase.getProduktyBezIdZoznam();
      this.scrollToList();
    } catch (e) { console.error(e); } finally { this.isLoadingZoznam = false; }
  }

  async zobrazitVsetky() {
    this.nadpisZoznamu = 'Všetky produkty v katalógu';
    this.isLoadingZoznam = true;
    try {
      this.zobrazeneProdukty = await this.supabase.getVsetkyProduktyZoznam();
      this.scrollToList();
    } catch (e) { console.error(e); } finally { this.isLoadingZoznam = false; }
  }

  private scrollToList() {
    setTimeout(() => {
      if (this.zoznamElement) {
        this.zoznamElement.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  }

  zavrietZoznam() {
    this.nadpisZoznamu = '';
    this.zobrazeneProdukty = [];
  }

  // async importovatNeznameProdukty() {
  //   const vybrane = this.neznameProdukty.filter(p => p.selected);
  //   if (vybrane.length === 0) return;

  //   const loading = await this.loadingCtrl.create({ message: 'Zapisujem do katalógu a skladu...' });
  //   await loading.present();

  //   try {
  //     // Použijeme for...of cyklus pre bezpečné asynchrónne volania za sebou
  //     for (const prod of vybrane) {
  //       // 1. Vytvoríme nový produkt v hlavnom katalógu (produkty)
  //       const novyProdukt = await this.supabase.vytvoritProdukt({
  //         nazov: prod.nazov,
  //         vlastne_id: prod.vlastne_id,
  //         Interne_id: prod.interne_id,
  //         kategoria_id: prod.kategoria_id,
  //         stredisko_id: prod.stredisko_id,
  //         balenie_ks: prod.balenie_ks,
  //         jednotka: 'ks' // Predvolená hodnota
  //       });

  //       // 2. Zapíšeme na sklad a prípadne odpočítame substitúciu
  //       await this.supabase.spracovatPrijemSoSubstituciou({
  //         produkt_id: novyProdukt.id,
  //         mnozstvo: prod.mnozstvo,
  //         regal_id: prod.regal_id, // Bude null, ak nevybral regál v UI
  //         odpocitat_z_id: prod.odpocitat_z_id,
  //         mnozstvo_na_odpocet: prod.mnozstvo_na_odpocet
  //       });
  //     }

  //     const toast = await this.toastCtrl.create({
  //       message: `Úspešne pridaných ${vybrane.length} produktov.`,
  //       duration: 3000,
  //       color: 'success',
  //       position: 'bottom'
  //     });
  //     await toast.present();

  //     // Vyčistenie a obnova UI
  //     this.neznameProdukty = this.neznameProdukty.filter(p => !p.selected);
  //     await this.obnovitStatistiky();

  //     if (this.neznameProdukty.length === 0 && this.vysledokPorovnania.length === 0) {
  //       this.isModalOpen = false;
  //     }

  //   } catch (error: any) {
  //     console.error('Chyba pri importe:', error);
  //     const errToast = await this.toastCtrl.create({
  //       message: 'Chyba pri pridávaní položiek: ' + error.message,
  //       duration: 5000, color: 'danger'
  //     });
  //     await errToast.present();
  //   } finally {
  //     await loading.dismiss();
  //   }
  // }


  async zmenitId(p: any) { /* Tvoja existujúca funkcia na zmenu ID */ }
  async ulozitNoveId(id: number, noveId: string) { /* Tvoja existujúca funkcia */ }

  // 1. INDIVIDUÁLNE ULOŽENIE: Neznámy produkt
  async importovatNeznamyProdukt(prod: any) {
    const loading = await this.loadingCtrl.create({ message: 'Zapisujem do katalógu...' });
    await loading.present();

    try {
      const novyProdukt = await this.supabase.vytvoritProdukt({
        nazov: prod.nazov,
        vlastne_id: prod.vlastne_id,
        Interne_id: prod.interne_id,
        kategoria_id: prod.kategoria_id,
        stredisko_id: prod.stredisko_id,
        balenie_ks: prod.balenie_ks,
        jednotka: 'ks'
      });

      await this.supabase.spracovatPrijemSoSubstituciou({
        produkt_id: novyProdukt.id,
        mnozstvo: prod.mnozstvo,
        regal_id: prod.regal_id,
        odpocitat_z_id: prod.odpocitat_z_id,
        mnozstvo_na_odpocet: prod.mnozstvo_na_odpocet
      });

      // Odstránime vybavenú položku zo zoznamu
      this.neznameProdukty = this.neznameProdukty.filter(p => p !== prod);

      const toast = await this.toastCtrl.create({ message: 'Produkt úspešne pridaný.', duration: 2000, color: 'success' });
      await toast.present();

      await this.skontrolovatKoniecModalu();
    } catch (error: any) {
      console.error('Chyba:', error);
      const errToast = await this.toastCtrl.create({ message: 'Chyba: ' + error.message, duration: 4000, color: 'danger' });
      await errToast.present();
    } finally {
      await loading.dismiss();
    }
  }

  // 2. INDIVIDUÁLNE ULOŽENIE: Oprava chyby (Červené / Žlté)
  async opravitJednuChybu(chyba: any) {
    if (!chyba.produkt_id || !this.aktualnaInventuraId) {
      const t = await this.toastCtrl.create({ message: 'Zlyhanie: Produkt nemá ID.', duration: 3000, color: 'danger' });
      t.present();
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Aplikujem opravu...' });
    await loading.present();

    try {
      await this.supabase.opravitChybuNaSklade({
        inventura_id: this.aktualnaInventuraId, // 🔥 TOTO PRIDAJ
        produkt_id: chyba.produkt_id,
        mnozstvo_uprava: chyba.mnozstvo_uprava,
        regal_id: chyba.regal_id,
        odpocitat_z_id: chyba.odpocitat_z_id,
        mnozstvo_na_odpocet: chyba.mnozstvo_na_odpocet
      });

      // Odstránime vybavenú položku zo zoznamu
      this.vysledokPorovnania = this.vysledokPorovnania.filter(c => c !== chyba);

      const toast = await this.toastCtrl.create({ message: 'Oprava úspešne aplikovaná.', duration: 2000, color: 'success' });
      await toast.present();

      await this.skontrolovatKoniecModalu();
    } catch (error: any) {
      console.error('Chyba:', error);
      const errToast = await this.toastCtrl.create({ message: 'Chyba: ' + error.message, duration: 4000, color: 'danger' });
      await errToast.present();
    } finally {
      await loading.dismiss();
    }
  }

  // 3. POMOCNÁ FUNKCIA: Ak vyriešime všetko, zavrie sa okno
  async skontrolovatKoniecModalu() {
    await this.obnovitStatistiky();
    if (this.neznameProdukty.length === 0 && this.vysledokPorovnania.length === 0) {
      this.isModalOpen = false;
    }
  }

  odstranDiakritiku(text: string): string {
    if (!text) return '';
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  get filtruvaneNezname() {
    if (!this.searchQueryModal) return this.neznameProdukty;
    const query = this.odstranDiakritiku(this.searchQueryModal);
    return this.neznameProdukty.filter(p => this.odstranDiakritiku(p.nazov).includes(query));
  }

  get filtruvaneChyby() {
    if (!this.searchQueryModal) return this.vysledokPorovnania;
    const query = this.odstranDiakritiku(this.searchQueryModal);
    return this.vysledokPorovnania.filter(c => this.odstranDiakritiku(c.nazov).includes(query));
  }
  // 🔥 POMOCNÁ FUNKCIA: Automatické predvyplnenie odpočtu
  aktualizujOdpocet(chyba: any) {
    if (chyba.mnozstvo_uprava !== null && chyba.mnozstvo_uprava !== undefined) {
      // Math.abs() zabezpečí, že ak zadá -5 aj 5, do odpočtu pôjde čistých 5 ks
      chyba.mnozstvo_na_odpocet = Math.abs(chyba.mnozstvo_uprava);
    } else {
      chyba.mnozstvo_na_odpocet = null;
    }
  }
}

