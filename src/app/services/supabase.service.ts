import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Subject, Observable } from 'rxjs';

export interface Sklad {
    id: number;
    nazov: string;
}

export interface Regal {
    id: number;
    sklad_id: number;
    nazov: string;
}

export interface SkladovaZasobaView {
    id: number;
    produkt_id: number;
    nazov: string;
    ean?: string;
    kategoria: string;
    mnozstvo_ks: number;
    balenie_ks: number;
    umiestnenie?: string;
    regal_id?: number;
    v_inventure?: boolean;
    jednotka?: string;

}

export interface Inventura {
    id: number;
    nazov: string;
    stav: 'otvorena' | 'uzavreta';
    datum_vytvorenia: string;
    datum_uzavretia?: string;
    pocet_neznamych?: number;
}

@Injectable({
    providedIn: 'root'
})
export class SupabaseService {
    public supabase: SupabaseClient;

    constructor() {
        this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false
            }
        });
    }



    async getSklady() {
        const { data, error } = await this.supabase
            .from('sklady')
            .select('*')
            .order('nazov');

        if (error) throw error;
        return data as Sklad[];
    }

    async getRegaly(skladId: number) {
        const { data, error } = await this.supabase
            .from('regaly')
            .select('*')
            .eq('sklad_id', skladId)
            .order('nazov');

        if (error) throw error;
        return data as Regal[];
    }

    async vytvoritSklad(nazov: string) {
        const { data, error } = await this.supabase
            .from('sklady')
            .insert({ nazov: nazov })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async vytvoritRegal(nazov: string, skladId: number) {
        const { data, error } = await this.supabase
            .from('regaly')
            .insert({ nazov: nazov, sklad_id: skladId })
            .select()
            .single();

        if (error) throw error;
        return data;
    }



    async getZasobyNaRegali(regalId: number): Promise<SkladovaZasobaView[]> {
        const { data, error } = await this.supabase
            .from('skladove_zasoby')
            .select(`
        id,
        mnozstvo_ks,
        regal_id,
        produkt:produkty (
          id,
          nazov,
          ean,
          balenie_ks,
          jednotka,       
          kategorie ( nazov )
        ),
        regal:regaly (
          id,
          nazov,
          sklad:sklady ( nazov )
        )
      `)
            .eq('regal_id', regalId);

        if (error) throw error;

        return data.map((item: any) => ({
            id: item.id,
            produkt_id: item.produkt?.id,
            nazov: item.produkt?.nazov,
            ean: item.produkt?.ean,
            jednotka: item.produkt?.jednotka || 'ks',
            balenie_ks: item.produkt?.balenie_ks,
            mnozstvo_ks: item.mnozstvo_ks,
            regal_id: item.regal_id,
            kategoria: item.produkt?.kategorie?.nazov,
            umiestnenie: `${item.regal?.sklad?.nazov} - ${item.regal?.nazov}`
        }));
    }

    async getVsetkyZasoby() {

        const { data, error } = await this.supabase
            .from('skladove_zasoby')
            .select(`
        id,
        mnozstvo_ks,
        regal_id,
        produkt:produkty (
          id, nazov, ean, balenie_ks, jednotka, kategorie(nazov)
        ),
        regal:regaly (
          id, nazov,
          sklad:sklady ( nazov )
        )
      `);

        if (error) throw error;

        const sformatovaneData: SkladovaZasobaView[] = data.map((item: any) => ({
            id: item.id,
            produkt_id: item.produkt?.id,
            nazov: item.produkt?.nazov || 'Neznámy',
            ean: item.produkt?.ean,
            kategoria: item.produkt?.kategorie?.nazov || 'Bez kategórie',
            mnozstvo_ks: item.mnozstvo_ks,
            balenie_ks: item.produkt?.balenie_ks || 1,
            regal_id: item.regal_id,
            umiestnenie: `${item.regal?.sklad?.nazov} | ${item.regal?.nazov}`,
            jednotka: item.produkt?.jednotka || 'kg'
        }));

        return sformatovaneData.sort((a, b) => a.nazov.localeCompare(b.nazov));
    }



    async getVsetkyProduktyKatalog(): Promise<SkladovaZasobaView[]> {
        const { data, error } = await this.supabase
            .from('produkty')
            .select(`
            *,
            kategorie ( nazov )
          `)
            .order('nazov');

        if (error) throw error;

        const vysledok: SkladovaZasobaView[] = [];

        // 👇 ZMENA: Už nepozeráme na 'skladove_zasoby', ale vytvárame
        // len jednu čistú kartu pre každý produkt.
        data.forEach((prod: any) => {
            vysledok.push({
                id: 0, // 0 signalizuje, že ide o položku z katalógu (nie konkrétnu zásobu)
                produkt_id: prod.id,
                nazov: prod.nazov,
                ean: prod.ean,
                jednotka: prod.jednotka,
                balenie_ks: prod.balenie_ks,
                mnozstvo_ks: 0, // Vždy začíname od nuly
                regal_id: undefined, // Nemá regál, kým ho neurčíte vo filtri
                kategoria: prod.kategorie?.nazov,
                umiestnenie: '📦 Katalóg' // Informácia pre užívateľa
            });
        });

        return vysledok;
    }



    async updateZasobu(zasobaId: number, produktId: number, novyStav: number, staryStav: number) {
        const { error: updateError } = await this.supabase
            .from('skladove_zasoby')
            .update({
                mnozstvo_ks: novyStav,
                updated_at: new Date().toISOString()
            })
            .eq('id', zasobaId);

        if (updateError) {
            throw new Error('Chyba pri aktualizácii: ' + updateError.message);
        }


        const { error: insertError } = await this.supabase
            .from('zaznamy_inventury')
            .insert({
                produkt_id: produktId,
                stary_stav_ks: staryStav,
                novy_stav_ks: novyStav,
                rozdiel_ks: novyStav - staryStav
            });

        if (insertError) {
            console.error('História zlyhala', insertError);
        }
        return true;
    }

    async insertZasobu(produktId: number, regalId: number, mnozstvo: number) {
        const { error } = await this.supabase
            .from('skladove_zasoby')
            .insert({
                produkt_id: produktId,
                regal_id: regalId,
                mnozstvo_ks: mnozstvo
            });

        if (error) throw error;
    }



    async signIn(email: string, heslo: string) {
        const { data, error } = await this.supabase.auth.signInWithPassword({
            email: email,
            password: heslo,
        });
        if (error) throw error;
        return data;
    }

    async signOut() {
        const { error } = await this.supabase.auth.signOut();
        if (error) throw error;
    }

    async getCurrentUser() {
        const { data } = await this.supabase.auth.getUser();
        return data.user;
    }

    async odhlasit() {
        return this.signOut();
    }



    async vytvoritInventuru(nazov: string) {
        const { data, error } = await this.supabase
            .from('inventury')
            .insert({ nazov: nazov, stav: 'otvorena' })
            .select()
            .single();

        if (error) throw error;
        return data as Inventura;
    }

    async getOtvorenaInventura() {
        const { data, error } = await this.supabase
            .from('inventury')
            .select('*')
            .eq('stav', 'otvorena')
            .maybeSingle();

        if (error) throw error;
        return data as Inventura | null;
    }

    async getZoznamInventur() {
        // 1. Stiahneme zoznam inventúr
        const { data: inventury, error } = await this.supabase
            .from('inventury')
            .select('*')
            .order('datum_vytvorenia', { ascending: false });

        if (error) throw error;

        // 2. Pre každú inventúru zistíme počet položiek bez ID
        const zoznam: Inventura[] = [];

        for (const inv of inventury) {
            // Zrátame riadky, kde produkt nemá vlastne_id (je null)
            const { count } = await this.supabase
                .from('inventura_polozky')
                .select('produkt:produkty!inner(id)', { count: 'exact', head: true })
                .eq('inventura_id', inv.id)
                .is('produkt.vlastne_id', null);

            // Pridáme do výsledku aj s počtom
            zoznam.push({
                ...inv,
                pocet_neznamych: count || 0
            });
        }

        return zoznam;
    }

    async zapisatDoInventury(inventuraId: number, produktId: number, regalId: number, mnozstvo: number) {
        const { error } = await this.supabase
            .from('inventura_polozky')
            .upsert({
                inventura_id: inventuraId,
                produkt_id: produktId,
                regal_id: regalId,
                mnozstvo: mnozstvo,
                created_at: new Date().toISOString()
            }, { onConflict: 'inventura_id, produkt_id, regal_id' });

        if (error) throw error;
        return true;
    }

    async getPolozkyVInventure(inventuraId: number): Promise<SkladovaZasobaView[]> {
        const { data, error } = await this.supabase
            .from('inventura_polozky')
            .select(`
        id,
        mnozstvo,
        produkt_id,
        regal_id,
        regaly:regal_id ( nazov ),
        produkty:produkt_id ( nazov, balenie_ks, ean, jednotka )
      `)
            .eq('inventura_id', inventuraId);

        if (error) {
            console.error('Chyba pri načítaní inventúry:', error);
            throw error;
        }

        return (data as any[]).map(d => ({
            id: d.id,
            produkt_id: d.produkt_id,
            regal_id: d.regal_id,
            mnozstvo_ks: d.mnozstvo,
            nazov: d.produkty?.nazov || 'Neznámy produkt',
            ean: d.produkty?.ean,
            balenie_ks: d.produkty?.balenie_ks || 1,
            jednotka: d.produkty?.jednotka || 'ks',
            kategoria: 'Sklad',
            v_inventure: true,
            umiestnenie: d.regaly?.nazov || `Regál č. ${d.regal_id}`
        }));
    }

    async uzavrietInventuru(inventuraId: number) {
        const { error } = await this.supabase.rpc('uzavriet_inventuru', {
            p_inventura_id: inventuraId
        });
        if (error) throw error;
    }

    async zmazatInventuru(id: number) {
        await this.supabase.from('inventura_polozky').delete().eq('inventura_id', id);
        const { error } = await this.supabase
            .from('inventury')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }

    async getInventuraStavNaRegali(inventuraId: number, regalId: number) {
        const { data, error } = await this.supabase
            .from('inventura_polozky')
            .select('produkt_id, mnozstvo')
            .eq('inventura_id', inventuraId)
            .eq('regal_id', regalId);

        if (error) throw error;
        return data as { produkt_id: number, mnozstvo: number }[];
    }

    async getRawInventuraData(inventuraId: number) {
        const { data, error } = await this.supabase
            .from('inventura_polozky')
            .select('produkt_id, regal_id, mnozstvo')
            .eq('inventura_id', inventuraId);

        if (error) throw error;
        return data as { produkt_id: number, regal_id: number, mnozstvo: number }[];
    }

    async getDetailInventuryPreExport(inventuraId: number) {
        const { data, error } = await this.supabase
            .from('inventura_polozky')
            .select(`
        mnozstvo,
        produkt:produkty (
          nazov,
          vlastne_id,
          balenie_ks,
          jednotka,
          kategoria:kategorie ( nazov )
        ),
        regal:regaly (
          nazov,
          sklad:sklady ( nazov )
        )
      `)
            .eq('inventura_id', inventuraId);

        if (error) throw error;

        return data.map((item: any) => ({
            'Produkt': item.produkt?.nazov || 'Neznámy',
            'Product ID': item.produkt?.vlastne_id || '',
            'Kategória': item.produkt?.kategoria?.nazov || '',
            'Sklad': item.regal?.sklad?.nazov || '',
            'Regál': item.regal?.nazov || '',
            'Jednotka': item.produkt?.jednotka || 'Neznáma',
            'Balenie': item.produkt?.balenie_ks || 1,
            'Spočítané Množstvo': item.mnozstvo
        }));
    }



    listenToInventuraChanges(): Observable<any> {
        const changes = new Subject<any>();

        this.supabase
            .channel('public:inventura_polozky')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'inventura_polozky' },
                (payload) => {
                    changes.next(payload);
                }
            )
            .subscribe();

        return changes.asObservable();
    }



    async getKategorie() {
        const { data, error } = await this.supabase
            .from('kategorie')
            .select('*')
            .order('nazov');
        if (error) throw error;
        return data;
    }

    async vytvoritKategoriu(nazov: string) {
        const { data, error } = await this.supabase
            .from('kategorie')
            .insert({ nazov: nazov })
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async vytvoritProdukt(novyProdukt: any) {
        const { data, error } = await this.supabase
            .from('produkty')
            .insert(novyProdukt)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async updateProdukt(id: number, data: any) {
        const { error } = await this.supabase
            .from('produkty')
            .update(data)
            .eq('id', id);

        if (error) throw error;
    }

    async vytvoritProduktSLocation(novyProdukt: any, regalId: number | null) {
        const { data: produkt, error: errProd } = await this.supabase
            .from('produkty')
            .insert(novyProdukt)
            .select()
            .single();

        if (errProd) throw errProd;

        if (regalId && produkt) {
            const { error: errStock } = await this.supabase
                .from('skladove_zasoby')
                .insert({
                    produkt_id: produkt.id,
                    regal_id: regalId,
                    mnozstvo_ks: 0
                });

            if (errStock) console.error('Chyba pri vytváraní zásoby:', errStock);
        }
        return produkt;
    }

    async zmazatZaznamZInventury(inventuraId: number, produktId: number, regalId: number) {
        const { error } = await this.supabase
            .from('inventura_polozky')
            .delete()
            .match({
                inventura_id: inventuraId,
                produkt_id: produktId,
                regal_id: regalId
            });

        if (error) throw error;
    }

    async zmazatZasobuZoSkladu(zasobaId: number) {
        const { error } = await this.supabase
            .from('skladove_zasoby')
            .delete()
            .eq('id', zasobaId);

        if (error) throw error;
    }

    // Pridajte do triedy SupabaseService:

    async presunutZasobu(zasobaId: number, novyRegalId: number) {
        // 1. Skontrolujeme, či na cieľovom regáli už taký produkt nie je
        // (Aby sme nevytvorili duplicitu)
        const { data: existujuca } = await this.supabase
            .from('skladove_zasoby')
            .select('id')
            .eq('regal_id', novyRegalId)
        // Tu musíme vedieť produkt_id, ale v update to robíme cez ID zásoby.
        // Pre jednoduchosť skúsime update a odchytíme chybu unikátnosti, ak máte nastavené constraints.
        // Alebo jednoducho spravíme update:

        const { error } = await this.supabase
            .from('skladove_zasoby')
            .update({ regal_id: novyRegalId })
            .eq('id', zasobaId);

        if (error) throw error;
    }
    async ziskatRoluPouzivatela(): Promise<string> {
        const user = await this.supabase.auth.getUser();
        if (!user.data.user) return 'viewer';

        const { data } = await this.supabase
            .from('profiles')
            .select('role')
            .eq('id', user.data.user.id)
            .single();

        return data?.role || 'user';
    }
    // Priradí produkt k už existujúcemu záznamu v inventúre
    async sparovatProdukt(polozkaId: number, produktId: number) {
        const { error } = await this.supabase
            .from('inventura_polozky')
            .update({ produkt_id: produktId })
            .eq('id', polozkaId);

        if (error) throw error;
    }
    // Načíta položky z konkrétnej inventúry, ktoré nemajú vyplnené vlastne_id (Product ID)
    async getPolozkyBezId(inventuraId: number) {
        const { data, error } = await this.supabase
            .from('inventura_polozky')
            .select(`
        id,
        mnozstvo,
        regal:regaly(nazov, sklad:sklady(nazov)),
        produkt:produkty!inner(id, nazov, vlastne_id, jednotka)
      `)
            .eq('inventura_id', inventuraId)
            .is('produkt.vlastne_id', null); // Filtrujeme len tie, čo nemajú ID (v Supabase to môže byť null alebo prázdny string, treba ošetriť)

        if (error) throw error;

        // Supabase .is('null') niekedy nestačí ak je tam prázdny string "", 
        // tak to prefiltrujeme ešte v JavaScripte pre istotu.
        return data.filter((item: any) => !item.produkt.vlastne_id || item.produkt.vlastne_id.trim() === '');
    }

    // Uloží nové ID k produktu
    async aktualizovatProductId(produktId: number, noveId: string) {
        const { error } = await this.supabase
            .from('produkty')
            .update({ vlastne_id: noveId }) // alebo 'ean', podľa toho čo používate ako Product ID
            .eq('id', produktId);

        if (error) throw error;
    }
}