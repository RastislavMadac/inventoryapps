import { Injectable, Injector, NgZone } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { Network } from '@capacitor/network';
import { SupabaseService } from './supabase.service';

export interface SyncTask {
    id: string;
    operation: 'ZAPIS_DO_INVENTURY'; // Neskôr môžete pridať ďalšie (napr. UPDATE_PRODUKT)
    payload: any;
    timestamp: string;
}

@Injectable({
    providedIn: 'root'
})
export class SyncService {
    private _storage: Storage | null = null;
    public isOnline: boolean = true;
    private isProcessing: boolean = false;

    constructor(private storage: Storage, private injector: Injector,
        private zone: NgZone
    ) {
        this.init();
    }

    // Získanie referencie na SupabaseService až keď ju reálne potrebujeme
    private get supabaseService(): SupabaseService {
        return this.injector.get(SupabaseService);
    }
    async init() {
        this._storage = await this.storage.create();

        // 1. Zistenie úvodného stavu (Natívne API prehliadača je rýchlejšie a presnejšie)
        this.isOnline = navigator.onLine;

        // 2. Natívne Webové Eventy (100% spoľahlivé pre Chrome/Edge/Safari PWA)
        window.addEventListener('online', () => this.nastavStavSiete(true));
        window.addEventListener('offline', () => this.nastavStavSiete(false));

        // 3. Capacitor Eventy (Záloha pre prípadné natívne Android/iOS zostavenie)
        Network.addListener('networkStatusChange', status => {
            this.nastavStavSiete(status.connected);
        });
    }

    /**
     * Centrálna metóda pre spracovanie zmeny siete.
     * Zabezpečuje NgZone a filtruje duplicitné volania (ak by reagoval Window aj Capacitor).
     */
    private nastavStavSiete(jeOnline: boolean) {
        this.zone.run(() => {
            if (this.isOnline !== jeOnline) { // Zabráni duplicite
                console.log('📶 Stav siete sa zmenil na:', jeOnline ? 'ONLINE' : 'OFFLINE');
                this.isOnline = jeOnline;

                if (this.isOnline) {
                    this.processQueue();
                }
            }
        });
    }
    // Pridanie úlohy do lokálnej fronty (IndexedDB)
    async addToQueue(operation: SyncTask['operation'], payload: any) {
        const queue: SyncTask[] = (await this._storage?.get('sync_queue')) || [];
        const newTask: SyncTask = {
            id: crypto.randomUUID(),
            operation,
            payload,
            timestamp: new Date().toISOString()
        };

        queue.push(newTask);
        await this._storage?.set('sync_queue', queue);
        console.log(`[Offline] Úloha ${operation} uložená do fronty.`);
    }

    // Hromadné spracovanie čakajúcich úloh po obnove internetu
    async processQueue() {
        if (this.isProcessing || !this.isOnline) return;

        const queue: SyncTask[] = (await this._storage?.get('sync_queue')) || [];
        if (queue.length === 0) return;

        this.isProcessing = true;
        const remainingQueue: SyncTask[] = [];

        console.log(`[Sync] Začínam synchronizáciu ${queue.length} úloh...`);

        for (const task of queue) {
            try {
                if (task.operation === 'ZAPIS_DO_INVENTURY') {
                    // Voláme priamo metódu zo SupabaseService
                    await this.supabaseService.zapisatDoInventuryBezQueue(
                        task.payload.inventuraId,
                        task.payload.produktId,
                        task.payload.regalId,
                        task.payload.mnozstvo,
                        task.payload.balenie
                    );
                }
            } catch (err) {
                console.error(`[Sync] Zlyhalo odoslanie úlohy ${task.id}`, err);
                remainingQueue.push(task); // Úloha sa neodoslala, ostáva vo fronte na ďalší pokus
            }
        }

        // Uložíme zostatok (ideálne prázdne pole, ak všetko prešlo)
        await this._storage?.set('sync_queue', remainingQueue);
        this.isProcessing = false;
    }

    // Uloženie stiahnutého katalógu do pamäte telefónu
    async cacheKatalog(zasoby: any[]) {
        await this._storage?.set('offline_katalog', zasoby);
        console.log('📦 Katalóg bol úspešne uložený pre offline použitie.');
    }

    // Vytiahnutie katalógu pri výpadku internetu
    async getOfflineKatalog(): Promise<any[]> {
        const data = await this._storage?.get('offline_katalog');
        return data || [];
    }
}