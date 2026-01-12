const fs = require('fs');

// Cesta k priečinku a súboru
const dir = './src/environments';
const targetPath = './src/environments/environment.prod.ts';

// 1. Najprv skontroluj, či priečinok existuje. Ak nie, VYTVOR HO.
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Priečinok ${dir} bol vytvorený.`);
}

// Obsah súboru (zoberie kľúče z Vercel nastavení)
const envConfigFile = `export const environment = {
  production: true,
  supabaseUrl: '${process.env.SUPABASE_URL}',
  supabaseKey: '${process.env.SUPABASE_KEY}'
};
`;

// 2. Zapíš súbor
fs.writeFile(targetPath, envConfigFile, function (err) {
    if (err) {
        console.error('❌ Chyba pri generovaní súboru:', err);
        process.exit(1); // Zastav build, ak sa to nepodarí
    } else {
        console.log(`✅ Súbor environment.prod.ts bol úspešne vygenerovaný!`);
    }
});