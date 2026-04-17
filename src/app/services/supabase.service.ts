import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Subject, Observable } from 'rxjs';


export interface ZmenaPoradia {
    id: number;      // ID zo skladove_zasoby
    poradie: number; // Nový index
}
export interface Sklad {
    id: number;
    nazov: string;
    poradie?: number;
}

export interface Regal {
    id: number;
    sklad_id: number;
    nazov: string;
}

export interface SkladovaZasobaView {
    id: number;
    produkt_id: number;
    interne_id?: string;
    nazov: string;
    ean?: string;
    kategoria: string;
    kategoria_id?: number; // 🔥 Pridané
    mnozstvo_ks: number;
    min_limit?: number;    // 🔥 Pridané
    poradie?: number;
    balenie_ks: number;
    umiestnenie?: string;
    regal_id?: number;
    v_inventure?: boolean;
    jednotka?: string;
    sklad_id?: number;
    stredisko?: string;    // 🔥 Pridané
    spocitane_mnozstvo?: number;
    regal_nazov?: string;
    sklad_nazov?: string;
    vlastne_id?: string;
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
            // 🔥 1. Priorita: Zoraď podľa Vášho čísla
            .order('poradie', { ascending: true })
            // 2. Priorita: Ak majú rovnaké číslo, zoraď podľa abecedy
            .order('nazov', { ascending: true });

        if (error) throw error;
        return data as Sklad[];
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
          interne_id,
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
            interne_id: item.produkt?.interne_id,
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
          id, nazov, ean, Interne_id, balenie_ks, jednotka, kategorie(nazov)
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
            interne_id: item.produkt?.Interne_id,
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



