import { Injectable } from '@angular/core';
import { addIcons } from 'ionicons';
import { createOutline, printOutline } from 'ionicons/icons';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fontRobotoRegular } from 'src/app/font';

@Injectable({
    providedIn: 'root'
})
export class ExportService {

    constructor() {
        addIcons({
            'create-outline': createOutline,
            'print-outline': printOutline
        });
    }

    /**
     * Pomocná funkcia: Pripraví a zoradí dáta
     */
    private pripravitData(data: any[]) {
        const sId = data.filter(item => item['Product ID'] && String(item['Product ID']).trim() !== '');
        const bezId = data.filter(item => !item['Product ID'] || String(item['Product ID']).trim() === '');

        // 1. Zoradenie s ID (podľa ID)
        sId.sort((a, b) => {
            const idA = String(a['Product ID']).toLowerCase();
            const idB = String(b['Product ID']).toLowerCase();
            return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
        });

        // 2. Zoradenie bez ID (podľa Lokácie: Sklad -> Regál -> Produkt)
        // Toto zabezpečí, že položky pôjdu za sebou tak, ako sú v regáloch
        bezId.sort((a, b) => {
            // A. Najprv podľa skladu
            const skladA = String(a['Sklad'] || '').toLowerCase();
            const skladB = String(b['Sklad'] || '').toLowerCase();
            if (skladA !== skladB) return skladA.localeCompare(skladB);

            // B. Potom podľa regálu (numericky, aby Regál 2 bol pred Regál 10)
            const regalA = String(a['Regál'] || '').toLowerCase();
            const regalB = String(b['Regál'] || '').toLowerCase();
            const regalDiff = regalA.localeCompare(regalB, undefined, { numeric: true });
            if (regalDiff !== 0) return regalDiff;

            // C. Nakoniec podľa názvu produktu
            return String(a['Produkt']).localeCompare(String(b['Produkt']));
        });

        return { sId, bezId };
    }

    // --- 1. EXCEL (KOMPLET - 2 Hárky) ---
    public generovatExcelKomplet(data: any[], nazovInventury: string) {
        const { sId, bezId } = this.pripravitData(data);
        const cleanNazov = nazovInventury.replace(/[^a-z0-9]/gi, '_').toLowerCase();

        const wb = XLSX.utils.book_new();

        if (sId.length > 0) {
            const ws1 = XLSX.utils.json_to_sheet(sId);
            XLSX.utils.book_append_sheet(wb, ws1, 'S Product ID');
        }
        if (bezId.length > 0) {
            const ws2 = XLSX.utils.json_to_sheet(bezId);
            XLSX.utils.book_append_sheet(wb, ws2, 'Bez ID');
        }

        XLSX.writeFile(wb, `Inventura_${cleanNazov}_KOMPLET.xlsx`);
    }

    // --- 2. EXCEL (LEN S ID) ---
    public generovatExcelSId(data: any[], nazovInventury: string) {
        const { sId } = this.pripravitData(data);
        if (sId.length === 0) return false;

        const cleanNazov = nazovInventury.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(sId);
        XLSX.utils.book_append_sheet(wb, ws, 'S Product ID');

        XLSX.writeFile(wb, `Inventura_${cleanNazov}_S_ID.xlsx`);
        return true;
    }

    // --- 3. EXCEL (LEN BEZ ID) ---
    public generovatExcelBezId(data: any[], nazovInventury: string) {
        const { bezId } = this.pripravitData(data);
        if (bezId.length === 0) return false;

        const cleanNazov = nazovInventury.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(bezId);
        XLSX.utils.book_append_sheet(wb, ws, 'Bez ID');

        XLSX.writeFile(wb, `Inventura_${cleanNazov}_BEZ_ID.xlsx`);
        return true;
    }

