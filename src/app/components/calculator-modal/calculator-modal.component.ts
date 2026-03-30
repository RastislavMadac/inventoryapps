import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, AlertController } from '@ionic/angular';
import { addIcons } from 'ionicons';
// >>> UPRAVENÉ: Pridaná ikona createOutline <<<
import { cubeOutline, eyeOutline, eyeOffOutline, createOutline } from 'ionicons/icons';
import { SupabaseService } from 'src/app/services/supabase.service';
import { SpeechRecognitionService } from 'src/app/services/speech-recognition.service'; // <<< PRIDANÁ SLUŽBA
@Component({
  selector: 'app-calculator-modal',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './calculator-modal.component.html',
  styleUrls: ['./calculator-modal.component.scss'],
})
export class CalculatorModalComponent implements OnInit {

  @Input() produktId: number = 0;
  @Input() nazovProduktu: string = '';
  @Input() aktualnyStav: number = 0;
  @Input() balenie: number = 1;
  @Input() jednotka: string = 'ks'; //
  povodnneBalenie: number = 1;
  // Dve premenné pre zobrazenie
  fullFormula: string = '';   // "10 + 5" (Skryté/Detail)
  mainDisplay: string = '0';  // "5" (Hlavné)

  zobrazitDetail: boolean = true
  shouldResetMain: boolean = false; // Flag: či sa má pri ďalšom čísle vymazať mainDisplay
  maPocuvat: boolean = false;
  private lastClickTime: number = 0;
  pocuva: boolean = false;
  constructor(
    private cdr: ChangeDetectorRef,
    private modalController: ModalController,
    private alertCtrl: AlertController,
    private supabaseService: SupabaseService,
    public speechService: SpeechRecognitionService
  ) {
    addIcons({ cubeOutline, eyeOutline, eyeOffOutline, createOutline });
  }
  ngOnInit() {
    this.balenie = this.balenie || 1;
    this.povodnneBalenie = this.balenie; // Zapamätáme si úvodnú hodnotu

    const pociatocnyStav = this.aktualnyStav || 0;
    this.mainDisplay = pociatocnyStav.toString();
    this.fullFormula = pociatocnyStav.toString();

    if (this.produktId > 0) {
      this.nacitajAktualneBalenie();
    }
  }

  // 👉 NOVÁ METÓDA: Vytiahne vždy presnú a aktuálnu hodnotu z tabuľky produkty
  async nacitajAktualneBalenie() {
    try {
      // Keďže máš 'supabase' nastavené ako public v SupabaseService, môžeme ho volať takto:
      const { data, error } = await this.supabaseService.supabase
        .from('produkty')
        .select('balenie_ks')
        .eq('id', this.produktId)
        .single();

      if (error) throw error;

      // Ak databáza vráti reálnu hodnotu väčšiu ako 1, aktualizujeme kalkulačku
      if (data && data.balenie_ks && data.balenie_ks > 1) {
        this.balenie = data.balenie_ks;
        this.povodnneBalenie = this.balenie;

        // Vynútime prekreslenie UI, aby sa zjavilo oranžové tlačidlo
        this.cdr.detectChanges();
      }
    } catch (err) {
      console.error('Chyba pri overovaní čerstvého balenia z DB:', err);
    }

  }
  async zmenitVelkostBalenia() {
    const alert = await this.alertCtrl.create({
      header: 'Veľkosť balenia',
      message: 'Zadajte, koľko kusov je v jednom balení (hodnota sa trvalo uloží k produktu):',
      inputs: [
        {
          name: 'noveBalenie',
          type: 'number',
          value: this.balenie > 1 ? this.balenie : '',
          placeholder: 'Napr. 12',
          min: 1
        }
      ],
      buttons: [
        { text: 'Zrušiť', role: 'cancel' },
        {
          text: 'Uložiť',
          handler: async (data) => {
            if (data.noveBalenie) {
              const textHodnota = String(data.noveBalenie).replace(',', '.');
              const cislo = parseFloat(textHodnota);

              if (!isNaN(cislo) && cislo > 0) {
                // 1. Aktualizujeme hodnoty lokálne
                this.balenie = cislo;
                this.povodnneBalenie = cislo;

                // 👉 2. VYNÚTIME PREKRESLENIE UI
                this.cdr.detectChanges();

                // 3. Uložíme do databázy
                try {
                  await this.supabaseService.updateProdukt(this.produktId, { balenie_ks: cislo });
                  console.log('📦 Balenie úspešne uložené do DB');
                } catch (error) {
                  console.error('❌ Chyba pri ukladaní balenia do DB:', error);
                }
              }
            }
          }
        }
      ]
    });

    await alert.present();
  }
  stlacene(hodnota: string) {
    // Debounce (proti dvojkliku)
    const now = Date.now();
    if (now - this.lastClickTime < 100) return;
    this.lastClickTime = now;

    const isOperator = ['+', '-', '*', '/'].includes(hodnota);

    if (isOperator) {
      this.handleOperator(hodnota);
    } else {
      this.handleNumber(hodnota);
    }
  }

