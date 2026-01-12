const fs = require('fs');

// Cesta, kam sa má súbor vygenerovať
const targetPath = './src/environments/environment.prod.ts';

// Obsah súboru (vezme hodnoty z nastavení Netlify)
const envConfigFile = `export const environment = {
  production: true,
  supabaseUrl: '${process.env.SUPABASE_URL}',
  supabaseKey: '${process.env.SUPABASE_KEY}'
};
`;

// Zápis súboru
fs.writeFile(targetPath, envConfigFile, function (err) {
    if (err) {
        console.log(err);
    } else {
        console.log(`✅ Súbor environment.prod.ts bol úspešne vygenerovaný!`);
    }
});