import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';



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
    kategoria: string;
    mnozstvo_ks: number;
    balenie_ks: number;
    umiestnenie?: string;
    regal_id?: number;
    v_inventure?: boolean;
}

export interface Inventura {
    id: number;
    nazov: string;
    stav: 'otvorena' | 'uzavreta';
    datum_vytvorenia: string;
    datum_uzavretia?: string;
}

@Injectable({
    providedIn: 'root'
})
export class SupabaseService {
    private supabase: SupabaseClient;

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

    async getZasobyNaRegali(regalId: number) {
        const { data, error } = await this.supabase
            .from('skladove_zasoby')
            .select(`
        id,
        mnozstvo_ks,
        produkt:produkty (
          id,
          nazov,
          balenie_ks,
          kategorie ( nazov )
        )
      `)
            .eq('regal_id', regalId);

        if (error) throw error;

        const sformatovaneData: SkladovaZasobaView[] = data.map((item: any) => ({
            id: item.id,
            produkt_id: item.produkt?.id,
            nazov: item.produkt?.nazov || 'Neznámy produkt',
            kategoria: item.produkt?.kategorie?.nazov || 'Bez kategórie',
            mnozstvo_ks: item.mnozstvo_ks,
            balenie_ks: item.produkt?.balenie_ks || 1
        }));

        return sformatovaneData.sort((a, b) => a.nazov.localeCompare(b.nazov));
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
        const { data, error } = await this.supabase
            .from('inventury')
            .select('*')
            .order('datum_vytvorenia', { ascending: false });

        if (error) throw error;
        return data as Inventura[];
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

    async getVsetkyZasoby() {
        const { data, error } = await this.supabase
            .from('skladove_zasoby')
            .select(`
        id,
        mnozstvo_ks,
        regal_id,
        produkt:produkty (
          id, nazov, balenie_ks, kategorie(nazov)
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
            kategoria: item.produkt?.kategorie?.nazov || 'Bez kategórie',
            mnozstvo_ks: item.mnozstvo_ks,
            balenie_ks: item.produkt?.balenie_ks || 1,
            regal_id: item.regal_id,
            umiestnenie: `${item.regal?.sklad?.nazov} | ${item.regal?.nazov}`
        }));

        return sformatovaneData.sort((a, b) => a.nazov.localeCompare(b.nazov));
    }


    async uzavrietInventuru(inventuraId: number) {
        const { error } = await this.supabase.rpc('uzavriet_inventuru', {
            p_inventura_id: inventuraId
        });

        if (error) throw error;
    }


    async getDetailInventuryPreExport(inventuraId: number) {
        const { data, error } = await this.supabase
            .from('inventura_polozky')
            .select(`
        mnozstvo,
        produkt:produkty (
          nazov,
          ean,
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
            'EAN': item.produkt?.ean || '',
            'Kategória': item.produkt?.kategoria?.nazov || '',
            'Sklad': item.regal?.sklad?.nazov || '',
            'Regál': item.regal?.nazov || '',
            'Jednotka': item.produkt?.jednotka || 'Neznáma',
            'Balenie': item.produkt?.balenie_ks || 1,
            'Spočítané Množstvo': item.mnozstvo
        }));
    }


    async getKategorie() {
        const { data, error } = await this.supabase
            .from('kategorie')
            .select('*')
            .order('nazov');
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



    async odhlasit() {
        const { error } = await this.supabase.auth.signOut();
        if (error) throw error;
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
            produkty:produkt_id ( nazov, balenie_ks )
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
            balenie_ks: d.produkty?.balenie_ks || 1,
            kategoria: 'Sklad',
            v_inventure: true,
            umiestnenie: d.regaly?.nazov || `Regál č. ${d.regal_id}`
        }));
    }

    async zmazatInventuru(id: number) {
        // Najprv zmažeme položky inventúry (ak nemáte v databáze nastavené ON DELETE CASCADE)
        await this.supabase.from('inventura_polozky').delete().eq('inventura_id', id);

        // Potom zmažeme samotnú inventúru
        const { error } = await this.supabase
            .from('inventury')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
    // ... existujúci kód ...

    // 1. Vytvorenie Skladu
    async vytvoritSklad(nazov: string) {
        const { data, error } = await this.supabase
            .from('sklady')
            .insert({ nazov: nazov })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // 2. Vytvorenie Regálu (musí byť priradený k skladu)
    async vytvoritRegal(nazov: string, skladId: number) {
        const { data, error } = await this.supabase
            .from('regaly')
            .insert({ nazov: nazov, sklad_id: skladId })
            .select()
            .single();

        if (error) throw error;
        return data;
    }


}