        data.forEach((prod: any) => {
            vysledok.push({
                id: 0,
                produkt_id: prod.id,
                interne_id: prod.Interne_id,
                nazov: prod.nazov,
                ean: prod.ean,
                jednotka: prod.jednotka,
                balenie_ks: prod.balenie_ks,
                mnozstvo_ks: 0,
                regal_id: undefined,
                kategoria: prod.kategorie?.nazov,
                umiestnenie: '📦 Katalóg'
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
        const { data: otvorena, error: otvorenaError } = await this.supabase
            .from('inventury')
            .select('id')
            .eq('stav', 'otvorena')
            .maybeSingle();

        if (otvorenaError) {
            throw new Error('Chyba pri kontrole otvorených inventúr: ' + otvorenaError.message);
        }

        if (otvorena) {
            throw new Error('Nemôžete vytvoriť novú inventúru, pretože iná inventúra je už otvorená.');
        }

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


        const { data: inventury, error } = await this.supabase
            .from('inventury')
            .select('*')
            .order('datum_vytvorenia', { ascending: false });

        if (error) throw error;

        const zoznam: Inventura[] = [];


        for (const inv of inventury) {

            let pocetChyb = 0;


            if (!inv.datum_uzavretia) {



                const chybnePolozky = await this.getPolozkyBezId(inv.id);

                pocetChyb = chybnePolozky.length;
            }

            zoznam.push({
                ...inv,
                pocet_neznamych: pocetChyb
            });
        }

        return zoznam;
    }
    // async zapisatDoInventury(inventuraId: number, produktId: number, regalId: number, mnozstvo: number, balenie: number) {
    //     const user = await this.getCurrentUserDetails();

    //     // 1. KROK: Zapíšeme množstvo do inventúry (tu balenie_ks neuvádzame, lebo tam nie je)
    //     const { error: invError } = await this.supabase
    //         .from('inventura_polozky')
    //         .upsert({
    //             inventura_id: inventuraId,
    //             produkt_id: produktId,
    //             regal_id: regalId,
    //             mnozstvo: mnozstvo,
    //             pouzivatel_id: user.id,
    //             pouzivatel_meno: user.email,
    //             created_at: new Date().toISOString()
    //         }, { onConflict: 'inventura_id, produkt_id, regal_id' });

    //     if (invError) throw invError;

    //     // 2. KROK: Aktualizujeme balenie priamo v tabuľke PRODUKTY
    //     const { data: updatedProduct, error: prodError } = await this.supabase
    //         .from('produkty')
    //         .update({ balenie_ks: balenie })
    //         .eq('id', produktId)
    //         .select();

    //     if (prodError) throw prodError;

    //     if (!updatedProduct || updatedProduct.length === 0) {
    //         throw new Error('Balenie produktu sa nepodarilo aktualizovať. Skontrolujte oprávnenia (RLS).');
    //     }

    //     return true;
    // }

    async zapisatDoInventury(inventuraId: number, produktId: number, regalId: number, mnozstvo: number, balenie: number) {
        const user = await this.getCurrentUserDetails();

        // 1. KROK: RPC volanie pre bezpečný zápis do inventúry
        const { error: invError } = await this.supabase.rpc('zapisat_do_inventury_bezpecne', {
            p_inventura_id: inventuraId,
            p_produkt_id: produktId,
            p_regal_id: regalId,
            p_mnozstvo: mnozstvo
        });

        if (invError) throw invError;

        // Tu zostáva tvoja pôvodná logika pre aktualizáciu balenia v katalógu
        const { error: prodError } = await this.supabase
            .from('produkty')
            .update({ balenie_ks: balenie })
            .eq('id', produktId);

        if (prodError) throw prodError;

        return true;
    }
    async getPolozkyVInventure(inventuraId: number, od: number, do_poctu: number): Promise<SkladovaZasobaView[]> {
        const { data, error } = await this.supabase
            .from('inventura_polozky')
            .select(`
            id, mnozstvo, created_at, produkt_id, regal_id,
            regaly:regal_id ( nazov, sklad_id, sklady ( nazov ) ),
            produkty:produkt_id ( nazov, balenie_ks, ean, jednotka, Interne_id, vlastne_id, kategorie ( nazov ) )
        `)
            .eq('inventura_id', inventuraId)
            .order('created_at', { ascending: false })
            .range(od, do_poctu);

        if (error) throw error;

        return (data as any[]).map(d => {
            const regalObj = d.regaly;
            const produktObj = d.produkty;
            const skladData = regalObj?.sklady;
            const nazovSkladu = (Array.isArray(skladData) ? skladData[0]?.nazov : skladData?.nazov) || 'Sklad';
            const nazovKategorie = produktObj?.kategorie?.nazov || 'Bez kategórie';

            return {
                id: d.id,
                produkt_id: d.produkt_id,
                /* 👇 PRIDANÉ MAPOVANIE 👇 */
                interne_id: produktObj?.Interne_id,
                vlastne_id: produktObj?.vlastne_id,
                regal_id: d.regal_id,
                sklad_id: regalObj?.sklad_id,
                mnozstvo_ks: d.mnozstvo,
                spocitane_mnozstvo: d.mnozstvo,
                nazov: produktObj?.nazov || 'Neznámy',
                ean: produktObj?.ean,
                balenie_ks: produktObj?.balenie_ks || 1,
                jednotka: produktObj?.jednotka || 'ks',
                kategoria: nazovKategorie,
                v_inventure: true,
                umiestnenie: `${nazovSkladu} - ${regalObj?.nazov || 'Regál'}`
            };
        });
    }
    async uzavrietInventuru(inventuraId: number) {
        const { data, error } = await this.supabase.rpc('uzavriet_inventuru_komplet', {
            p_inventura_id: inventuraId
        });

        if (error) throw error;

        // V SQL vraciame text 'OK: ...' alebo 'CHYBA: ...'
        if (data && typeof data === 'string' && data.startsWith('CHYBA')) {
            throw new Error(data);
        }

        return data;
    }

    async znovuOtvoritInventuru(inventuraId: number) {
        // 1. Check if any other inventory is open
        const { data: otvorena, error: otvorenaError } = await this.supabase
            .from('inventury')
            .select('id')
            .eq('stav', 'otvorena')
            .neq('id', inventuraId) // check for other inventories
            .maybeSingle();

        if (otvorenaError) {
            throw new Error('Chyba pri kontrole otvorených inventúr: ' + otvorenaError.message);
        }

        if (otvorena) {
            throw new Error('Nemôžete otvoriť túto inventúru, pretože iná inventúra je už otvorená.');
        }

        // 2. Re-open the selected inventory
        const { error } = await this.supabase
            .from('inventury')
            .update({ stav: 'otvorena', datum_uzavretia: null })
            .eq('id', inventuraId);

        if (error) {
            throw error;
        }
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
          Interne_id,
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
            'Interné ID': item.produkt?.Interne_id || '',
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





    async getKategorie(): Promise<any[]> {
        const { data, error } = await this.supabase
            .from('kategorie')
            .select('*')
            .order('poradie', { ascending: true })
            .order('nazov', { ascending: true });

        if (error) throw error;
        return data;
    }


    async aktualizovatPoradieKategorii(kategorie: { id: number, poradie: number }[]) {
        const updates = kategorie.map(k =>
            this.supabase.from('kategorie').update({ poradie: k.poradie }).eq('id', k.id)
        );


        await Promise.all(updates);
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
        const { data: updatedData, error } = await this.supabase
            .from('produkty')
            .update(data)
            .eq('id', id)
            .select();

        if (error) throw error;

        if (!updatedData || updatedData.length === 0) {
            throw new Error('Produkt sa nepodarilo aktualizovať. Skontrolujte oprávnenia (RLS).');
        }
    }





    async ziskatLokacieProduktu(produktId: number) {
        const { data, error } = await this.supabase
            .from('skladove_zasoby')
            .select(`
        id,
        mnozstvo_ks,
        regal_id,
        regaly (
          id,
          nazov,
          sklad_id,
          sklady (nazov)
        )
      `)
            .eq('produkt_id', produktId);

        if (error) {
            console.error('Chyba pri hľadaní lokácií:', error);
            return [];
        }
        return data;
    }
    async vytvoritProduktSLocation(novyProdukt: any, regalId: number | null) {
        console.log('🛠️ Vytváram produkt...', novyProdukt, 'na regál:', regalId);


        const { data: produkt, error: errProd } = await this.supabase
            .from('produkty')
            .insert(novyProdukt)
            .select()
            .single();

        if (errProd) {
            console.error('❌ Chyba pri tvorbe produktu:', errProd);
            throw errProd;
        }

        console.log('✅ Produkt vytvorený, ID:', produkt.id);


        if (regalId && produkt) {
            console.log('🛠️ Vytváram záznam v skladove_zasoby...');

            const { error: errStock } = await this.supabase
                .from('skladove_zasoby')
                .insert({
                    produkt_id: produkt.id,
                    regal_id: regalId,
                    mnozstvo_ks: 0
                });

            if (errStock) {
                console.error('❌ CRITICAL: Chyba pri vytváraní zásoby:', errStock);


            } else {
                console.log('✅ Zásoba (0ks) úspešne vytvorená.');
            }
        } else {
            console.warn('⚠️ Pozor: Nevytváram zásobu, lebo chýba regalId:', regalId);
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



    async presunutZasobu(zasobaId: number, novyRegalId: number) {


        const { data: existujuca } = await this.supabase
            .from('skladove_zasoby')
            .select('id')
            .eq('regal_id', novyRegalId)




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

    async sparovatProdukt(polozkaId: number, produktId: number) {
        const { error } = await this.supabase
            .from('inventura_polozky')
            .update({ produkt_id: produktId })
            .eq('id', polozkaId);

        if (error) throw error;
    }


    async getPolozkyBezId(inventuraId: number) {


        const { data, error } = await this.supabase
            .from('inventura_polozky')
            .select(`
            id,
            mnozstvo,
            regal:regaly(nazov, sklad:sklady(nazov)),
            produkt:produkty!inner(id, nazov, vlastne_id, jednotka)
          `)
            .eq('inventura_id', inventuraId);

        if (error) throw error;


        const filtrovaneData = data.filter((item: any) =>
            !item.produkt ||
            !item.produkt.vlastne_id ||
            String(item.produkt.vlastne_id).trim() === ''
        );


        filtrovaneData.sort((a: any, b: any) => {
            const skladA = (a.regal?.sklad?.nazov || '').toLowerCase();
            const skladB = (b.regal?.sklad?.nazov || '').toLowerCase();
            if (skladA !== skladB) return skladA.localeCompare(skladB);

            const regalA = (a.regal?.nazov || '').toLowerCase();
            const regalB = (b.regal?.nazov || '').toLowerCase();
            const regalDiff = regalA.localeCompare(regalB, undefined, { numeric: true });
            if (regalDiff !== 0) return regalDiff;

            const prodA = (a.produkt?.nazov || '').toLowerCase();
            const prodB = (b.produkt?.nazov || '').toLowerCase();
            return prodA.localeCompare(prodB);
        });

        return filtrovaneData;
    }

    async aktualizovatProductId(produktId: number, noveId: string) {
        const { error } = await this.supabase
            .from('produkty')
            .update({ vlastne_id: noveId })
            .eq('id', produktId);

        if (error) throw error;
    }



    async getStatistikyKatalogu() {

        const { count: celkovo, error: err1 } = await this.supabase
            .from('produkty')
            .select('*', { count: 'exact', head: true });

        if (err1) throw err1;


        const { count: bezId, error: err2 } = await this.supabase
            .from('produkty')
            .select('*', { count: 'exact', head: true })
            .or('vlastne_id.is.null,vlastne_id.eq.""');

        if (err2) throw err2;

        return {
            celkovo: celkovo || 0,
            bezId: bezId || 0
        };
    }


    // async getZasobyFiltrovaneServer(
    //     skladId: number | null,
    //     regalId: number | null,
    //     kategoria: string | null,
    //     search: string,
    //     limit: number = 50,
    //     offset: number = 0
    // ) {

    //     let query = this.supabase
    //         .from('skladova_zasoba_view')
    //         .select('*');

    //     if (skladId) {
    //         query = query.eq('sklad_id', skladId);
    //     }
    //     if (regalId) {
    //         query = query.eq('regal_id', regalId);
    //     }
    //     if (kategoria && kategoria !== 'vsetky') {
    //         query = query.eq('kategoria', kategoria);
    //     }

    //     if (search && search !== '') {
    //         const cleanedSearch = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
    //         const ilikePattern = `%${cleanedSearch}%`;
    //         query = query.or(
    //             `nazov.ilike.${ilikePattern},` +
    //             `ean.ilike.${ilikePattern},` +
    //             `vlastne_id.ilike.${ilikePattern},` +
    //             `interne_id::text.ilike.${ilikePattern},` +
    //             `id::text.ilike.${ilikePattern},` +
    //             `produkt_id::text.ilike.${ilikePattern}`
    //         );
    //     }

    //     const rangeEnd = offset + limit - 1;

    //     query = query
    //         .order('poradie', { ascending: true })
    //         .order('nazov', { ascending: true })
    //         .range(offset, rangeEnd < offset ? offset : rangeEnd);

    //     const { data, error } = await query;

    //     if (error) {
    //         console.error('Chyba pri getZasobyFiltrovaneServer:', error);
    //         throw error;
    //     }

    //     return (data as SkladovaZasobaView[]) || [];
    // }

    async getZasobyFiltrovaneServer(
        skladId: number | null,
        regalId: number | null,
        kategoria: string | null,
        search: string,
        limit: number = 50,
        offset: number = 0
    ) {
        // Pripravíme parametre presne podľa tvojej SQL (RPC) funkcie
        const params: any = {
            p_sklad_id: skladId || null,
            p_regal_id: regalId || null,
            p_stredisko_id: null, // Stredisko tu aktuálne nevyužívame
            p_limit: limit,
            p_offset: offset
        };

        // Kategória (ak je "vsetky", pošleme do SQL null)
        if (kategoria && kategoria !== 'vsetky') {
            params.p_kategoria = kategoria;
        } else {
            params.p_kategoria = null;
        }

        // Vyhľadávanie
        if (search && search.trim() !== '') {
            // Nemusíme robiť replace znakov, o to sa postará ILIKE a unaccent priamo v SQL
            params.p_search = search.trim();
        } else {
            params.p_search = null;
        }

        // Volanie uloženej procedúry (RPC) v Supabase
        const { data, error } = await this.supabase.rpc('get_zasoby_filtrovane', params);

        if (error) {
            console.error('❌ Chyba pri getZasobyFiltrovaneServer (RPC):', error);
            throw error;
        }

        // Databáza nám vráti už správne prefiltrované a zoradené dáta
        return (data as SkladovaZasobaView[]) || [];
    }


    async getKategoriePreFilter(regalId: number | null): Promise<string[]> {
        if (regalId) {

            const { data, error } = await this.supabase.rpc('get_kategorie_pre_regal', {
                p_regal_id: regalId
            });
            if (error) {
                console.error('Chyba:', error);
                return [];
            }
            return data.map((d: any) => d.nazov);
        } else {

            const { data, error } = await this.supabase
                .from('kategorie')
                .select('nazov')
                .order('nazov');

            if (error) return [];
            return data.map((d: any) => d.nazov);
        }
    }


    async getVsetkyKategorie() {
        const { data, error } = await this.supabase.from('kategorie').select('nazov').order('nazov');
        if (error) return [];
        return data;
    }




    async getZasobaNaRegali(produktId: number, regalId: number) {
        const { data, error } = await this.supabase
            .from('skladove_zasoby')
            .select('id, mnozstvo_ks')
            .eq('produkt_id', produktId)
            .eq('regal_id', regalId)
            .maybeSingle();

        if (error) {
            console.error('Chyba pri kontrole zásoby:', error);
            return null;
        }
        return data;
    }




    async getZasobaVSklade(produktId: number, skladId: number) {
        const { data, error } = await this.supabase
            .from('skladove_zasoby')
            .select(`
        id, 
        mnozstvo_ks, 
        regaly!inner (
          id, 
          nazov, 
          sklad_id
        )
      `)
            .eq('produkt_id', produktId)
            .eq('regaly.sklad_id', skladId)
            .maybeSingle();

        if (error) {
            console.error('Chyba pri kontrole skladu:', error);
            return null;
        }
        return data;
    }


    async getRegaly(skladId: number) {
        const { data, error } = await this.supabase
            .from('regaly')
            .select('*')
            .eq('sklad_id', skladId)
            // 🔥 1. Priorita: Zoraď podľa Vášho čísla
            .order('poradie', { ascending: true })
            // 2. Priorita: Podľa abecedy
            .order('nazov', { ascending: true });

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
    private ulozenyStavRegal: any = {
        skladId: null,
        regalId: null,
        search: '',
        kategoria: 'vsetky'
    };
    // Vráti len produkty, ktoré nemajú vyplnené vlastné ID
    async getProduktyBezIdZoznam() {
        const { data, error } = await this.supabase
            .from('produkty')
            .select('*')
            // Filtrujeme produkty, kde je ID buď NULL alebo prázdny reťazec
            .or('vlastne_id.is.null,vlastne_id.eq.""')
            .order('nazov');

        if (error) {
            console.error('Chyba pri sťahovaní produktov bez ID:', error);
            throw error;
        }
        return data || [];
    }

    // Vráti úplne všetky produkty
    async getVsetkyProduktyZoznam() {
        const { data, error } = await this.supabase
            .from('produkty')
            .select('*')
            .order('nazov');

        if (error) throw error;
        return data;
    }
    // V súbore: supabase.service.ts

    async aktualizovatVlastneId(produktId: number, noveId: string) {
        const { error } = await this.supabase
            .from('produkty')
            .update({ vlastne_id: noveId })
            .eq('id', produktId);

        if (error) throw error;
    }

    // NOVÁ FUNKCIA: Načítanie kompletného prehľadu inventúry (SQL: get_inventura_prehlad)
    async getInventuraPrehlad(inventuraId: number) {
        const { data, error } = await this.supabase
            .rpc('get_inventura_prehlad', { p_inventura_id: inventuraId });

        if (error) {
            console.error('Chyba pri volaní RPC get_inventura_prehlad:', error);
            throw error;
        }

        // Vráti pole objektov s vlastnosťami: 
        // produkt_id, nazov, ean, regal_nazov, system_mnozstvo, spocitane_mnozstvo, rozdiel, je_hotove
        return data || [];
    }

    // V SupabaseService
    async getCurrentUserDetails() {
        const user = await this.supabase.auth.getUser();
        return {
            id: user.data.user?.id,
            email: user.data.user?.email
            // Ak máš meno v user_metadata, použi: user.data.user?.user_metadata['full_name']
        };
    }
    async ulozPoradieZasob(items: ZmenaPoradia[]) {
        const { data, error } = await this.supabase
            .rpc('update_skladove_zasoby_poradie', { payload: items });

        return { data, error };
    }

    // async presunutPolozku(zasobaId: number, produktId: number, novyRegalId: number, mnozstvoNaPresun: number) {
    //     const { data: existujuca, error: checkError } = await this.supabase
    //         .from('skladove_zasoby')
    //         .select('id, mnozstvo_ks')
    //         .eq('produkt_id', produktId)
    //         .eq('regal_id', novyRegalId)
    //         .maybeSingle();

    //     if (checkError) throw checkError;

    //     if (existujuca) {
    //         const noveMnozstvo = Number(existujuca.mnozstvo_ks) + Number(mnozstvoNaPresun);

    //         await this.supabase
    //             .from('skladove_zasoby')
    //             .update({ mnozstvo_ks: noveMnozstvo, updated_at: new Date().toISOString() })
    //             .eq('id', existujuca.id);

    //         await this.supabase
    //             .from('skladove_zasoby')
    //             .delete()
    //             .eq('id', zasobaId);
    //     } else {
    //         const { error: updateError } = await this.supabase
    //             .from('skladove_zasoby')
    //             .update({
    //                 regal_id: novyRegalId,
    //                 updated_at: new Date().toISOString()
    //             })
    //             .eq('id', zasobaId);

    //         if (updateError) throw updateError;
    //     }
    // }

    // V SupabaseService nahraď pôvodnú funkciu touto verziou


    async presunutPolozku(zdrojovyRegalId: number, produktId: number, novyRegalId: number, mnozstvo: number) {
        // Voláme našu bezpečnú SQL funkciu
        const { data, error } = await this.supabase.rpc('presunut_polozku_bezpecne', {
            p_produkt_id: produktId,
            p_zdrojovy_regal_id: zdrojovyRegalId,
            p_cielovy_regal_id: novyRegalId,
            p_mnozstvo_na_presun: mnozstvo
        });

        if (error) {
            console.error('❌ Chyba pri presune:', error.message);
            throw error;
        }

        // Keďže sme funkciu nastavili, aby vracala TEXT (ten OK/CHYBA), môžeme ho skontrolovať
        if (data && data.startsWith('CHYBA')) {
            throw new Error(data);
        }

        return data; // Vráti "OK: Presun úspešne vykonaný."
    }
    async getPocetSpocitanychGlobal(): Promise<number> {
        // Pýtame sa priamo na počet všetkých riadkov v tabuľke inventura_polozky
        const { count, error } = await this.supabase
            .from('inventura_polozky')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('Chyba pri získavaní globálnych štatistík:', error);
            return 0;
        }
        return count || 0;
    }

    async getStatsPreInventuru(inventuraId: number): Promise<number> {
        const { count, error } = await this.supabase
            .from('inventura_polozky')
            .select('*', { count: 'exact', head: true })
            .eq('inventura_id', inventuraId);
        return count || 0;
    }
    async getZoznamInventurSoStats() {
        // Tento dotaz vytiahne inventúry a k nim počet riadkov z tabuľky inventura_polozky
        const { data, error } = await this.supabase
            .from('inventury')
            .select(`
      id, 
      nazov, 
      stav, 
      datum_vytvorenia,
      inventura_polozky(count)
    `)
            .order('datum_vytvorenia', { ascending: false });

        if (error) throw error;

        return data.map((inv: any) => ({
            id: inv.id,
            nazov: inv.nazov,
            stav: inv.stav,
            datum: inv.datum_vytvorenia,
            pocet: inv.inventura_polozky[0]?.count || 0
        }));
    }

    async getCelySkladPreExport() {
        const { data, error } = await this.supabase
            .from('produkty')
            .select('*')
            .order('vlastne_id', { ascending: true });

        if (error) throw error;
        return data;
    }

    // NOVÁ FUNKCIA: Porovná importovaný Excel (z importy_temp) s reálnym stavom inventúry
    async porovnatImportSInventurou(inventuraId: number) {
        const { data, error } = await this.supabase.rpc('porovnat_import_s_inventurou', {
            p_inventura_id: inventuraId
        });

        if (error) {
            console.error('❌ Chyba pri porovnávaní inventúry:', error);
            throw error;
        }

        // Vráti pole s objektmi: { interne_id: string, nazov: string, stav: 'chyba_v_inventure' | 'navyse_v_inventure' }
        return data || [];
    }

    async nahratImportDoTemp(inventuraId: number, excelData: any[]) {
        // 1. Zmažeme starý import
        await this.supabase.from('importy_temp').delete().eq('inventura_id', inventuraId);

        // 2. Mapovanie a AGRESÍVNE čistenie dát z Excelu
        const insertData = excelData.map(row => {
            // a) Očistenie Vlastného ID (Odstráni všetky medzery, taby a non-breaking spaces)
            let rawVlastneId = String(row['ID'] || '').replace(/\s+/g, '');
            // Excel občas pridá .0 na koniec textových čísel (napr. 123 -> 123.0)
            if (rawVlastneId.endsWith('.0')) {
                rawVlastneId = rawVlastneId.slice(0, -2);
            }

            // b) Očistenie Interného ID (Ponechávame pre zobrazenie, ale nepoužíva sa na párovanie)
            let rawInterneId = String(row['CISLO'] || '').trim();
            if (rawInterneId.endsWith('.0')) {
                rawInterneId = rawInterneId.slice(0, -2);
            }

            // c) Očistenie Názvu
            let rawNazov = String(row['NAZOV'] || 'Neznámy produkt').trim();

            return {
                inventura_id: inventuraId,
                "Interne_id": rawInterneId,
                vlastne_id: rawVlastneId,
                nazov: rawNazov,
                mnozstvo: Number(row['PREDPOKLADANE MNOZSTVO'] || row['FYZICKE MNOZSTVO'] || row['Množstvo'] || 0)
            };
        }).filter(item => item.vlastne_id !== ''); // 🔥 FILTER: Vyžadujeme striktne vyplnené vlastne_id

        if (insertData.length === 0) {
            throw new Error('Nenašli sa žiadne platné dáta. Uistite sa, že Excel obsahuje hlavičku s názvom "ID" (vlastne_id).');
        }

        // 3. Hromadný zápis do temp tabuľky
        const { error } = await this.supabase.from('importy_temp').insert(insertData);

        if (error) {
            console.error('❌ Chyba pri zápise do staging tabuľky importy_temp:', error);
            throw error;
        }

        return true;
    }


    // NOVÁ FUNKCIA: Nájde produkty z Excelu, ktoré chýbajú v hlavnom katalógu
    async skontrolovatNeznameProdukty(inventuraId: number) {
        const { data, error } = await this.supabase.rpc('najst_nezname_produkty_z_importu', {
            p_inventura_id: inventuraId
        });

        if (error) {
            console.error('❌ Chyba pri hľadaní neznámych produktov:', error);
            throw error;
        }

        return data || [];
    }

    // NOVÁ FUNKCIA: Hromadný zápis nových produktov do katalógu
    async pridatNoveProduktyZImportu(payload: any[]) {
        const { error } = await this.supabase.rpc('pridat_nove_produkty_z_importu', {
            payload: payload
        });

        if (error) {
            console.error('❌ Chyba pri zápise nových produktov:', error);
            throw error;
        }
        return true;
    }

    // 🔥 NAČÍTANIE STREDÍSK
    async getStrediska(): Promise<any[]> {
        const { data, error } = await this.supabase
            .from('strediska')
            .select('id, nazov')
            .order('nazov', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    /// Pridaj do supabase.service.ts
    async spracovatPrijemSoSubstituciou(payload: {
        produkt_id: number,
        mnozstvo: number,
        regal_id: number | null,
        odpocitat_z_id: number | null,
        mnozstvo_na_odpocet: number
    }) {
        const { error } = await this.supabase.rpc('spracovat_prijem_so_substituciou', {
            p_novy_produkt_id: payload.produkt_id,
            p_mnozstvo_plus: payload.mnozstvo,
            p_regal_id: payload.regal_id || null, // Zabezpečí, že ak nie je regál, pošle sa čistý NULL
            p_odpocitat_produkt_id: payload.odpocitat_z_id || null,
            p_mnozstvo_minus: payload.mnozstvo_na_odpocet || 0
        });

        if (error) {
            console.error('❌ Chyba pri substitúcii skladu:', error);
            throw error;
        }
    }
    async opravitChybuNaSklade(payload: {
        inventura_id: number, // 🔥 PRIDANÉ
        produkt_id: number,
        mnozstvo_uprava: number,
        regal_id: number | null,
        odpocitat_z_id: number | null,
        mnozstvo_na_odpocet: number
    }) {
        const { error } = await this.supabase.rpc('opravit_chybu_v_skladovych_zasobach', {
            p_inventura_id: payload.inventura_id, // 🔥 PRIDANÉ
            p_produkt_id: payload.produkt_id,
            p_mnozstvo_uprava: payload.mnozstvo_uprava || 0,
            p_regal_id: payload.regal_id || null,
            p_odpocitat_produkt_id: payload.odpocitat_z_id || null,
            p_mnozstvo_minus: payload.mnozstvo_na_odpocet || 0
        });

        if (error) {
            console.error('❌ Chyba pri oprave skladu:', error);
            throw error;
        }
    }

    async getVsetkyRegaly() {
        const { data, error } = await this.supabase
            .from('regaly')
            .select(`
                id, 
                nazov, 
                sklady (nazov)
            `)
            .order('nazov', { ascending: true });

        if (error) throw error;

        // Naformátujeme to pre pekné zobrazenie v drope-downe
        return data.map((r: any) => ({
            id: r.id,
            nazov: `${r.sklady?.nazov || 'Neznámy sklad'} - ${r.nazov}`
        }));
    }
    // 🔥 Zistí, či už bol pre túto inventúru nahratý Excel
    async getPocetImportovTemp(inventuraId: number): Promise<number> {
        const { count, error } = await this.supabase
            .from('importy_temp')
            .select('*', { count: 'exact', head: true })
            .eq('inventura_id', inventuraId);

        if (error) {
            console.error('Chyba pri kontrole importu:', error);
            return 0;
        }
        return count || 0;
    }
}