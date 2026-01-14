import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { SupabaseService } from 'src/app/services/supabase.service';

import { clipboardOutline, cubeOutline, layersOutline } from 'ionicons/icons';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterLink], // Odstránená duplicita IonicModule
})
export class HomePage implements OnInit {

  currentUserEmail: string = '';
  constructor(private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({
      'clipboard-outline': clipboardOutline,
      'cube-outline': cubeOutline,
      'layers-outline': layersOutline
    });
  }
  ngOnInit() {
    // A. Skúsime načítať hneď (pre web/rýchle zariadenia)
    this.nacitajUzivatela();

    // B. POČÚVAME NA ZMENY (Toto opraví problém na mobile)
    // Supabase pošle signál hneď, ako načíta session z pamäte mobilu
    this.supabaseService.supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth zmena:', event); // Pre debugging

      if (session && session.user) {
        this.currentUserEmail = session.user.email || '';
      } else {
        this.currentUserEmail = '';
      }

      // C. Vynútime aktualizáciu obrazovky
      // Angular niekedy nezistí zmenu, ktorá prišla "zvonku" (zo Supabase SDK)
      this.cdr.detectChanges();
    });
  }

  async nacitajUzivatela() {
    const { data } = await this.supabaseService.supabase.auth.getUser();
    if (data && data.user) {
      this.currentUserEmail = data.user.email || '';
      this.cdr.detectChanges(); // Aj tu pre istotu povieme Angularu "prekresli sa"
    }
  }
}