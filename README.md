# Sanski Most 3D

Interaktivni atlas izrađen u Three.js-u, TypeScriptu i Viteu. Gradska geometrija pokriva kvadrat od 3 × 3 km oko 44,7667° N i 16,6670° E. Kamera počinje iznad Sane s pogledom na centar grada. Aplikacija učitava podatke, modele, fontove i teksture s vlastitog servera.

## Pokretanje i objava

Potreban je Node.js 22.12 ili noviji. Iz korijena projekta pokreni:

```sh
npm ci
npm run dev -- --port 5174
```

Za produkciju pokreni `npm run build`. Na statički hosting prenesi **sadržaj direktorija dist** u korijen domene. Sačuvaj direktorije assets, art, data i licenses. Za ugradnju pod drugom putanjom koristi Viteovu opciju `--base /ime-putanje/` pri izgradnji. Potreban je preglednik s WebGL 2. Podaci se isporučuju preko HTTP-a ili HTTPS-a.

## Geografski izvori

- Stvarni tlocrti, ceste, obale, otoci i imenovane lokacije potiču iz OpenStreetMapa. Priloženi izvoz dopunjen je na sjevernom i južnom rubu. Lokalni izvorni snimci i metodologija su u [data/osm](data/osm/README.md). Bazu možeš ponovo izgraditi naredbom `python scripts/import_osm.py`. © OpenStreetMap contributors, ODbL 1.0.
- Okolni reljef pokriva 10,8 × 10,8 km. Izvor je Copernicus GLO-30, uzorkovan na 60 m. [Potpuna atribucija](public/data/terrain-license.txt).
- Tekstura tla je georeferencirani izrez snimka Sentinel-2B od 14. augusta 2026. Rezolucija je 10 m. Klasifikacija označava 184 od 1.166.400 uzoraka kao ciruse. Podloga je pomiješana s kartiranim površinama. Contains modified Copernicus Sentinel data 2026. [Porijeklo i granice snimka](public/data/ground.json).
- Za 38 zgrada visina je izvedena iz broja etaža. Ostale generičke visine, fasade i krovovi su procjene. Posebni modeli džamije i stadiona generiraju se u Three.js-u prema stvarnim konturama. [Izvori modela](public/data/landmarks-sources.txt).
- Vodena površina je izravnata za refleksije. Automobili simuliraju promet duž kartiranih segmenata. Dopunska stabla, trotoari, detalji mostova i svjetiljke predstavljaju ilustrativnu rekonstrukciju.

## Provjera

Uz lokalno pokrenut server na portu 5174 i instaliran Chrome pokreni `node scripts/verify-browser.mjs`. Adresa drugog lokalnog servera može se zadati varijablom `MAP_TEST_URL`. Skripta provjerava desktop i simulirani dodirni prikaz, odabir objekta, pretragu, sačuvane lokacije, slojeve, osvjetljenje, kameru, obilazak i izvore. Prijavljuje greške konzole i neuspjele ili vanjske zahtjeve. Snimke sprema u [screenshots](screenshots).
