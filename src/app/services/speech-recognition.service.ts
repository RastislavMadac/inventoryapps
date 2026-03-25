import { Injectable, NgZone } from '@angular/core';

// Povieme TypeScriptu, že tieto objekty existujú vo window
declare var window: any;

@Injectable({
    providedIn: 'root'
})
export class SpeechRecognitionService {
    private recognition: any;
    public isSupported: boolean = false;

    constructor(private zone: NgZone) {
        this.initSpeechRecognition();
    }

    /**
     * Inicializácia Web Speech API objektu
     */
    private initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (SpeechRecognition) {
            this.isSupported = true;
            this.recognition = new SpeechRecognition();

            // Konfigurácia pre náš Use-Case
            this.recognition.lang = 'sk-SK';     // Slovenský jazyk
            this.recognition.continuous = false; // Po 1 slove/vete sa samo vypne
            this.recognition.interimResults = false; // Zaujíma nás až finálny výsledok, nie čiastkové slabiky
            this.recognition.maxAlternatives = 1;
        } else {
            console.warn('Váš prehliadač nepodporuje Web Speech API.');
            this.isSupported = false;
        }
    }

    /**
     * Spustí počúvanie a vráti rozpoznaný text
     */
    /**
        * Spustí počúvanie a vráti rozpoznaný text
        */
    async startListening(): Promise<string> {
        if (!this.isSupported) {
            throw new Error('Rozpoznávanie reči nie je vo vašom prehliadači podporované.');
        }

        return new Promise((resolve, reject) => {
            let handled = false; // Poistka, aby sme nevolali resolve/reject viackrát

            // 1. Úspešné rozpoznanie
            this.recognition.onresult = (event: any) => {
                const rozpoznanyText = event.results[0][0].transcript;
                handled = true;
                this.zone.run(() => resolve(rozpoznanyText));
            };

            // 2. Spracovanie chýb (napr. zamietnutý mikrofón)
            this.recognition.onerror = (event: any) => {
                handled = true;
                console.error('Chyba rozpoznávania reči:', event.error);
                this.zone.run(() => reject(event.error));
            };

            // 3. Ukončenie počúvania (aj keď sa nič nenašlo)
            this.recognition.onend = () => {
                if (!handled) {
                    // Prehliadač vypol mikrofón (napr. pre ticho), ale nemáme výsledok.
                    // Musíme odmietnuť Promise, aby sa slučka v komponente odsekla a mohla pretočiť.
                    handled = true;
                    this.zone.run(() => reject('no-speech'));
                }
            };

            try {
                this.recognition.start();
            } catch (error) {
                if (!handled) {
                    handled = true;
                    reject(error);
                }
            }
        });
    }
    /**
     * Manuálne zastavenie mikrofónu
     */
    stopListening() {
        if (this.isSupported && this.recognition) {
            this.recognition.stop();
        }
    }
}