import { Component, OnInit } from '@angular/core';
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
  constructor(private supabaseService: SupabaseService) {
    addIcons({
      'clipboard-outline': clipboardOutline,
      'cube-outline': cubeOutline,
      'layers-outline': layersOutline
    });
  }
  async ngOnInit() {
    // 👇 Získame prihláseného používateľa
    const { data } = await this.supabaseService.supabase.auth.getUser();
    if (data && data.user) {
      this.currentUserEmail = data.user.email || '';
    }
  }
}