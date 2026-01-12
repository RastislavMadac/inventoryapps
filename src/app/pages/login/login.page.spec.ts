import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, NavController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase.service';
import { addIcons } from 'ionicons';
import { cubeOutline } from 'ionicons/icons';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss']
})
export class LoginPage {

  email = '';
  password = '';
  isLoading = false;

  constructor(
    private supabaseService: SupabaseService,
    private toastController: ToastController,
    private navCtrl: NavController // Na presmerovanie
  ) {
    addIcons({ cubeOutline });
  }

  async prihlasitSa() {
    if (!this.email || !this.password) {
      this.zobrazToast('Zadajte email a heslo', 'warning');
      return;
    }

    try {
      this.isLoading = true;
      await this.supabaseService.signIn(this.email, this.password);

      // Úspech -> Presmerovať na Inventúru (alebo Home)
      this.navCtrl.navigateRoot('/inventory');

    } catch (error: any) {
      this.zobrazToast('Nesprávny email alebo heslo', 'danger');
      console.error(error);
    } finally {
      this.isLoading = false;
    }
  }

  async zobrazToast(msg: string, color: string) {
    const toast = await this.toastController.create({
      message: msg,
      duration: 2000,
      color: color,
      position: 'top'
    });
    toast.present();
  }
}