    // --- PDF FUNKCIE (Ostávajú rovnaké) ---
    public generovatPdfSId(data: any[], nazovInventury: string) {
        const { sId } = this.pripravitData(data);
        if (sId.length === 0) return false;

        sId.sort((a: any, b: any) => {
            const produktA = a['Produkt'] || '';
            const produktB = b['Produkt'] || '';
            return produktA.localeCompare(produktB);
        });

        const cleanNazov = nazovInventury.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        this.createPdfFile(sId, nazovInventury, 'Položky s ID', `Inventura_${cleanNazov}_S_ID.pdf`);
        return true;
    }

    public generovatPdfBezId(data: any[], nazovInventury: string) {
        const { bezId } = this.pripravitData(data);
        if (bezId.length === 0) return false;
        const cleanNazov = nazovInventury.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        this.createPdfFile(bezId, nazovInventury, 'Položky bez ID', `Inventura_${cleanNazov}_BEZ_ID.pdf`);
        return true;
    }

    private createPdfFile(data: any[], nazovInventury: string, podnadpis: string, nazovSuboru: string) {
        const doc = new jsPDF();
        doc.addFileToVFS('Roboto-Regular.ttf', fontRobotoRegular);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');

        doc.setFontSize(18);
        doc.text(`Inventúra: ${nazovInventury}`, 14, 20);
        doc.setFontSize(14);
        doc.text(podnadpis, 14, 30);

        const bodyData = data.map((item: any) => [
            item['Product ID'] || '-',
            item['Produkt'],
            String(item['Spočítané Množstvo']) + ' ' + (item['Jednotka'] || ''),
            `${item['Sklad']} / ${item['Regál']}`
        ]);

        autoTable(doc, {
            head: [['ID', 'Produkt', 'Množstvo', 'Lokácia']],
            body: bodyData,
            startY: 40,
            styles: { font: 'Roboto', fontStyle: 'normal' },
            headStyles: { fillColor: [41, 128, 185] }
        });

        doc.save(nazovSuboru);
    }

    public generovatPdfDvaStlpce(data: any[], nazovInventury: string) {
        const { sId, bezId } = this.pripravitData(data); // Toto už dáta zoradí

        if (sId.length === 0 && bezId.length === 0) return false;

        const cleanNazov = nazovInventury.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const doc = new jsPDF();

        // Registrácia fontu
        doc.addFileToVFS('Roboto-Regular.ttf', fontRobotoRegular);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');

        // 1. ČASŤ: POLOŽKY S ID
        if (sId.length > 0) {
            this.vygenerovatTabulku(doc, sId, `Inventúra: ${nazovInventury} (S ID Kódmi)`, true);
        }

        // 2. ČASŤ: POLOŽKY BEZ ID (Na novej strane)
        if (bezId.length > 0) {
            if (sId.length > 0) {
                doc.addPage(); // Pridá novú stranu, ak sme už tlačili IDčkové
            }
            this.vygenerovatTabulku(doc, bezId, `Inventúra: ${nazovInventury} (Bez ID)`, false);
        }

        doc.save(`Inventura_${cleanNazov}_2col.pdf`);
        return true;
    }

