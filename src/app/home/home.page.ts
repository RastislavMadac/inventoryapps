import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { SupabaseService } from 'src/app/services/supabase.service';

import { clipboardOutline, cubeOutline, layersOutline, personCircleOutline, statsChartOutline } from 'ionicons/icons';
;
@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterLink],
})
export class HomePage implements OnInit {

  currentUserEmail: string = '';

  constructor(
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {
    addIcons({
      'clipboard-outline': clipboardOutline,
      'cube-outline': cubeOutline,
      'layers-outline': layersOutline,
      'person-circle-outline': personCircleOutline,
      'stats-chart-outline': statsChartOutline
    });
  }

  ngOnInit() {
    this.nacitajUzivatela();

    this.supabaseService.supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth zmena:', event);
      if (session && session.user) {
        this.currentUserEmail = session.user.email || '';
      } else {
        this.currentUserEmail = '';
      }
      this.cdr.detectChanges();
    });
  }

  async nacitajUzivatela() {
    const { data } = await this.supabaseService.supabase.auth.getUser();
    if (data && data.user) {
      this.currentUserEmail = data.user.email || '';
      this.cdr.detectChanges();
    }
  }


  spracovatFilterDashboardu(typ: string) {
    console.log('Kliknuté na dashboard:', typ);

    if (typ === 'bez-id') {

      this.router.navigate(['/inventory'], { queryParams: { filter: 'bez-id' } });
    } else {

      this.router.navigate(['/inventory']);
    }
  }
}