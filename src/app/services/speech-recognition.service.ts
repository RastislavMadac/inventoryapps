import { Injectable, NgZone } from '@angular/core';

declare var window: any;

@Injectable({
    providedIn: 'root'
})
export class SpeechRecognitionService {
    private recognition: any;
    public isSupported: boolean = false;

    // Minimálna dĺžka slova na odfiltrovanie "pazvukov" (buchnutie, zakašlanie)
    private readonly MIN_WORD_LENGTH = 2;

    constructor(private zone: NgZone) {
        this.initSpeechRecognition();
    }

    private initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (SpeechRecognition) {
            this.isSupported = true;
            this.recognition = new SpeechRecognition();

            // Konfigurácia pre maximálnu kompatibilitu na mobiloch
            this.recognition.lang = 'sk-SK';
            this.recognition.continuous = false;     // PWA bug fix: nesmie byť true, inak zamrzne
            this.recognition.interimResults = false; // Čakáme len na finálne slovo
            this.recognition.maxAlternatives = 1;
        } else {
            console.warn('Váš prehliadač nepodporuje Web Speech API.');
            this.isSupported = false;
        }
    }

    async startListening(): Promise<string> {
        if (!this.isSupported) {
            throw new Error('Rozpoznávanie reči nie je vo vašom prehliadači podporované.');
        }

        return new Promise((resolve, reject) => {
            let handled = false;

            // 1. ZACHYTENIE VÝSLEDKU
            this.recognition.onresult = (event: any) => {
                if (handled) return;

                // Očistenie textu od interpunkcie
                let text = event.results[0][0].transcript.trim().toLowerCase();
                text = text.replace(/[.,!?]/g, '');

                // Ak je slovo dostatočne dlhé, vrátime ho
                if (text.length >= this.MIN_WORD_LENGTH) {
                    handled = true;
                    this.zone.run(() => resolve(text));
                }
            };

            // 2. CHYBY (napr. ticho = no-speech)
            this.recognition.onerror = (event: any) => {
                if (handled) return;
                handled = true;
                this.zone.run(() => reject(event.error));
            };

            // 3. UKONČENIE API (Ak nič nepovedal)
            this.recognition.onend = () => {
                if (!handled) {
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

    stopListening() {
        if (this.isSupported && this.recognition) {
            try {
                this.recognition.stop();
            } catch (e) {
                // Potichu odchytíme chybu, ak už bol zastavený
            }
        }
    }
}