  handleNumber(num: string) {
    // Ak sme práve stlačili operátor, alebo je tam 0, začíname nové číslo
    if (this.shouldResetMain || this.mainDisplay === '0') {
      if (num === '.') {
        this.mainDisplay = '0.';
      } else {
        this.mainDisplay = num;
      }
      this.shouldResetMain = false;
    } else {
      // Inak pripájame (napr. 1 -> 12)
      if (num === '.' && this.mainDisplay.includes('.')) return; // Iba jedna bodka
      this.mainDisplay += num;
    }

    // Aktualizujeme aj vzorec na pozadí
    // Ak bol posledný znak operátor, len pripájame. Ak číslo, tiež pripájame.
    // Musíme ošetriť "0" na začiatku vzorca, ak sa prepisuje
    if (this.fullFormula === '0' && num !== '.') {
      this.fullFormula = num;
    } else {
      this.fullFormula += num;
    }
  }

  handleOperator(op: string) {
    // Ak je posledný znak vo vzorci už operátor, vymeníme ho
    const lastChar = this.fullFormula.slice(-1);
    if (['+', '-', '*', '/'].includes(lastChar)) {
      this.fullFormula = this.fullFormula.slice(0, -1) + op;
      return;
    }

    // Tu spravíme "priebežný výpočet" pre štandardný efekt kalkulačky
    // Ale do vzorca len pridáme operátor
    this.calculateResultInternal(); // Toto vypočíta aktuálny stav a dá ho do mainDisplay

    this.fullFormula += op;
    this.shouldResetMain = true; // Pri najbližšom čísle vymažeme mainDisplay
  }

  vymazat() {
    this.mainDisplay = '0';
    this.fullFormula = '0';
    this.shouldResetMain = false;
  }

  zmazatJeden() {
    // Mažeme z hlavného displeja
    if (this.mainDisplay.length > 1) {
      this.mainDisplay = this.mainDisplay.slice(0, -1);
    } else {
      this.mainDisplay = '0';
      this.shouldResetMain = true; // Reset ak sme zmazali všetko
    }

    // Mažeme aj zo vzorca
    if (this.fullFormula.length > 1) {
      this.fullFormula = this.fullFormula.slice(0, -1);
    } else {
      this.fullFormula = '0';
    }
  }

  // Pomocná funkcia na bezpečný výpočet reťazca
  private evaluateString(str: string): number | null {
    try {
      // Nahradíme vizuálne 'x' za '*' ak by tam bolo, hoci používame '*'
      const safeCalc = str.replace(/x/g, '*');
      // Ošetrenie pre neúplný výraz (napr "5+")
      const lastChar = safeCalc.slice(-1);
      if (['+', '-', '*', '/'].includes(lastChar)) return null;

      const func = new Function('return ' + safeCalc);
      return func();
    } catch (e) {
      return null;
    }
  }

