import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { addIcons } from 'ionicons';

import { clipboardOutline, cubeOutline, layersOutline } from 'ionicons/icons';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterLink], // Odstránená duplicita IonicModule
})
export class HomePage {
  constructor() {
    addIcons({
      'clipboard-outline': clipboardOutline,
      'cube-outline': cubeOutline,
      'layers-outline': layersOutline
    });
  }
}