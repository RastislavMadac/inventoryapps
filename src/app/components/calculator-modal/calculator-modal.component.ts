import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';

@Component({
  selector: 'app-calculator-modal',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './calculator-modal.component.html',
  styleUrls: ['./calculator-modal.component.scss'],
})
export class CalculatorModalComponent {

  @Input() nazovProduktu: string = '';
  @Input() aktualnyStav: number = 0;
  @Input() balenie: number = 1;
  display: string = '';
  vysledok: number | null = null;

  constructor(private modalController: ModalController) { }

  ngOnInit() {

    this.display = this.aktualnyStav.toString();
  }


  stlacene(hodnota: string) {

    if (hodnota === '.') {
      const casti = this.display.split(/[\+\-\*\/]/);
      const aktualneCislo = casti[casti.length - 1];


      if (aktualneCislo.includes('.')) {
        return;
      }
    }

    if (this.display === '0' && hodnota !== '.') {
      this.display = hodnota;
    } else {
      this.display += hodnota;
    }
  }


  vymazat() {
    this.display = '0';
  }


  zmazatJeden() {
    if (this.display.length > 1) {
      this.display = this.display.slice(0, -1);
    } else {
      this.display = '0';

    }
  }


  vypocitat() {
    try {

      const bezpecnyVypocet = this.display.replace(/x/g, '*');






      const funkciaVypoctu = new Function('return ' + bezpecnyVypocet);
      const vysledok = funkciaVypoctu();

      this.display = String(vysledok);
      return vysledok;
    } catch (e) {
      this.display = 'Chyba';
      return null;
    }
  }


  potvrdit() {
    const finalnaHodnota = this.vypocitat();

    if (finalnaHodnota !== null && !isNaN(finalnaHodnota)) {

      this.modalController.dismiss({ novyStav: finalnaHodnota }, 'confirm');
    }
  }


  zrusit() {
    this.modalController.dismiss(null, 'cancel');
  }

  pridatBalenie() {

    const aktualneCislo = parseFloat(this.display);

    if (!isNaN(aktualneCislo) && aktualneCislo !== 0) {

      const vysledok = aktualneCislo * this.balenie;
      this.display = vysledok.toString();
    } else {


      if (this.display === '0') {
        this.display = this.balenie.toString();
      } else {
        this.stlacene('*');
        this.stlacene(this.balenie.toString());
      }
    }
  }
}