  // Interný výpočet pre priebežný stav (bez zmeny fullFormula na výsledok)
  calculateResultInternal() {
    const res = this.evaluateString(this.fullFormula);
    if (res !== null) {
      this.mainDisplay = res.toString();
    }
  }

  // Finálny výpočet (=)
  vypocitat() {
    const res = this.evaluateString(this.fullFormula);
    if (res !== null) {
      this.mainDisplay = res.toString();
      this.fullFormula = res.toString(); // Reset vzorca na výsledok
      this.shouldResetMain = true;       // Ak začne písať číslo, prepíše to
    } else {
      this.mainDisplay = 'Chyba';
    }
  }

  potvrdit() {
    this.maPocuvat = false;
    this.speechService.stopListening();
    const res = this.evaluateString(this.fullFormula);

    let vysledok = 0;
    if (res !== null && !isNaN(res)) {
      vysledok = res;
    } else {
      const simpleVal = parseFloat(this.mainDisplay);
      if (!isNaN(simpleVal)) vysledok = simpleVal;
    }

    // Ak sa balenie zmenilo oproti databáze, pošleme ho rodičovi na uloženie
    const noveBaleniePreDb = this.balenie !== this.povodnneBalenie ? this.balenie : null;

    this.modalController.dismiss({
      novyStav: vysledok,
      balenie: this.balenie
    }, 'confirm');
  }

  zrusit() {
    this.modalController.dismiss(null, 'cancel');
  }

  pridatBalenie() {
    // 1. FIX: Ak je aktuálna hodnota 0, nechceme násobiť (lebo 0 * x = 0),
    // ale chceme hodnotu priamo nastaviť na veľkosť balenia.
    if (this.fullFormula === '0' || this.fullFormula === '') {
      this.fullFormula = this.balenie.toString();
      this.mainDisplay = this.balenie.toString();
      this.shouldResetMain = true;
      return; // Končíme, ďalej už nenásobíme
    }

    // 2. Ak tam už nejaké číslo je, pokračujeme vašou pôvodnou logikou (násobenie)

    // Najprv simulujeme stlačenie operátora krát
    this.handleOperator('*');

    // Potom pridáme číslo balenia do vzorca
    this.fullFormula += this.balenie.toString();

    // A hneď vypočítame výsledok
    const res = this.evaluateString(this.fullFormula);
    if (res !== null) {
      this.mainDisplay = res.toString();
      // Necháme fullFormula tak ako je (napr "5*12"), aby to bolo vidno v detaile
      this.shouldResetMain = true;
    }
  }

  async ionViewWillEnter() {
    if (this.speechService.isSupported) {
      this.maPocuvat = true;
      this.spustiPocuvanie(); // Všimni si: odstránil som 'await', aby funkcia bežala na pozadí
    }
  }

  ionViewWillLeave() {
    this.maPocuvat = false; // Prerušíme slučku
    this.pocuva = false;
    this.speechService.stopListening();
  }

