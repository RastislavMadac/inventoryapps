import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fontRobotoRegular } from 'src/app/font';

@Injectable({
    providedIn: 'root'
})
export class ExportService {

    constructor() { }

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
}

