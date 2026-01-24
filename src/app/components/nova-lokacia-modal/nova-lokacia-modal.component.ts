import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { SupabaseService } from 'src/app/services/supabase.service';

@Component({
  selector: 'app-nova-lokacia-modal',
  templateUrl: './nova-lokacia-modal.component.html',
  styleUrls: ['./nova-lokacia-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class NovaLokaciaModalComponent implements OnInit {

  typ: 'sklad' | 'regal' = 'sklad';

  // Prepínač v záložke Regál: Chcem vybrať existujúci alebo vytvoriť nový sklad?
  zdrojSkladu: 'existujuci' | 'novy' = 'existujuci';

  nazovSkladu: string = '';
  nazovRegalu: string = '';

  vybranySkladId: number | null = null;
  sklady: any[] = [];

  constructor(
    private modalCtrl: ModalController,
    private supabase: SupabaseService,
    private toastCtrl: ToastController
  ) { }

  async ngOnInit() {
    await this.nacitajSklady();
  }

  async nacitajSklady() {
    try {
      this.sklady = await this.supabase.getSklady();
    } catch (e) {
      console.error(e);
    }
  }

  // Keď prepnete záložku, skontrolujeme, či ste už niečo napísali do názvu skladu
  zmenitTyp(ev: any) {
    this.typ = ev.detail.value;

    if (this.typ === 'regal' && this.nazovSkladu.trim().length > 0) {
      // Ak užívateľ napísal názov skladu a prepol na regál, 
      // automaticky prepneme režim na "Nový sklad"
      this.zdrojSkladu = 'novy';
    }
  }

  zrusit() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  async ulozit() {
    try {
      // --- A) Ukladáme iba SKLAD ---
      if (this.typ === 'sklad') {
        if (!this.nazovSkladu.trim()) {
          this.toast('Zadajte názov skladu', 'warning');
          return;
        }
        await this.supabase.vytvoritSklad(this.nazovSkladu);
        this.toast('Sklad vytvorený', 'success');
      }

      // --- B) Ukladáme REGÁL (a možno aj SKLAD) ---
      else {
        if (!this.nazovRegalu.trim()) {
          this.toast('Zadajte názov regálu', 'warning');
          return;
        }

        let finalneSkladId = this.vybranySkladId;

        // Ak užívateľ zvolil "Nový sklad", najprv ho vytvoríme
        if (this.zdrojSkladu === 'novy') {
          if (!this.nazovSkladu.trim()) {
            this.toast('Zadajte názov nového skladu', 'warning');
            return;
          }

          // 1. Vytvoríme sklad
          const novySklad = await this.supabase.vytvoritSklad(this.nazovSkladu);

          // 2. Získame jeho ID (Supabase vracia objekt, niekedy pole, ošetríme to)
          finalneSkladId = novySklad.id;

          if (!finalneSkladId) {
            this.toast('Chyba pri vytváraní skladu', 'danger');
            return;
          }
        } else {
          // Kontrola pre existujúci sklad
          if (!finalneSkladId) {
            this.toast('Vyberte existujúci sklad', 'warning');
            return;
          }
        }

        // 3. Vytvoríme regál v správnom sklade (či už novom alebo starom)
        await this.supabase.vytvoritRegal(this.nazovRegalu, finalneSkladId);

        if (this.zdrojSkladu === 'novy') {
          this.toast('Vytvorený nový sklad aj regál', 'success');
        } else {
          this.toast('Regál vytvorený', 'success');
        }
      }

      this.modalCtrl.dismiss(true, 'confirm');

    } catch (e) {
      console.error(e);
      this.toast('Chyba pri vytváraní', 'danger');
    }
  }

  async toast(msg: string, color: string) {
    const t = await this.toastCtrl.create({ message: msg, duration: 2000, color });
    t.present();
  }
}