  async spustiPocuvanie() {
    // Ak už počúvame, zabránime viacnásobnému spusteniu
    if (this.pocuva) return;

    this.pocuva = true;
    this.maPocuvat = true;

    // Slučka udrží mikrofón aktívny, kým používateľ nepotvrdí alebo nezavrie modal
    while (this.maPocuvat) {
      try {
        const rozpoznanyText = await this.speechService.startListening();

        // Ak mikrofón niečo zachytil, spracujeme to
        if (rozpoznanyText) {
          this.spracujHlasovyVstup(rozpoznanyText);
        }
      } catch (error) {
        console.warn('Počúvanie prerušené, reštartujem...', error);
        // Operačný systém často vypne mikrofón pri tichu. 
        // Počkáme 300ms a slučka ho znova naštartuje.
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    this.pocuva = false;
  }
  private spracujHlasovyVstup(text: string) {
    console.log('🤖 Prehliadač počul:', text);
    const originalText = text.toLowerCase().trim();

    // 1. Kontrola, či zaznel povel na potvrdenie
    const obsahujePotvrdenie = originalText.includes('potvrdiť') ||
      originalText.includes('ok') ||
      originalText.includes('uložiť');

    // 2. Vyčistíme text od povelov a zjednotíme desatinné znaky na bodku
    let spracovanyText = originalText
      .replace('potvrdiť', '')
      .replace('ok', '')
      .replace('uložiť', '')
      .replace(/celých/g, '.')
      .replace(/celé/g, '.')
      .replace(/celá/g, '.')
      .replace(/čiarka/g, '.')
      .replace(/,/g, '.') // Pre istotu prepíše aj čiarku, ak ju prehliadač vráti
      .trim();

    // Ak zaznel len povel bez čísla
    if (spracovanyText === '') {
      if (obsahujePotvrdenie) {
        this.potvrdit();
      }
      return;
    }

    // 3. Zjednodušený slovník IBA pre jednotlivé cifry
    const mapaCislic: { [key: string]: string } = {
      'nula': '0', 'jeden': '1', 'jedna': '1', 'dva': '2', 'dve': '2',
      'tri': '3', 'štyri': '4', 'päť': '5', 'šesť': '6', 'sedem': '7',
      'osem': '8', 'deväť': '9'
    };

    // 4. PREKLAD: Rozbijeme text na slová a poskladáme z nich jedno dlhé "textové" číslo
    let poskladaneCisloText = '';
    const slova = spracovanyText.split(/\s+/); // Rozdelí podľa medzier

    for (const slovo of slova) {
      if (mapaCislic[slovo] !== undefined) {
        // Ak je to slovo (napr. "päť"), pridáme znak "5"
        poskladaneCisloText += mapaCislic[slovo];
      } else {
        // Ak to slovo nepoznáme, je to pravdepodobne bodka ".", alebo už priamo číslo
        // (napr. prehliadač bol šikovný a vrátil rovno "4" namiesto "štyri")
        poskladaneCisloText += slovo;
      }
    }

    // V tomto bode máme text napr. "67.4". Pre istotu z neho vymažeme akékoľvek zostatkové medzery.
    poskladaneCisloText = poskladaneCisloText.replace(/\s+/g, '');

    // 5. Prevod finálneho textu (napr. "67.4") na reálne matematické číslo
    let vysledneCislo = parseFloat(poskladaneCisloText);

    // 6. ZÁPIS DO KALKULAČKY
    if (!isNaN(vysledneCislo)) {
      this.mainDisplay = vysledneCislo.toString();
      this.fullFormula = vysledneCislo.toString();
      this.shouldResetMain = true;
    }

    // 7. AUTOMATICKÉ POTVRDENIE (ak zaznelo ok)
    if (obsahujePotvrdenie) {
      this.potvrdit();
    }
  }

  /**
   * Pomocná funkcia: Rozbije reťazec slov na pole a sčíta ich hodnoty z mapy
   */
  private prelozSlovaNaCislo(veta: string, mapa: any): number | null {
    const slova = veta.trim().split(/\s+/); // Rozdelenie podľa medzier
    let suma = 0;
    let nasloSaAsponJednoSlovo = false;

    for (const slovo of slova) {
      if (mapa[slovo] !== undefined) {
        suma += mapa[slovo];
        nasloSaAsponJednoSlovo = true;
      } else {
        // Kontrola, či slovo nie je priamo číslo (napr. "2 tisíc")
        const p = parseInt(slovo, 10);
        if (!isNaN(p)) {
          // Ak je to 1-9 a nasleduje "tisíc", spracujeme to ako násobok (napr. "2 tisíc")
          // Ale v našej mape už máme "dvetisíc", tak toto je skôr poistka
          suma += p;
          nasloSaAsponJednoSlovo = true;
        }
      }
    }

    return nasloSaAsponJednoSlovo ? suma : null;
  }
}