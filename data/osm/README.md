# Geografski podaci Sanskog Mosta

Podaci © OpenStreetMap contributors. Baza i njen izvedeni skup `public/data/city.json` dostupni su pod licencom [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Više o izvorima i atribuciji dostupno je na [OpenStreetMap stranici o autorskim pravima](https://www.openstreetmap.org/copyright).

## Lokalni izvori

| Datoteka | Obuhvat (zapad, jug, istok, sjever) | Porijeklo |
| --- | --- | --- |
| `central.osm.gz` | 16.64287, 44.75408, 16.69106, 44.77931 | Priloženi izvoz `map.osm` |
| `north.osm.gz` | 16.64797, 44.77931, 16.68603, 44.78020 | [OpenStreetMap API, sjeverni pojas](https://api.openstreetmap.org/api/0.6/map?bbox=16.64797,44.77931,16.68603,44.78020) |
| `south.osm.gz` | 16.64797, 44.75319, 16.68603, 44.75408 | [OpenStreetMap API, južni pojas](https://api.openstreetmap.org/api/0.6/map?bbox=16.64797,44.75319,16.68603,44.75408) |

Izvori su komprimirani OSM XML sa sačuvanim identifikatorima i verzijama objekata. Uklonjeni su metapodaci o korisnicima i oznake s telefonskim brojevima i adresama e-pošte. Preklapajuće verzije istog objekta spajaju se prema numeričkoj oznaci verzije.

## Obnova

Iz korijena projekta pokrenuti:

```sh
python scripts/import_osm.py
```

Skripta koristi standardnu biblioteku Pythona 3.10 ili novijeg. Po želji prihvata jedan ili više lokalnih OSM XML ili gzipovanih OSM XML izvoza kao argumente. Izvoz iz Overpass API-ja treba sadržati čvorove puteva i članove multipoligona. Podrazumijevano čita tri priložena snimka. Preglednik čita izvedeni JSON preko istog servera kao i aplikaciju.

## Geometrija i visine

Mapa je kvadrat stranice 3.000 m, sa ishodištem na 44.7667° N i 16.6670° E. Lokalna ekvidistantna cilindrična projekcija koristi radijus Zemlje od 6.371.008,8 m. Osa X raste prema istoku, a Z prema jugu. Koordinate su zaokružene na centimetre radi kompaktnog zapisa. Tačnost stvarnih položaja zavisi od OSM izvora.

Obala Sane dolazi iz poligona `way/226887679` i multipoligona `relation/3341769`. Unutrašnji prstenovi čuvaju otoke. Posebna slojnica riječnog toka služi za oznake i pretragu. Tlocrt Hamza-begove džamije, četiri osnove minareta, kupola, igralište Podgrmeča i objekti mostova imaju vlastite OSM identifikatore.

Svaka zgrada ima oznaku `heightSource`. Vrijednost `osm:height` označava eksplicitnu visinu u izvoru. Oznaka `osm:levels` predstavlja broj spratova iz OSM-a pretvoren u metre uz pretpostavku od 3,1 m po spratu. Kod ostalih zgrada `estimate` predstavlja proceduralnu procjenu na osnovu namjene, površine tlocrta i stabilne varijacije prema OSM identifikatoru. Posebni modeli mogu imati vlastite procijenjene dimenzije. Širine cesta dolaze iz oznake `width` kada postoji ili iz procjene prema kategoriji puta. Položaji pojedinačno kartiranih stabala i svjetiljki čuvaju se odvojeno od proceduralno generisanih detalja.
