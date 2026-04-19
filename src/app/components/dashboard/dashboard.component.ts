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

  async otvoritValidaciu() {
    // CHECKPOINT 1: Štart
    const t1 = await this.toastCtrl.create({ message: '1. Dáta sa načítavajú...', duration: 1000, position: 'top' });
    await t1.present();

    if (!this.aktualnaInventuraId) {
      alert('❌ Chýba ID inventúry!');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Spracovávam... (to môže chvíľu trvať)' });
    await loading.present();

    try {
      // Krok 1: Stiahnutie základných dát (SEKVENČNE PRE ZISTENIE CHYBY)
      console.log('⏳ 1/3 Stťahujem: porovnatImportSInventurou...');
      const rozdiely = await this.supabase.porovnatImportSInventurou(this.aktualnaInventuraId);
      console.log('✅ 1/3 Hotovo! Nájdené rozdiely:', rozdiely?.length || 0);

      console.log('⏳ 2/3 Sťahujem: skontrolovatNeznameProdukty...');
      const nezname = await this.supabase.skontrolovatNeznameProdukty(this.aktualnaInventuraId);
      console.log('✅ 2/3 Hotovo! Neznáme produkty:', nezname?.length || 0);

      console.log('⏳ 3/3 Sťahujem: getRawInventuraData...');
      const spocitaneZaznamy = await this.supabase.getRawInventuraData(this.aktualnaInventuraId);
      console.log('✅ 3/3 Hotovo! Spočítané záznamy:', spocitaneZaznamy?.length || 0);

      const spocitaneProduktIds = new Set(spocitaneZaznamy.map((z: any) => z.produkt_id));
      const vysledky: any[] = [];

      // Krok 2: Spracovanie lokácií - IDEME PO JEDNOM (Safe mode pre mobil)
      // Pôvodný Promise.all(map) sme nahradili klasickým cyklom for, aby sme nepreťažili sieť
      for (const r of rozdiely) {
        let znameLokacie: any[] = [];
        let mozneZameny: any[] = [];

        if (r.produkt_id) {
          try {
            const zasoby = await this.supabase.ziskatLokacieProduktu(r.produkt_id);
            if (zasoby && zasoby.length > 0) {
              znameLokacie = zasoby.filter((z: any) => z.regaly).map((z: any) => {
                const regalObj = Array.isArray(z.regaly) ? z.regaly[0] : z.regaly;
                const nazovSkladu = (Array.isArray(regalObj.sklady) ? regalObj.sklady[0]?.nazov : regalObj.sklady?.nazov) || 'Sklad';
                return { id: regalObj.id, nazov: `${nazovSkladu} - ${regalObj.nazov}`, mnozstvo: z.mnozstvo_ks };
              });
            }

            const produktVKatalogu = this.vsetkyProduktyKatalog.find(p => p.id === r.produkt_id);
            const kategoriaId = produktVKatalogu ? produktVKatalogu.kategoria_id : null;
            if (kategoriaId) {
              mozneZameny = this.vsetkyProduktyKatalog.filter(p =>
                p.kategoria_id === kategoriaId && spocitaneProduktIds.has(p.id) && p.id !== r.produkt_id
              );
            }
          } catch (innerErr) {
            console.warn('Chyba pri načítaní lokácie pre produkt:', r.produkt_id);
          }
        }

        vysledky.push({
          ...r, expanded: false, mnozstvo_uprava: null,
          regal_id: znameLokacie.length === 1 ? znameLokacie[0].id : null,
          odpocitat_z_id: null, mnozstvo_na_odpocet: null,
          zname_lokacie: znameLokacie, mozneZameny: mozneZameny
        });
      }

      this.vysledokPorovnania = vysledky;
      this.neznameProdukty = nezname.map((p: any) => ({ ...p, expanded: false }));

      // CHECKPOINT 3: Otvárame modál
      if (this.vysledokPorovnania.length > 0 || this.neznameProdukty.length > 0) {
        this.isModalOpen = true;
      } else {
        alert('Všetko v poriadku, 100% zhoda.');
      }

    } catch (e: any) {
      console.error('Fatálna chyba:', e);
      alert('❌ CHYBA PRI SPRACOVANÍ: ' + (e.message || JSON.stringify(e)));
    } finally {
      await loading.dismiss();
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

