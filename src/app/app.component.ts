import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import packageInfo from '../../package.json';
import { SyncService } from './services/sync.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  constructor(private syncService: SyncService) { }

  public appVersion: string = packageInfo.version;
}
