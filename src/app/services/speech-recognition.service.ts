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
    async startListening(): Promise<string> {
        if (!this.isSupported) {
            throw new Error('Rozpoznávanie reči nie je vo vašom prehliadači podporované.');
        }

        return new Promise((resolve, reject) => {
            // Úspešné rozpoznanie
            this.recognition.onresult = (event: any) => {
                const rozpoznanyText = event.results[0][0].transcript;
                // Vrátime výsledok do Angular zóny
                this.zone.run(() => resolve(rozpoznanyText));
            };

            // Spracovanie chýb (napr. používateľ nič nepovedal, alebo zamietol mikrofón)
            this.recognition.onerror = (event: any) => {
                console.error('Chyba rozpoznávania reči:', event.error);
                this.zone.run(() => reject(event.error));
            };

            // Ukončenie počúvania (aj keď sa nič nenašlo)
            this.recognition.onend = () => {
                // Tu môžeme pridať logiku pre prípadné reštartovanie, ak by bolo treba
            };

            try {
                // Prehliadač si sám vyžiada povolenie na mikrofón pri prvom spustení
                this.recognition.start();
            } catch (error) {
                // Catch block ak by sa metóda start() zavolala viackrát naraz
                reject(error);
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