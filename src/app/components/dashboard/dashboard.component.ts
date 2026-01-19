import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SupabaseService } from 'src/app/services/supabase.service';
import { addIcons } from 'ionicons';
import { statsChartOutline, alertCircleOutline, refreshOutline } from 'ionicons/icons';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  @Output() filterClick = new EventEmitter<string>(); // Emituje udalosť kliknutia

  stats = {
    celkovo: 0,
    bezId: 0
  };
  isLoading = true;

  constructor(private supabase: SupabaseService) {
    addIcons({ statsChartOutline, alertCircleOutline, refreshOutline });
  }

  async ngOnInit() {
    await this.obnovitStatistiky();
  }

  async obnovitStatistiky() {
    this.isLoading = true;
    try {
      this.stats = await this.supabase.getStatistikyKatalogu();
    } catch (e) {
      console.error('Chyba dashboardu:', e);
    } finally {
      this.isLoading = false;
    }
  }

  klikNaBezId() {
    // Pošleme rodičovi signál, že chceme filtrovať "bez-id"
    this.filterClick.emit('bez-id');
  }

  klikNaVsetky() {
    this.filterClick.emit('vsetky');
  }
}