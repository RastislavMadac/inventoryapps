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

        // Zoradenie s ID (0-9, A-Z)
        sId.sort((a, b) => {
            const idA = String(a['Product ID']).toLowerCase();
            const idB = String(b['Product ID']).toLowerCase();
            return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
        });

        // Zoradenie bez ID (podľa názvu)
        bezId.sort((a, b) => String(a['Produkt']).localeCompare(String(b['Produkt'])));

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
}