import { Component, Input, OnInit } from '@angular/core';
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

  private lastClickTime: number = 0;
  pocuva: boolean = false;
  constructor(
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
  }
  // >>> PRIDANÁ METÓDA: Rýchla zmena balenia <<<
  async zmenitVelkostBalenia() {
    const alert = await this.alertCtrl.create({
      header: 'Veľkosť balenia',
      message: 'Zadajte, koľko kusov je v jednom balení:',
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
            const textHodnota = data.noveBalenie.replace(',', '.');
            const cislo = parseFloat(textHodnota);

            if (!isNaN(cislo) && cislo > 0) {
              try {
                await this.supabaseService.updateProdukt(this.produktId, { balenie_ks: cislo });
                this.balenie = cislo;
              } catch (e: any) {
                const errorAlert = await this.alertCtrl.create({
                  header: 'Chyba',
                  message: 'Nepodarilo sa uložiť zmenu balenia: ' + e.message,
                  buttons: ['OK']
                });
                await errorAlert.present();
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
      await this.spustiPocuvanie();
    }
  }

  // Odstránime počúvanie pri zavretí okna, aby nebežalo na pozadí
  ionViewWillLeave() {
    this.speechService.stopListening();
  }

  async spustiPocuvanie() {
    this.pocuva = true;
    try {
      const rozpoznanyText = await this.speechService.startListening();
      this.spracujHlasovyVstup(rozpoznanyText);
    } catch (error) {
      console.warn('Počúvanie prerušené', error);
      // Ak používateľ stlačí manuálne číslo na kalkulačke, API to často zruší
    } finally {
      this.pocuva = false;
    }
  }

  private spracujHlasovyVstup(text: string) {
    // 1. PRED-SPRACOVANIE: Vyčistíme text a pripravíme desatinnú logiku
    let spracovanyText = text.toLowerCase().trim()
      .replace('potvrdiť', '')
      .replace('ok', '')
      .replace('uložiť', '')
      .replace('celých', '.')
      .replace('celé', '.')
      .replace('celá', '.')
      .replace('čiarka', '.')
      .replace(',', '.') // Prevod "10,5" na "10.5"
      .trim();

    // 2. RÝCHLY PARSING: Ak prehliadač vrátil priamo cifry (napr. "2500.5")
    let vysledneCislo = parseFloat(spracovanyText);

    // 3. SLOVNÍK (MAPA): Slovenský jazyk do 5000
    if (isNaN(vysledneCislo)) {
      const mapa: { [key: string]: number } = {
        // Jednotky a špecifické tvary
        'nula': 0, 'jeden': 1, 'jedna': 1, 'dva': 2, 'dve': 2, 'tri': 3, 'štyri': 4, 'päť': 5, 'šesť': 6, 'sedem': 7, 'osem': 8, 'deväť': 9,
        // Násť
        'desať': 10, 'jedenásť': 11, 'dvanásť': 12, 'trinásť': 13, 'štrnásť': 14, 'pätnásť': 15, 'šestnásť': 16, 'sedemnásť': 17, 'osemnásť': 18, 'devätnásť': 19,
        // Desiatky
        'dvadsať': 20, 'tridsať': 30, 'štyridsať': 40, 'päťdesiat': 50, 'šesťdesiat': 60, 'sedemdesiat': 70, 'osemdesiat': 80, 'deväťdesiat': 90,
        // Stovky
        'sto': 100, 'dvesto': 200, 'tristo': 300, 'štyristo': 400, 'päťsto': 500, 'šesťsto': 600, 'sedemsto': 700, 'osemsto': 800, 'deväťsto': 900,
        // Tisíce (do 5000)
        'tisíc': 1000, 'jedentisíc': 1000, 'dvetisíc': 2000, 'tritisíc': 3000, 'štyritisíc': 4000, 'päťtisíc': 5000
      };

      // Spracovanie desatinných miest cez bodku
      if (spracovanyText.includes('.')) {
        const casti = spracovanyText.split('.');
        const celaCast = this.prelozSlovaNaCislo(casti[0], mapa);
        const desatinnaCast = this.prelozSlovaNaCislo(casti[1], mapa);

        if (celaCast !== null && desatinnaCast !== null) {
          // Skombinujeme celú a desatinnú časť (napr. "2" + "." + "5")
          vysledneCislo = parseFloat(`${celaCast}.${desatinnaCast}`);
        }
      } else {
        // Len celé číslo
        vysledneCislo = this.prelozSlovaNaCislo(spracovanyText, mapa) ?? NaN;
      }
    }

    // 4. ZÁPIS DO KALKULAČKY A LOGIKA POTVRDENIA
    if (!isNaN(vysledneCislo)) {
      this.mainDisplay = vysledneCislo.toString();
      this.fullFormula = vysledneCislo.toString();
      this.shouldResetMain = true; // Pri ťuknutí na tlačidlo sa displej premaže

      // Automatické potvrdenie (ak zaznie klúčové slovo)
      const originalText = text.toLowerCase();
      if (originalText.includes('potvrdiť') || originalText.includes('ok') || originalText.includes('uložiť')) {
        this.potvrdit();
      }
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