    // Pomocná metóda na vykreslenie tabuľky
    private vygenerovatTabulku(doc: jsPDF, dataList: any[], nadpis: string, maId: boolean) {
        // 1. Nadpis sekcie
        doc.setFontSize(16);
        doc.text(nadpis, 14, 15);
        doc.setFontSize(10);
        doc.text(`Dátum tlače: ${new Date().toLocaleDateString()}`, 14, 22);

        // 2. Transformácia dát na 2 bloky po 4 stĺpcoch (Por., ID, Názov, Mn.)
        const rows = [];
        for (let i = 0; i < dataList.length; i += 2) {
            const item1 = dataList[i];
            const item2 = dataList[i + 1];

            // Ľavá strana (Index je i + 1)
            const rowData = [
                (i + 1).toString(), // Poradie
                item1['Product ID'] || (maId ? '-' : ''),
                item1['Produkt'],
                `${item1['Spočítané Množstvo']} ${item1['Jednotka'] || ''}`
            ];

            // Pravá strana (Index je i + 2)
            if (item2) {
                rowData.push(
                    (i + 2).toString(), // Poradie
                    item2['Product ID'] || (maId ? '-' : ''),
                    item2['Produkt'],
                    `${item2['Spočítané Množstvo']} ${item2['Jednotka'] || ''}`
                );
            } else {
                // Ak chýba pravá položka, doplníme prázdne bunky (4 stĺpce)
                rowData.push('', '', '', '');
            }
            rows.push(rowData);
        }

        // 3. Definícia hlavičky (8 stĺpcov)
        // Používame 'as const' pre TypeScript
        const styleLeft = { halign: 'left' as const, fontStyle: 'bold' as const };
        const styleRight = { halign: 'right' as const, fontStyle: 'bold' as const };
        const styleCenter = { halign: 'center' as const, fontStyle: 'bold' as const };

        const hlava = [
            { content: 'Por.', styles: styleCenter },
            { content: 'ID', styles: styleLeft },
            { content: 'Názov produktu', styles: styleLeft },
            { content: 'Mn.', styles: styleRight },
            // Stredová čiara
            { content: 'Por.', styles: styleCenter },
            { content: 'ID', styles: styleLeft },
            { content: 'Názov produktu', styles: styleLeft },
            { content: 'Mn.', styles: styleRight },
        ];

        // 4. Generovanie tabuľky
        autoTable(doc, {
            head: [hlava],
            body: rows,
            startY: 25,
            theme: 'grid', // Mriežka pomôže zarovnaniu
            styles: {
                font: 'Roboto',
                fontSize: 8, // Trochu menšie písmo, aby sa zmestilo 8 stĺpcov
                cellPadding: 2,
                overflow: 'ellipsize',
                valign: 'middle',
                lineWidth: 0.1,
                lineColor: [200, 200, 200]
            },
            headStyles: {
                fillColor: maId ? [41, 128, 185] : [192, 57, 43], // Modrá / Červená
                textColor: 255,
                lineWidth: 0.1,
                lineColor: [50, 50, 50]
            },
            // Nastavenie šírok stĺpcov (spolu cca 180-190mm na A4)
            columnStyles: {
                // ĽAVÁ STRANA
                0: { cellWidth: 10, halign: 'center' }, // Por.
                1: { cellWidth: 22, fontStyle: 'bold' }, // ID
                2: { cellWidth: 'auto' }, // Názov (zvyšok)
                3: { cellWidth: 15, halign: 'right' }, // Mn.

                // PRAVÁ STRANA (Identické)
                4: { cellWidth: 10, halign: 'center' }, // Por.
                5: { cellWidth: 22, fontStyle: 'bold' }, // ID
                6: { cellWidth: 'auto' }, // Názov
                7: { cellWidth: 15, halign: 'right' }  // Mn.
            },



        });
    }

