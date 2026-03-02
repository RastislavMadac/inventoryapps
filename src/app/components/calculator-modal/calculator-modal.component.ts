import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, AlertController } from '@ionic/angular';
import { addIcons } from 'ionicons';
// >>> UPRAVENÉ: Pridaná ikona createOutline <<<
import { cubeOutline, eyeOutline, eyeOffOutline, createOutline } from 'ionicons/icons';

@Component({
  selector: 'app-calculator-modal',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './calculator-modal.component.html',
  styleUrls: ['./calculator-modal.component.scss'],
})
export class CalculatorModalComponent implements OnInit {

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

  constructor(private modalController: ModalController, private alertCtrl: AlertController) {
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
          handler: (data) => {
            // Nahradíme čiarku za bodku (aby fungovalo "0,5" aj "0.5")
            const textHodnota = data.noveBalenie.replace(',', '.');
            // Použijeme parseFloat pre podporu desatinných čísel
            const cislo = parseFloat(textHodnota);

            // Prijímame všetko väčšie ako 0 (teda aj 0.5, 0.1 atď.)
            if (!isNaN(cislo) && cislo > 0) {
              this.balenie = cislo;
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
}