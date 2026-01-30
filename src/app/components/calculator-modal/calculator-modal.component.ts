import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cubeOutline, eyeOutline, eyeOffOutline } from 'ionicons/icons';

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

  // Dve premenné pre zobrazenie
  fullFormula: string = '';   // "10 + 5" (Skryté/Detail)
  mainDisplay: string = '0';  // "5" (Hlavné)

  zobrazitDetail: boolean = true
  shouldResetMain: boolean = false; // Flag: či sa má pri ďalšom čísle vymazať mainDisplay

  private lastClickTime: number = 0;

  constructor(private modalController: ModalController) {
    addIcons({ cubeOutline, eyeOutline, eyeOffOutline });
  }

  ngOnInit() {
    // Inicializácia
    this.mainDisplay = this.aktualnyStav.toString();
    this.fullFormula = this.aktualnyStav.toString();
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
    // Pre istotu prepočítame všetko
    const res = this.evaluateString(this.fullFormula);

    if (res !== null && !isNaN(res)) {
      this.modalController.dismiss({ novyStav: res }, 'confirm');
    } else {
      // Ak je tam chyba alebo len číslo v mainDisplay
      const simpleVal = parseFloat(this.mainDisplay);
      if (!isNaN(simpleVal)) {
        this.modalController.dismiss({ novyStav: simpleVal }, 'confirm');
      }
    }
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