    // --- 4. ŠPECIÁLNA TLAČOVÁ ZOSTAVA (Podľa vzoru) ---
    public generovatTlacovuZostavu(data: any[], nazovInventury: string) {
        if (!data || data.length === 0) return false;

        const aoaData: any[][] = [];

        // Vloženie 4 čistých prázdnych riadkov (Riadky 1-4 v Exceli)
        aoaData.push([]);
        aoaData.push([]);
        aoaData.push([]);
        aoaData.push([]);

        // Presná hlavička (Riadok 5 v Exceli)
        aoaData.push([
            'ID', 'CISLO', 'NAZOV', 'MJ', 'EAN', 'CENA', 'PREDPOKLADANE MNOZSTVO', 'FYZICKE MNOZSTVO'
        ]);

        // --- AGREGÁCIA DAT (zlučovanie rovnakých ID) ---
        const zluceneData = data.reduce((akumulator: any[], aktualnaPolozka: any) => {
            const existujucaPolozka = akumulator.find(
                (item: any) => item['Product ID'] === aktualnaPolozka['Product ID']
            );

            const aktualneMnozstvo = Number(aktualnaPolozka['Spočítané Množstvo']) || 0;

            if (existujucaPolozka) {
                existujucaPolozka['Spočítané Množstvo'] += aktualneMnozstvo;
            } else {
                akumulator.push({
                    ...aktualnaPolozka,
                    'Spočítané Množstvo': aktualneMnozstvo
                });
            }

            return akumulator;
        }, []);

        // --- MAPOVANIE DO AOA ---
        zluceneData.forEach((item: any) => {

            // 1. Získame ID a ubezpečíme sa, že z neho nezostane string so zalomením (\n) z čítačky
            let cisteProductID = item['Product ID'];
            if (typeof cisteProductID === 'string') {
                cisteProductID = Number(cisteProductID.replace(/[\r\n]+/g, '').trim());
            } else {
                cisteProductID = Number(cisteProductID);
            }

            aoaData.push([
                cisteProductID || '',                // A (0) - ID (Istota, že je to čisté Number pre import)
                '',                                  // B (1) - CISLO
                '',               // C (2) - NAZOV (Presne ako v tvojom kóde)
                '',              // D (3) - MJ (Presne ako v tvojom kóde)
                '',                                  // E (4) - EAN
                '',                                  // F (5) - CENA
                '',                                  // G (6) - PREDPOKLADANE MNOZSTVO
                item['Spočítané Množstvo'] || 0      // H (7) - FYZICKE MNOZSTVO
            ]);
        });

        // Vytvorenie hárku
        const ws = XLSX.utils.aoa_to_sheet(aoaData);

        // --- FORMÁTOVANIE A ŠTÝLOVANIE BUNIEK ---
        if (ws['!ref']) {
            const range = XLSX.utils.decode_range(ws['!ref']);

            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                    const cell = ws[cellAddress];

                    if (!cell) continue;

                    // Inicializácia objektu štýlov, ak neexistuje
                    if (!cell.s) cell.s = {};

                    // 1. FORMÁT ČÍSEL (.z)
                    if (R < 5) {
                        // Riadky 1-5 (Indexy 0 až 4)
                        cell.z = 'General';
                    } else {
                        // Od riadku 6 (Index 5 a vyššie)
                        if (C >= 0 && C <= 4) {
                            cell.z = '0'; // A, B, C, D, E
                        } else if (C === 5) {
                            cell.z = '0.0000'; // F
                        } else if (C === 6 || C === 7) {
                            cell.z = '0.000'; // G, H
                        }
                    }

                    // 2. TUČNÉ PÍSMO (.s.font) - Iba riadok 5 (Index 4)
                    if (R === 4) {
                        if (!cell.s.font) cell.s.font = {};
                        cell.s.font.bold = true;
                    }

                    // 3. ZAROVNANIE (.s.alignment) - Od riadku 5 (Index 4) nadol
                    if (R >= 4) {
                        // Stĺpce A(0), B(1), F(5), G(6), H(7)
                        if (C === 0 || C === 1 || C === 5 || C === 6 || C === 7) {
                            if (!cell.s.alignment) cell.s.alignment = {};
                            cell.s.alignment.horizontal = 'center';
                            cell.s.alignment.vertical = 'center'; // Pridávam aj vertikálne centrovanie pre lepší vizuál
                        }
                    }
                }
            }
        }

        // Vytvorenie zošita a vloženie hárku (Iba raz)
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Zostava');

        // Vyčistenie názvu (Iba raz)
        const cleanNazov = nazovInventury.replace(/[^a-z0-9]/gi, '_').toLowerCase();

        // --- Browser-safe stiahnutie súboru bez Node.js (fs/stream) ---
        const excelBuffer: any = XLSX.write(wb, { bookType: 'xls', type: 'array' });
        const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.ms-excel' });

        const downloadLink = document.createElement('a');
        downloadLink.href = window.URL.createObjectURL(dataBlob);
        downloadLink.download = `Tlacova_zostava_${cleanNazov}.xls`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        window.URL.revokeObjectURL(downloadLink.href); // Uvoľnenie pamäte
        // -------------------------------------------------------------------------

        return true;
    }

    // --- 4. ŠPECIÁLNA TLAČOVÁ ZOSTAVA (Podľa vzoru) ---
    public generovatTlacovuZostavuSExportom(data: any[], nazovInventury: string) {
        if (!data || data.length === 0) return false;

        const aoaData: any[][] = [];

        // Vloženie 4 čistých prázdnych riadkov (Riadky 1-4 v Exceli)
        aoaData.push([], [], [], []);

        // Presná hlavička (Riadok 5 v Exceli)
        aoaData.push([
            'ID', 'CISLO', 'NAZOV', 'MJ', 'EAN', 'CENA', 'PREDPOKLADANE MNOZSTVO', 'FYZICKE MNOZSTVO'
        ]);

        // --- AGREGÁCIA DAT (zlučovanie rovnakých ID) ---
        // Aj keď to už zlučujeme v SupabaseService, ponechávam tvoju logiku pre istotu
        const zluceneData = data.reduce((akumulator: any[], aktualnaPolozka: any) => {
            const existujucaPolozka = akumulator.find(
                (item: any) => item['Product ID'] === aktualnaPolozka['Product ID']
            );

            const aktualneMnozstvo = Number(aktualnaPolozka['Spočítané Množstvo']) || 0;

            if (existujucaPolozka) {
                existujucaPolozka['Spočítané Množstvo'] += aktualneMnozstvo;
            } else {
                akumulator.push({
                    ...aktualnaPolozka,
                    'Spočítané Množstvo': aktualneMnozstvo
                });
            }
            return akumulator;
        }, []);

        // --- MAPOVANIE DO AOA ---
        zluceneData.forEach((item: any) => {

            // 1. Získame ID a ubezpečíme sa, že z neho nezostane string so zalomením (\n) z čítačky
            let cisteProductID = item['Product ID'];
            if (typeof cisteProductID === 'string') {
                cisteProductID = Number(cisteProductID.replace(/[\r\n]+/g, '').trim());
            } else {
                cisteProductID = Number(cisteProductID);
            }

            // Vkladáme presne namapované hodnoty z nového datasetu
            aoaData.push([
                cisteProductID || '',
                '',
                '',
                '',
                '',
                '',
                '',
                item['Spočítané Množstvo'] || 0
            ]);
        });

        // Vytvorenie hárku
        const ws = XLSX.utils.aoa_to_sheet(aoaData);

        // --- FORMÁTOVANIE A ŠTÝLOVANIE BUNIEK ---
        if (ws['!ref']) {
            const range = XLSX.utils.decode_range(ws['!ref']);

            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                    const cell = ws[cellAddress];

                    if (!cell) continue;

                    // Inicializácia objektu štýlov, ak neexistuje
                    if (!cell.s) cell.s = {};

                    // 1. FORMÁT ČÍSEL (.z)
                    if (R < 4) {
                        cell.z = 'General';
                    } else {
                        // Od hlavičky nižšie
                        if (C >= 0 && C <= 4) {
                            cell.z = '0'; // A, B, C, D, E (Celé čísla / Text)
                        } else if (C === 5) {
                            cell.z = '0.0000'; // F (Cena)
                        } else if (C === 6 || C === 7) {
                            cell.z = '0.000'; // G, H (Množstvá na 3 desatinné miesta)
                        }
                    }

                    // 2. TUČNÉ PÍSMO (.s.font) - Iba riadok 5 (Index 4)
                    if (R === 4) {
                        if (!cell.s.font) cell.s.font = {};
                        cell.s.font.bold = true;
                    }

                    // 3. ZAROVNANIE (.s.alignment)
                    if (R >= 4) {
                        if (C === 0 || C === 1 || C === 5 || C === 6 || C === 7) {
                            if (!cell.s.alignment) cell.s.alignment = {};
                            cell.s.alignment.horizontal = 'center';
                            cell.s.alignment.vertical = 'center';
                        }
                    }
                }
            }
        }

        // Vytvorenie zošita a vloženie hárku
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Zostava');

        // Vyčistenie názvu
        const cleanNazov = nazovInventury.replace(/[^a-z0-9]/gi, '_').toLowerCase();

        // --- Browser-safe stiahnutie súboru bez Node.js (fs/stream) ---
        const excelBuffer: any = XLSX.write(wb, { bookType: 'xls', type: 'array' });
        const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.ms-excel' });

        const downloadLink = document.createElement('a');
        downloadLink.href = window.URL.createObjectURL(dataBlob);
        downloadLink.download = `Tlacova_zostava_${cleanNazov}.xls`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        window.URL.revokeObjectURL(downloadLink.href);

        return true;
    }

    public generovatTlacovuZostavuSExportomSPolozkami(data: any[], nazovInventury: string) {
        if (!data || data.length === 0) return false;

        const aoaData: any[][] = [];

        // Vloženie 4 čistých prázdnych riadkov (Riadky 1-4 v Exceli)
        aoaData.push([], [], [], []);

        // Presná hlavička (Riadok 5 v Exceli)
        aoaData.push([
            'ID', 'CISLO', 'NAZOV', 'MJ', 'EAN', 'CENA', 'PREDPOKLADANE MNOZSTVO', 'FYZICKE MNOZSTVO'
        ]);

        // --- AGREGÁCIA DAT (zlučovanie rovnakých ID) ---
        // Aj keď to už zlučujeme v SupabaseService, ponechávam tvoju logiku pre istotu
        const zluceneData = data.reduce((akumulator: any[], aktualnaPolozka: any) => {
            const existujucaPolozka = akumulator.find(
                (item: any) => item['Product ID'] === aktualnaPolozka['Product ID']
            );

            const aktualneMnozstvo = Number(aktualnaPolozka['Spočítané Množstvo']) || 0;

            if (existujucaPolozka) {
                existujucaPolozka['Spočítané Množstvo'] += aktualneMnozstvo;
            } else {
                akumulator.push({
                    ...aktualnaPolozka,
                    'Spočítané Množstvo': aktualneMnozstvo
                });
            }
            return akumulator;
        }, []);

        // --- MAPOVANIE DO AOA ---
        zluceneData.forEach((item: any) => {

            // 1. Získame ID a ubezpečíme sa, že z neho nezostane string so zalomením (\n) z čítačky
            let cisteProductID = item['Product ID'];
            if (typeof cisteProductID === 'string') {
                cisteProductID = Number(cisteProductID.replace(/[\r\n]+/g, '').trim());
            } else {
                cisteProductID = Number(cisteProductID);
            }

            // Vkladáme presne namapované hodnoty z nového datasetu
            aoaData.push([
                cisteProductID || '',               // A (0) - ID 
                item['CISLO'] || '',                // B (1) - CISLO
                item['NAZOV'] || '',                // C (2) - NAZOV 
                item['MJ'] || '',                   // D (3) - MJ 
                item['EAN'] || '',                  // E (4) - EAN
                '',                                 // F (5) - CENA (štandardne prázdne)
                item['PREDPOKLADANE MNOZSTVO'] || 0,// G (6) - PREDPOKLADANE MNOZSTVO
                item['Spočítané Množstvo'] || 0     // H (7) - FYZICKE MNOZSTVO
            ]);
        });

        // Vytvorenie hárku
        const ws = XLSX.utils.aoa_to_sheet(aoaData);

        // --- FORMÁTOVANIE A ŠTÝLOVANIE BUNIEK ---
        if (ws['!ref']) {
            const range = XLSX.utils.decode_range(ws['!ref']);

            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                    const cell = ws[cellAddress];

                    if (!cell) continue;

                    // Inicializácia objektu štýlov, ak neexistuje
                    if (!cell.s) cell.s = {};

                    // 1. FORMÁT ČÍSEL (.z)
                    if (R < 4) {
                        cell.z = 'General';
                    } else {
                        // Od hlavičky nižšie
                        if (C >= 0 && C <= 4) {
                            cell.z = '0'; // A, B, C, D, E (Celé čísla / Text)
                        } else if (C === 5) {
                            cell.z = '0.0000'; // F (Cena)
                        } else if (C === 6 || C === 7) {
                            cell.z = '0.000'; // G, H (Množstvá na 3 desatinné miesta)
                        }
                    }

                    // 2. TUČNÉ PÍSMO (.s.font) - Iba riadok 5 (Index 4)
                    if (R === 4) {
                        if (!cell.s.font) cell.s.font = {};
                        cell.s.font.bold = true;
                    }

                    // 3. ZAROVNANIE (.s.alignment)
                    if (R >= 4) {
                        if (C === 0 || C === 1 || C === 5 || C === 6 || C === 7) {
                            if (!cell.s.alignment) cell.s.alignment = {};
                            cell.s.alignment.horizontal = 'center';
                            cell.s.alignment.vertical = 'center';
                        }
                    }
                }
            }
        }

        // Vytvorenie zošita a vloženie hárku
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Zostava');

        // Vyčistenie názvu
        const cleanNazov = nazovInventury.replace(/[^a-z0-9]/gi, '_').toLowerCase();

        // --- Browser-safe stiahnutie súboru bez Node.js (fs/stream) ---
        const excelBuffer: any = XLSX.write(wb, { bookType: 'xls', type: 'array' });
        const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.ms-excel' });

        const downloadLink = document.createElement('a');
        downloadLink.href = window.URL.createObjectURL(dataBlob);
        downloadLink.download = `Tlacova_zostava_${cleanNazov}.xls`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        window.URL.revokeObjectURL(downloadLink.href);

        return true;
    }

    // --- 5. ŠPECIÁLNA TLAČOVÁ ZOSTAVA spolu s názvami položiek (Podľa vzoru) ---
    public generovatTlacovuZostavuSNazvamiPoloziek(data: any[], nazovInventury: string) {
        if (!data || data.length === 0) return false;

        const aoaData: any[][] = [];

        // 1. Vloženie 4 čistých prázdnych riadkov (požiadavka pre šablónu importu)
        aoaData.push([], [], [], []);

        // 2. Presná hlavička (Riadok 5 v Exceli - Index 4)
        aoaData.push([
            'ID', 'CISLO', 'NAZOV', 'MJ', 'FYZICKE MNOZSTVO'
        ]);

        // --- AGREGÁCIA DAT (zlučovanie rovnakých ID) ---
        const zluceneData = data.reduce((akumulator: any[], aktualnaPolozka: any) => {
            const existujucaPolozka = akumulator.find(
                (item: any) => item['Product ID'] === aktualnaPolozka['Product ID']
            );

            const aktualneMnozstvo = Number(aktualnaPolozka['Spočítané Množstvo']) || 0;

            if (existujucaPolozka) {
                existujucaPolozka['Spočítané Množstvo'] += aktualneMnozstvo;
            } else {
                akumulator.push({
                    ...aktualnaPolozka,
                    'Spočítané Množstvo': aktualneMnozstvo
                });
            }
            return akumulator;
        }, []);

        // --- MAPOVANIE DO AOA (Zápis riadkov s dátami) ---
        zluceneData.forEach((item: any) => {
            // Spracovanie Product ID (vlastne_id)
            let cisteProductID = item['Product ID'];
            if (typeof cisteProductID === 'string') {
                cisteProductID = Number(cisteProductID.replace(/[\r\n]+/g, '').trim());
            } else {
                cisteProductID = Number(cisteProductID);
            }

            // Získanie Interne_id (CISLO) - berie kľúč z SQL View alebo tabuľky
            let interneID = item['Interne ID'] || item['interne_id'] || item['Interne_id'] || '';

            aoaData.push([
                cisteProductID || '',                // A (0) - ID (vlastne_id)
                interneID,                           // B (1) - CISLO (interne_id)
                item['Produkt'] || '',               // C (2) - NAZOV
                item['Jednotka'] || '',              // D (3) - MJ
                item['Spočítané Množstvo'] || 0      // E (4) - FYZICKE MNOZSTVO
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(aoaData);

        // --- FORMÁTOVANIE A ŠTÝLOVANIE BUNIEK ---
        if (ws['!ref']) {
            const range = XLSX.utils.decode_range(ws['!ref']);

            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                    const cell = ws[cellAddress];
                    if (!cell) continue;
                    if (!cell.s) cell.s = {};

                    // 1. FORMÁT ČÍSEL (.z)
                    if (R < 4) {
                        cell.z = 'General';
                    } else if (R === 4) {
                        // Hlavička (Bold)
                        cell.s.font = { bold: true };
                        cell.s.fill = { fgColor: { rgb: "ECECEC" } }; // Jemná šedá pre hlavičku
                    } else {
                        // Dáta (od riadku 6 vyššie)
                        if (C === 0 || C === 1) {
                            cell.z = '0'; // ID a CISLO ako celé čísla
                        } else if (C === 4) {
                            cell.z = '0.000'; // Množstvo na 3 desatinné miesta
                        }
                    }

                    // 2. ZAROVNANIE (Stred pre ID, CISLO a Množstvo)
                    if (R >= 4) {
                        if (C === 0 || C === 1 || C === 3 || C === 4) {
                            cell.s.alignment = { horizontal: 'center', vertical: 'center' };
                        }
                    }
                }
            }
        }

        // --- EXPORT SÚBORU ---
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Zostava');

        const cleanNazov = nazovInventury.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const excelBuffer: any = XLSX.write(wb, { bookType: 'xls', type: 'array' });
        const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.ms-excel' });

        const downloadLink = document.createElement('a');
        downloadLink.href = window.URL.createObjectURL(dataBlob);
        downloadLink.download = `BG_Zostava_Nazvy_${cleanNazov}.xls`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        window.URL.revokeObjectURL(downloadLink.href);

        return true;
    }

    // --- 5. EXCEL (KATALÓG PRODUKTOV) ---
    public generovatExcelCelehoSkladu(data: any[]) {
        if (!data || data.length === 0) return false;

        // Mapovanie priamo na stĺpce z tabuľky 'produkty'
        const formatovaneData = data.map(item => ({
            'ID': item.id || '',
            'Vlastné ID': item.vlastne_id || '-',
            'Systémové ID': item.Interne_id || '',
            'Názov produktu': item.nazov || '',
            'EAN': item.ean || '-',
            'M.J.': item.jednotka || '-',
            'Balenie (ks)': item.balenie_ks || '-',
            'Min. Limit': item.min_limit || 0,
            'Kategória ID': item.kategoria_id || '-',
            'Stredisko ID': item.stredisko_id || '-'
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(formatovaneData);

        // Formátovanie šírky stĺpcov pre lepšiu čitateľnosť (UX)
        ws['!cols'] = [
            { wch: 15 }, // Vlastné ID
            { wch: 15 }, // Systémové ID
            { wch: 45 }, // Názov
            { wch: 18 }, // EAN
            { wch: 8 },  // MJ
            { wch: 12 }, // Balenie
            { wch: 12 }, // Limit
            { wch: 12 }, // Kat ID
            { wch: 12 }  // Stredisko ID
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Produkty');

        const datum = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Katalog_Produktov_${datum}.xlsx`);

        return true;
    }


    // --- IMPORT Z EXCELU ---
    public parsovatExcelImport(file: File): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const reader: FileReader = new FileReader();

            reader.onload = (e: any) => {
                try {
                    const binaryString: string = e.target.result;
                    const workBook = XLSX.read(binaryString, { type: 'binary' });

                    const sheetName: string = workBook.SheetNames[0];
                    const workSheet = workBook.Sheets[sheetName];

                    // 🔥 Pridaný parameter { range: 3 }
                    // Preskočí riadky 1, 2 a 3. Riadok 4 sa stane hlavičkou (kľúčmi JSON objektu)
                    const jsonData = XLSX.utils.sheet_to_json(workSheet, { range: 4 });
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = (error) => reject(error);
            reader.readAsBinaryString(file);
        });
    }
}