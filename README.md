# InventorysApp

## O projekte
InventorysApp (verzia 0.5.9) je komplexná hybridná aplikácia zameraná na správu skladových zásob, inventúr a kategorizáciu produktov[cite: 1, 2].

## Technologický Stack (Front-end)
* Aplikácia je postavená na modernom frameworku Angular vo verzii 20.0.0[cite: 1].
* Komponenty používateľského rozhrania (UI) zabezpečuje knižnica Ionic vo verzii 8.0.0[cite: 1].
* Natívny beh na mobilných zariadeniach (Android) umožňuje Capacitor vo verzii 8.0.0[cite: 1].
* Mobilná aplikácia využíva hardvérové funkcie zariadenia, ako sú haptická odozva, zdieľanie, práca so súborovým systémom a rozpoznávanie reči cez `@capacitor-community/speech-recognition`[cite: 1].
* Pre lokálne ukladanie dát na mobilných zariadeniach je integrovaný modul `@capacitor-community/sqlite`[cite: 1].
* Generovanie výstupných zostáv je realizované prostredníctvom knižníc `jspdf` pre PDF dokumenty a `xlsx` pre spracovanie Excel súborov[cite: 1].
* Pripojenie k backendu a real-time databáze spravuje klient `@supabase/supabase-js`[cite: 1].

## Architektúra Databázy (Back-end)
* Systém využíva relačnú databázu, ktorá obsahuje primárne tabuľky pre entitný model: `sklady`, `regaly`, `produkty`, `kategorie`, `strediska`, `skladove_zasoby` a `inventury`[cite: 2].
* Dáta naprieč tabuľkami združuje komplexný pohľad (View) `skladova_zasoba_view`, ktorý zjednocuje informácie o produkte, jeho umiestnení (sklad, regál) a aktuálnom množstve[cite: 2].
* Databáza implementuje rozšírenie `pg_trgm` a vlastné funkcie `unaccent` pre optimalizované fulltextové vyhľadávanie odolné voči diakritike[cite: 2].
* Rola používateľa sa udržiava v tabuľke `profiles`, ktorá sa automaticky plní pomocou triggeru a funkcie `handle_new_user` po vytvorení používateľa[cite: 2].

### Kľúčové procesy a PL/pgSQL funkcie
* **Filtrovanie a vyhľadávanie:** Funkcia `get_zasoby_filtrovane` zabezpečuje stránkované vyhľadávanie položiek podľa skladu, regálu, kategórie alebo strediska s využitím indexovania a `unaccent` mapovania[cite: 2].
* **Presuny na sklade:** Bezpečnú manipuláciu a presun množstva produktu medzi jednotlivými regálmi rieši transakčná funkcia `presunut_polozku_bezpecne`[cite: 2].
* **Spracovanie inventúry:** 
  * Naskenované položky z aplikácie sa zapisujú cez funkciu `zapisat_do_inventury_bezpecne`[cite: 2].
  * Kompletné uzavretie inventúry (prepísanie starých stavov zásob na nové) a archiváciu rozdielov do `zaznamy_inventury` zabezpečujú procedúry `uzavriet_inventuru` a `uzavriet_inventuru_komplet`[cite: 2].
* **Import dát:** Dočasné importy z Excelu (napríklad pri offline inventúrach) sa ukladajú do `importy_temp`[cite: 2]. Tieto importy sa následne porovnávajú s reálnym stavom cez agregačné funkcie `porovnat_import_s_inventurou` a `najst_nezname_produkty_z_importu`[cite: 2].
