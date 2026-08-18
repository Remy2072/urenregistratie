# Bouwplan

Vervolg op `projectoverzicht.md`. Daar staat *wat* het wordt en *waarom*;
hier staat in welke volgorde je het bouwt en waaraan je ziet dat een fase
klaar is.

Elke fase heeft een **klaar als**. Dat is geen checklist voor de vorm: het is
de enige manier om te merken dat je een fase aan het uitbreiden bent in plaats
van af te maken. Is een fase klaar, dan mag je hem laten liggen.

---

## Uitgangspunten

| Onderdeel | Keuze |
|---|---|
| Frontend | SvelteKit, mobiel eerst, `manifest.json` zodat hij op het beginscherm kan |
| Database | Supabase (PostgreSQL), schema staat in `schema.sql` |
| Auth | Supabase Auth, e-mail + wachtwoord |
| Hosting | Vercel of Netlify, gratis tier |
| Tijdzone | Alles `Europe/Amsterdam`, expliciet — nooit de tijdzone van de server |

**Over die tijdzone.** In de database is het ongevaarlijk: `date` en `time`
hebben geen tijdzone, dus daar kan niets verschuiven. Het risico zit in
JavaScript, bij één vraag: *welke week is het nu?* Draait je server in UTC, dan
is het daar zondag 23:00 terwijl het hier al maandag is, en rolt je week een
dag te laat uit. Zet dat één keer goed in een helper en gebruik nooit
`new Date()` los in een component.

---

## Eén wijziging in de volgorde

In `projectoverzicht.md` staat login als stap 6, als laatste. **Dat klopt niet
meer sinds het rechtenmodel in het schema zit.**

Row level security bepaalt nu wie welke rij ziet, en die regels hangen aan
`personen.auth_user_id`. Zonder login is die kolom leeg, en dan geldt voor de
app: `is_beheerder()` is `false`, `huidige_persoon_id()` is `null`, en je komt
nergens bij. Je zou dus alle schermen bouwen met de service role key — die
gaat langs RLS heen — en pas in de laatste fase overschakelen op echte
sessies. Op dat moment werkt er niets meer en weet je van geen enkel scherm of
het aan de policies ligt of aan het scherm.

Daarom staat login hier als **fase 2**, direct na het schema en vóór het eerste
echte scherm. Het is een avond werk en daarna bouw je elk scherm meteen tegen
de rechten die er in productie ook zijn.

De redenering achter "login als laatste" blijft overigens overeind: hou hem
simpel, en bouw geen beveiliging die je niet begrijpt. Hij verhuist alleen naar
voren omdat er nu iets van afhangt.

---

## De fases

| # | Fase | Waarvoor | Grofweg |
|---|---|---|---|
| 0 | Prototype | Kunnen laten zien | 1 weekend |
| 1 | Schema live | Fundament dat aantoonbaar klopt | 1 avond |
| 2 | Login | Rechten kloppen vanaf hier | 1 avond |
| 3 | Weekgeneratie | Diensten ontstaan vanzelf | 1 avond |
| 4 | Bezorgerscherm | Jij hebt geen bonnetje meer nodig | 2 weekenden |
| 5 | Bazenscherm | De baas hoeft niet meer over te typen | 1 weekend |
| 6 | Export | De boekhouder krijgt wat hij wil | 1 avond |
| 7 | Installatie en overgang | Eerste echte draai, dan mag het bonnetje weg | 3 weken doorlooptijd |
| 8 | Boilerplate | Een tweede bedrijf zonder codewijziging | 1 weekend |
| 9 | Rooster | Beschikbaarheid ophalen en het rooster in de app maken | 2 weekenden |

Die schattingen zijn bouwtijd, geen kalendertijd. De website blijft prioriteit,
dus reken op twee tot drie maanden doorlooptijd. Dat is prima: er is geen
deadline en niemand wacht erop.

---

## Fase 0 — Prototype ✅

**Doel:** laten zien wat jij ziet, wat de baas ziet en wat de boekhouder
krijgt. Niets werkt, alles is te bekijken.

SvelteKit, geen database, geen login. Nepdata in één bestand, week 34
hardcoded. Drie schermen die je op je telefoon kan openen.

Eén regel die zich later terugbetaalt: **geef de nepdata precies de vorm van
het echte model.** Een dienst is een object met `datum`, `post`, `persoon`,
`gepland_begin/eind`, `werkelijk_begin/eind` en `status`. Doe je dat, dan
vervang je in fase 4 alleen de databron en blijven de schermen staan. Doe je
het niet, dan bouw je ze twee keer.

**Klaar als:** je het aan de baas kan laten zien zonder erbij te praten.

**Niet doen:** iets opslaan. Als een klik in dit prototype iets bewaart, ben je
aan fase 4 begonnen.

> **Staat er.** `npm run dev`, dan `/mijn-week`, `/overzicht` en `/export`.
> De app doet alsof het donderdag 20 augustus 2026, 22:15 is — midden in week
> 34, na sluitingstijd, zodat er op elk scherm iets te doen valt. Klikken
> werkt en werkt door: meld je je maandag op het bezorgerscherm, dan staat hij
> een tik later op het bazenscherm en na bevestigen in de export. Verversen
> zet alles terug.
>
> Eén beslissing die tijdens het bouwen naar boven kwam en die het waard is om
> te onthouden: **"niet gemeld" betekent iets anders voor de bezorger dan voor
> de baas.** Op het bezorgerscherm staat een dienst open zodra hij afgelopen
> is; op het bazenscherm pas de dag erna. Zonder die speling staat er elke
> avond iets in zijn aandachtslijstje en kijkt hij er binnen twee weken
> overheen.

---

## Fase 1 — Schema live ✅

**Doel:** een fundament waarvan je hebt gecontroleerd dat het klopt, niet
waarvan je aanneemt dat het klopt.

1. Supabase-project aanmaken en `schema.sql` in één keer plakken, en daarna
   `startdata.sql`. Dat tweede bestand is het enige dat per bedrijf verschilt:
   posten, dienstsoorten, mensen en het weekrooster. Na die stap staan er 17
   sjabloonregels — per weekdag 2, 2, 2, 2, 3, 3, 3 — en dat telt het bestand
   zelf af als laatste query.
2. Beheerder toevoegen (die regel staat uitgecommentarieerd onderaan
   `startdata.sql`). Zonder beheerder kan niemand bevestigen en telt er niets
   mee in de export.
3. `schema-test.sql` plakken. Dat probeert negen dingen die niet mogen en geeft
   een tabel terug waarin elke regel 'goed' hoort te zeggen.

Dat derde punt is de kern van deze fase: de constraints **expres kapot
proberen te maken**. Dit is de enige fase waarin dat nog gratis is, want er zit
nog geen data in die je kunt verliezen.

| Probeer | Verwacht |
|---|---|
| Dienst met `werkelijk_eind = '21:23'` | Faalt op `dienst_halve_uren` |
| Twee diensten, zelfde persoon, zelfde dag | Faalt op `diensten_persoon_bezet` |
| Status `afgemeld` mét werkelijke tijden | Faalt op `dienst_niet_gewerkt_geen_tijden` |
| Status `gemeld` zónder werkelijke tijden | Faalt op `dienst_gemeld_heeft_tijden` |
| Zelfde bus, zelfde dag, zelfde starttijd | Faalt op `diensten_post_bezet` |
| Vervallen dienst opnieuw inplannen | **Lukt** — daarom is die index partieel |
| Een dienst updaten | Zet een regel in `mutaties` |
| Sjabloonregel die een bestaande overlapt | Faalt op `sjabloon_geen_dubbel_slot` |
| Iemand twee keer op dezelfde weekdag | Faalt op `sjabloon_geen_dubbele_persoon` |

Let op die zesde: daar is slagen het goede antwoord. Als die faalt staat de
`where`-clausule niet op de index en blokkeert een geannuleerde dienst zijn
eigen vervanger.

**Wat dit niet test: de rechten.** In de SQL-editor ben je superuser en gelden
de policies niet voor jou. Row level security toets je in fase 2, ingelogd in
een gewone browser.

**Klaar als:** alle negen regels 'goed' zeggen en `select * from uren_export`
draait (leeg is goed, er is nog niets bevestigd).

> **Gedaan.** Draait op Supabase, Frankfurt. Sjabloon 2-2-2-2-3-3-3, negen van
> de negen controles goed, `uren_export` leeg zoals het hoort. De testfunctie
> mag weg met `drop function test_schema();`.
>
> Beide bestanden zijn vooraf doorgedraaid op een echte PostgreSQL: `schema.sql`
> loopt in één keer door en alle negen controles slagen. Struikelt het bij jou
> alsnog, dan zit het verschil dus in de omgeving en niet in het schema — kijk
> dan eerst of `create extension btree_gist` erdoor kwam.

**Op wiens account.** In `projectoverzicht.md` staat: zijn account, niet het
jouwe. Dat blijft kloppen, maar niet vanaf minuut één — je gaat hem geen
Supabase-account laten aanmaken voor iets wat hij nog niet gezien heeft. Draai
fase 0 en 1 op je eigen gratis project met **verzonnen namen**. Zodra er echte
namen en gewerkte uren in gaan — dat is fase 4 — verhuis je. Op dat moment is
verhuizen ook nog niets: `schema.sql` opnieuw draaien en het sjabloon
overtypen.

---

## Fase 2 — Login ✅

**Doel:** de app weet wie je bent, en vanaf hier klopt wat je ziet.

Supabase Auth met e-mail en wachtwoord, sessie in een cookie via
`@supabase/ssr`. Daarna per persoon `auth_user_id` vullen.

Waarom geen magic link: die vereist dat je in je mail komt op het moment dat je
wil inloggen. Dat is precies het soort extra stap waar dit project vanaf wil.
E-mail plus wachtwoord, sessie lang laten leven, telefoon onthoudt hem — dan
log je één keer in en daarna nooit meer.

**Klaar als:** je in een gewone browser (dus met de anon key, niet in de SQL
editor) als Daan inlogt en alleen Daans diensten ziet, en als beheerder alles.
Dat is de test die telt: RLS in de SQL editor testen zegt niets, want daar ben
je superuser en gelden de policies niet.

**Niet doen:** wachtwoord vergeten, e-mailverificatie, rollenbeheer in een
scherm. Tien mensen, jij zet ze er zelf in.

> **Gedaan.** `/inloggen` en `/ik`. Alles gaat server-side via
> `hooks.server.ts`, dus er is geen browserclient nodig en de sessie zit in
> een cookie.
>
> De toets: ingelogd als Daan ziet de app 1 persoon, 2 sjabloonregels en 3
> posten; als Kwan 10, 17 en 3. Diezelfde publieke sleutel geeft zonder login
> `permission denied for table personen`. De rechten uit fase 1 werken dus in
> het echt, niet alleen in de SQL-editor.
>
> De rol zit niet in Supabase Auth maar in `personen.rol`. Auth weet alleen
> wie je bent; `auth_user_id` legt de verbinding.

---

## Fase 3 — Weekgeneratie ✅

**Doel:** diensten ontstaan zonder dat iemand iets doet.

Een functie die voor een gegeven week de geldige `sjabloon_regels` uitrolt naar
zeven dagen. De geplande tijden komen als **kopie** uit de dienstsoort mee, niet
als verwijzing — dat is de reden dat die kolommen zo in het schema staan.

Twee dingen om goed te doen:

- **Idempotent.** Twee keer draaien mag geen dubbele diensten geven. Dat vangt
  `diensten_post_bezet` af, mits je de `where`-clausule herhaalt in je
  `on conflict` — anders vindt Postgres de index niet. Er staat een comment bij
  in `schema.sql`.
- **Eerst handmatig, dan pas automatisch.** Bouw hem als functie die je zelf
  aanroept en draai hem een paar weken met de hand. Werkt dat, dan zet je er
  `pg_cron` op, maandag 00:00. Cron erop zetten voordat je hem vertrouwt
  betekent dat de eerste fout op een maandagnacht gebeurt.

**Klaar als:** twee keer uitrollen geeft evenveel diensten als één keer, en een
week na een sjabloonwijziging rolt correct uit terwijl de week ervóór
onaangetast blijft.

> **Gedaan.** `weekgeneratie.sql` en `weekgeneratie-test.sql`. Twee functies,
> omdat kijken en doen twee dingen zijn:
>
> ```sql
> select * from sjabloon_slots(current_date);   -- wat zou hij doen
> select * from rol_week_uit();                 -- doe het, en vertel wat je deed
> ```
>
> `rol_week_uit` geeft een regel terug per slot met wat ermee gebeurd is:
> `nieuw`, `stond er al`, `stond er al — vervallen`, `overgeslagen — die dag al
> een andere dienst`. Dat rapport is de reden dat je hem een paar weken met de
> hand kán draaien zonder daarna in de tabel te gaan kijken.
>
> Twaalf controles, en ze staan alle twaalf op 'goed' op Supabase zelf --
> dezelfde uitkomst als vooraf op een lokale PostgreSQL. Week 34 is er in één
> keer uitgerold: 17 diensten, allemaal 'nieuw'.
>
> **De beslissing die tijdens het bouwen naar boven kwam: de uitrol raakt nooit
> een bestaande dienst aan.** Alleen inserts, geen updates. Dat klinkt
> vanzelfsprekend tot je bedenkt wat de alternatieven doen — een uitrol die
> "bijwerkt" zet zondagnacht de melding van iemand terug op `verwacht` omdat het
> sjabloon iets anders zegt. Vandaar drie dingen die anders zijn dan het
> bouwplan hierboven voorzag:
>
> - **Twee `not exists` in plaats van alleen `on conflict`.** `on conflict` kan
>   maar naar één index kijken, en er zijn er twee die hier kunnen afgaan:
>   `diensten_post_bezet` én `diensten_persoon_bezet`. Die tweede gaat af zodra
>   de baas één dienst geruild heeft — dan staat iemand ergens waar het sjabloon
>   hem niet verwacht, en zonder die extra check loopt niet die ene regel maar
>   de hele uitrol stuk.
> - **De slotcontrole kijkt bewust niet naar status.** Overal elders in het
>   schema betekent `vervallen` "telt niet mee", maar hier niet: een geannuleerde
>   dienst is een besluit van de baas en geen leeg gaatje. Zou de uitrol eroverheen
>   kijken, dan zet elke volgende run zijn annulering stilzwijgend terug.
> - **Cron draait maandag 01:00 UTC, niet maandag 00:00.** pg_cron rekent in de
>   tijdzone van de database en die staat op Supabase in UTC. "Maandag 00:00"
>   is daar zondag 22:00 in de zomer en 23:00 in de winter — een half jaar lang
>   rolt hij dan de vórige week uit. Dit is precies de tijdzonefout uit de
>   uitgangspunten hierboven, maar dan op de plek waar je hem niet zoekt.
>
> **En één vondst in het schema, gevonden door het te draaien.** `geldig_vanaf`
> stond op `current_date`. Draai je `schema.sql` op een woensdag, dan geldt het
> sjabloon pas vanaf woensdag en rolt de eerste week alleen woensdag tot en met
> zondag uit — zonder foutmelding, want die maandag bestáát dan niet als
> sjabloonregel. Het sjabloon onderaan `schema.sql` zet nu expliciet de maandag
> van die week. Belangrijk bij de verhuizing naar het account van de baas in
> fase 4, want daar draai je dat bestand opnieuw.
>
> **Wat nog niet af is: cron staat er niet op.** Dat is met opzet — eerst een
> paar weken met de hand, zoals hierboven staat. De regel staat klaar onderaan
> `weekgeneratie.sql`.

---

## Fase 4 — Bezorgerscherm ✅

**Doel:** jij hebt geen bonnetje meer nodig.

Eén scherm: jouw week. Per dienst één regel, en de dienst van vandaag bovenaan.

- **"Gedraaid"** — één tik, kopieert gepland naar werkelijk, status naar
  `gemeld`.
- **Afwijken** — `−30` en `+30` op de begintijd, `−30`, `+30` en `+60` op de
  eindtijd, dan bevestigen. Geen tijdkiezer.

  Begin én eind, niet alleen eind. Later beginnen komt net zo vaak voor als
  langer doorgaan — file, lekke band, of je nam de dienst halverwege over. Kan
  je alleen de eindtijd verzetten, dan gaat iedereen het verschil in de
  eindtijd verwerken en klopt er straks niets meer van de tijden zelf. Het
  schema heeft `werkelijk_begin` altijd al los van `gepland_begin` gehad; dit
  is alleen het scherm dat die mogelijkheid ook aanbiedt.

  Let op wat dit voor het bazenscherm betekent: een half uur later begonnen en
  een half uur later gestopt is wél een afwijking, maar kost niets. Toon dat
  als "andere tijden, even lang" — anders staat er een afwijking zonder getal
  en gaat hij zoeken naar iets wat er niet is.
- **Achteraf melden** — een dienst van gisteren of eergisteren kan gewoon nog.
  Het vlaggetje is afleidbaar (`gemeld_op::date > datum`), je hoeft niets extra
  op te slaan.
- **Corrigeren** — een melding die nog niet bevestigd is, kun je aanpassen.
  Dit stond niet in de oorspronkelijke lijst en kwam pas boven bij het testen:
  het scherm sprak `schema.sql` tegen. Daar staat op `diensten_melden`
  `using (... status in ('verwacht', 'gemeld'))` — de database liet een tweede
  melding altijd al toe — maar het scherm liet je er na één tik niet meer bij.
  Eén misklik op "Gedraaid" en je moest de baas vragen. Zodra hij bevestigd
  heeft is het wél zijn oordeel en houdt de policy je tegen; dat is de grens en
  die klopte al.

**Afronden — beantwoord: naar het dichtstbijzijnde half uur.** De database
staat alleen hele en halve uren toe, dus de `+30`-knop dwong al een keuze af.
De regel is nu: de knip ligt op `:15` en `:45`. Klaar om 21:10 meldt 21:00,
klaar om 21:20 meldt 21:30.

Twee dingen die daaruit volgen voor dit scherm:

- **De knoppen rekenen niet, de bezorger kiest.** Er is geen tijdkiezer en dus
  ook nergens een tijd met minuten die afgerond moet worden — je stapt van half
  uur naar half uur. Afronden is daarom geen code maar een afspraak, en die
  afspraak hoort op het scherm te staan, niet in een handleiding. Eén regel bij
  de stappers is genoeg.
- **Bij twijfel niet naar boven.** Dit is de helft van de gevallen waarin het
  in het nadeel van de bezorger uitpakt, en dat is precies waarom het een
  afspraak van de baas moest zijn en niet van jou. Leg hem uit zoals hij is —
  hij middelt over een maand weg — en verzin er geen coulanceregel bij.

**Hier komt de opsplitsing in componenten.** In het prototype staat alles nog
in drie pagina's, en dat is daar prima: die schermen waren om te laten zien,
niet om te onderhouden. Vanaf deze fase ga je er echt in werken, en dan wil je
de meldkaart, de statusmerkjes, de tijdstappers en de dienstregel als losse
componenten hebben. Doe die splitsing aan het begin van de fase, niet aan het
eind — dan bouw je de rest er meteen mee.

**Klaar als:** je in dit project een week lang je diensten meldt — gedraaid,
afwijkend, en eentje achteraf — en dat alle drie in de database terechtkomen
zoals je ze hebt ingevoerd.

*Dit stond eerst anders:* "jij meldt een volle week je eigen diensten zonder
bonnetje". Dat kan hier niet en dat moet ook niet. Deze repository is het
dev-project en er gaan nooit echte namen of uren in — zie fase 8. Naast het
bonnetje draaien hoort bij de eerste echte installatie, en die staat nu in fase
7. De reden is simpel: je gaat niet bij de baas van Tjon zitten proefdraaien
terwijl er nog bugs in zitten.

> **Gedaan.** `/mijn-week` haalt je eigen diensten uit Supabase en meldt ze
> terug. De componenten staan los in `src/lib/componenten/` — `MeldKaart`,
> `TijdStapper`, `DienstRegel`, `Merk` — en die splitsing is aan het begin van
> de fase gedaan, niet aan het eind.
>
> Getoetst als Daan: maandag stond open met het merkje achteraf, "Gedraaid"
> zette hem op `gemeld` met 5 uur, en aanpassen naar 21:30 gaf `+30 min` en
> 5,5 uur.
>
> Drie dingen die tijdens het bouwen naar boven kwamen:
>
> - **De klok wordt op de server gelezen**, in de load, en niet in een
>   component. Anders rekent de browser mee met de tijdzone van de telefoon en
>   ziet iemand op vakantie een andere week dan zijn collega hier.
> - **De week ervóór wordt meegeladen.** "Gisteren kan gewoon nog" moet ook op
>   maandag gelden, en dan ligt gisteren in de vorige week. Alleen wat daar nog
>   openstaat komt op het scherm.
> - **Postgres geeft een `time` terug als `'16:00:00'`.** Cosmetisch in de
>   weergave, maar `afwijkend()` vergelijkt die tijden als tekst — zo zou elke
>   dienst als afwijking binnenkomen. `korteTijd()` snijdt het af op de plek
>   waar het binnenkomt, en dat is één plek.
>
> En alle routes zitten achter de login, via één deur in `hooks.server.ts` in
> plaats van een wachter per route. Gevolg: de demo staat er ook achter. Wil je
> de baas `/overzicht` laten zien, dan kan dat op jouw scherm of met een account
> voor hem.

**Niet doen:** ruilen. Dat is een beheerdersactie en die zit in fase 5.

Het overleg over een ruil gaat toch in de groepsapp — daar wordt geregeld dat
iemand jouw dienst overneemt. Wat de app moet vastleggen is alleen de uitkomst,
en dat is één veld: `persoon_id` op de dienst. De baas verzet dat, `mutaties`
onthoudt wie er oorspronkelijk stond, en bij de vervanger verschijnt de dienst
gewoon in zijn week.

Waarom dat niet bij de bezorger hoort: kan iedereen een dienst op een ander
zetten, dan kan iemand jouw avond op zijn naam schrijven, of de zijne op die
van jou. Precies daarom staat er in `schema.sql` op `diensten_melden` een
`with check (persoon_id = huidige_persoon_id())` — de database laat het niet
eens toe. Bouw je hier een ruilknop, dan krijg je een foutmelding uit
Postgres, en dat is geen toeval maar het ontwerp.

---

## Fase 5 — Bazenscherm ✅

**Doel:** één scherm, zondagavond, klaar in vijf minuten.

Bovenaan alleen wat aandacht nodig heeft:

1. **Afwijkingen** — met het verschil erbij: "21:00 → 21:30, +30 min".
2. **Niet gemeld** — diensten die op `verwacht` blijven staan.
3. **Achteraf gemeld** — het vlaggetje uit fase 4.

Daaronder de rest, ingeklapt. Onderaan totalen per persoon.

Bevestigen kan los en in bulk ("alles zonder afwijking bevestigen"). Die
bulkknop is het verschil tussen vijf minuten en een half uur, en hij is veilig:
diensten zonder afwijking zijn precies de gevallen waar niets te beoordelen
valt.

**Ruilen zit hier**, en het is de kleinste knop van de hele app: op een dienst
een andere persoon kiezen. Meer is een ruil niet, omdat `persoon_id` op de
dienst staat en niet op de sjabloonregel. Het sjabloon blijft ongemoeid — die
ruil geldt voor één avond, niet voor elke dinsdag — en `mutaties` legt vast wie
er oorspronkelijk stond. Dat laatste is het hele punt: bij discussie is het
verschil tussen "hij stond ingeroosterd" en "hij heeft gereden" precies wat je
terug wil kunnen zoeken.

Ruilt de baas een dienst die al gemeld was, dan is dat een fout die je wil
zien: dan heeft de verkeerde persoon hem ingevuld. Zet de dienst in dat geval
terug op `verwacht`, zodat de nieuwe persoon hem alsnog meldt.

**Beide blokkerende vragen zijn beantwoord.**

**Wie mag bevestigen: drie mensen.** Twee bazen en een manager. Dat vraagt geen
enkele wijziging — `personen.rol` kent er al meer dan één en alle policies
hangen aan `is_beheerder()`, niet aan één persoon. Wat het wél belangrijk maakt
is `bevestigd_door`: met drie mensen die kunnen bevestigen is "wie heeft dit
goedgekeurd" een vraag die echt gesteld gaat worden, en die kolom vult zichzelf
al in de trigger. Zet ze in `startdata.sql` alle drie op `beheerder`.

**Geen "invullen namens"-knop.** De verantwoordelijkheid blijft bij de
bezorger. De baas ziet op zijn scherm wie nog niet gemeld heeft en kan hem
appen als dat zin heeft, maar hij vult niets voor hem in.

Dat is de strengere van de twee en het maakt dit scherm eenvoudiger, maar er
zit een staart aan die je moet willen: **een dienst die niemand meldt blijft op
`verwacht` staan en komt dus nooit in de export.** Geen melding, geen uren. Dat
is precies wat "eigen verantwoordelijkheid" betekent, maar het betekent ook dat
zo'n dienst zichtbaar moet blijven staan tot iemand er iets mee doet — niet
wegvallen omdat de week voorbij is. Hij blijft daarom in het aandachtslijstje
staan, ook als hij van vorige maand is.

**Klaar als:** de hele keten draait in dit project — een bezorger meldt, de baas
ziet het staan, bevestigt los en in bulk, en kan een dienst verzetten.

*Ook dit stond eerst anders:* "de baas loopt een echte week door". Een echte
week bestaat pas na de eerste installatie, en die staat nu in fase 7. Wat wél
nu moet gebeuren is hem dit scherm laten zien met de verzonnen ploeg erin en
een kwartier naar hem luisteren — dat is de gewoonte onderaan dit bouwplan, en
die is er juist voor de fase waarin je nog goedkoop kunt bijsturen.

> **Gedaan.** `/overzicht` draait op de database. Bovenaan wat aandacht vraagt,
> daaronder wat rechttoe is met de bulkknop, dan de rest ingeklapt en de
> totalen per persoon.
>
> Getoetst met twee sessies naast elkaar — Daan in het gewone venster, Kwan in
> een incognitovenster — want dat is de enige manier om de keten echt te
> volgen:
>
> - Daan meldde maandag een half uur eerder begonnen én geëindigd. Dat toont
>   als `andere tijden, even lang` en zonder getal, precies het geval waar de
>   fase-4-tekst voor waarschuwde: wél een afwijking, maar hij kost niets.
> - Bevestigen los werkte, en de dienst verhuisde naar de totalen.
> - Ruilen naar iemand die die dag al reed werd geweigerd met "Die staat die
>   dag al ergens anders ingeroosterd" — dat is `diensten_persoon_bezet` die
>   zijn werk doet, netjes vertaald. Ruilen naar iemand die vrij was lukte.
> - De bulkknop is apart uitgelokt met een dienst die op de dag zelf zonder
>   afwijking gemeld werd, want anders komt hij nooit boven nul.
> - Een gemelde dienst verzetten zette hem terug op `verwacht` met de uren
>   eraf. Dat pad had eerst geen knop: verzetten kon alleen bij diensten waar
>   nog niets mee gebeurd was, terwijl juist dít het geval is dat het bouwplan
>   beschrijft — als de baas een gemelde dienst verzet, heeft de verkeerde
>   persoon hem ingevuld. Nu staat de knop er ook bij een gemelde dienst, met
>   de waarschuwing erbij dat de uren eraf gaan.
>
> **Wat welke diensten "zonder afwijking" zijn bepaalt de server, niet het
> scherm.** Anders bepaalt de browser wat er ongezien bevestigd wordt, en dat
> is precies de knop waar je dat niet wil.
>
> **En de niet-gemelde diensten blijven staan.** Er is geen "invullen namens",
> dus er is ook niets dat zo'n dienst opruimt. Zou hij alleen in zijn eigen week
> zichtbaar zijn, dan verdwijnt hij zodra de week voorbij is en merkt niemand
> ooit dat er een avond niet verantwoord is. Vandaar het blok "Blijft
> openstaan" bovenaan, dat verder terugkijkt dan de week die je bekijkt.

---

## Fase 6 — Export ✅

**Doel:** de boekhouder hoeft niets over te typen.

De view `uren_export` staat er al. Wat er nog bij komt is een knop die er een
bestand van maakt over een periode.

**De blokkerende vraag is verhuisd, niet verdwenen.** Welk formaat de
boekhouder wil — kolomnamen, per dag of weektotaal, CSV of Excel — blijft de
vraag die bepaalt of dit iets oplevert. Maar hij hoort bij de installatie en
niet bij het bouwen: het exportformaat is precies zo'n ding dat per bedrijf
verschilt, net als de posten en het rooster. In het dev-project bouw je een
export die werkt en die op één plek te herschrijven is; bij de installatie leg
je hem naast de sheet die de boekhouder nu gebruikt.

Wat overeind blijft: **bouw hem daar niet op gevoel.** Vraag een lege of
geanonimiseerde versie van zijn huidige sheet. Past de export niet op zijn
werkwijze, dan typt de baas het alsnog over en heeft het hele project niets
opgelost.

Nooit euro's. Uren eruit, loon is zijn werk.

**Klaar als:** je in dit project een periode kiest, het bestand downloadt en
erin ziet staan wat er bevestigd is — en niets meer dan dat.

*De echte toets blijft dat de boekhouder zegt dat het klopt.* Die staat in fase
7, bij de installatie.

> **Gedaan.** `/export` draait op de view `uren_export`. Periode kiezen met
> van/tot of een snelkeuze (deze week, vorige week, deze maand, vorige maand),
> totalen per medewerker, de regels eronder ingeklapt als onderbouwing, en een
> knop die er een CSV van maakt.
>
> **Het bestand is een adres en geen knop.** `/export/bestand?van=…&tot=…` zet
> het bestand op de server in elkaar. Bouw je het in de browser, dan bestaat de
> export alleen zolang die pagina open staat en kun je hem niet doorsturen of
> in een script gebruiken. Ingelogd zijn en beheerder zijn geldt er net zo goed.
>
> Getoetst door het bestand echt te downloaden en er byte voor byte in te
> kijken:
>
> ```
> efbbbf  ← de BOM
> Medewerker;Datum;Post;Begin;Einde;Uren;Opmerking
> Daan;17-08-2026;Bus 3;15:30;20:30;5;
> ```
>
> Vier dingen die er voor een Nederlandse boekhouder toe doen en die je alleen
> ziet als je het bestand echt opent: **puntkomma's** als scheidingsteken (bij
> ons is de komma het decimaalteken), **datums als dd-mm-jjjj**, **uren met een
> komma**, en die **BOM** vooraan — zonder die drie bytes leest Excel het
> bestand als Windows-1252 en maakt het van 'André' iets anders.
>
> En wat er níét in stond is net zo belangrijk: de dienst die bij een ruil was
> teruggezet naar `verwacht` ontbreekt. Geen melding en geen bevestiging, dus
> geen uren.
>
> De kolommen staan op één plek, in `src/lib/server/uren.ts`. Dat is het enige
> bestand dat verandert als een bedrijf iets anders wil.

---

## Fase 7 — Eerste installatie en overgang

**Doel:** het bonnetje mag weg — en hij besluit dat, niet jij.

**Hier gaat de app pas voor het eerst echt draaien.** Fase 4 tot en met 6 zijn
af in het dev-project, met verzonnen namen: de bezorger meldt, de baas
bevestigt, de export komt eruit. Pas als die hele keten rond is zet je een
installatie op voor Tjon — eigen Supabase-project op het account van de baas,
`schema.sql`, een eigen `startdata.sql` met de echte ploeg, `weekgeneratie.sql`,
een login per persoon, `.env` om.

Die volgorde is de hele reden dat het dev-project bestaat. Ga je bij de baas
proefdraaien terwijl er nog bugs in zitten, dan is hij je testomgeving en kost
elke fout je zijn vertrouwen in plaats van een middag.

Daarna twee tot drie weken dubbel bijhouden: bonnetje én app. Elke week
vergelijken. Zit er verschil in, dan is dat een bug of een misverstand over de
regels, en allebei wil je die nu vinden.

Zet vóór deze fase op papier wat je oplevert en wat er ná oplevering wel en niet
bij zit. Je bent bezorger én bouwer van het systeem dat jouw uren registreert;
dat wordt ongemakkelijk op het moment dat er discussie is over een dienst, en
dat moment is precies het verkeerde om er dan pas over te beginnen.

**Klaar als:** de baas zegt dat de bonnetjes weg kunnen.

---

## Fase 8 — Boilerplate

**Doel:** een tweede bedrijf staat er binnen een avond op, zonder dat je één
`.svelte`-bestand aanraakt.

Dit is de fase die er tijdens het bouwen bij is gekomen. Deze repository is niet
de app van Tjon maar het **dev-project**: hier moet alles werken, met verzonnen
namen. Is hij af, dan kloon je hem per bedrijf — eigen naam, eigen
Supabase-project, door jou ingericht.

**Dit is geen multi-tenancy**, en daarmee blijft het binnen wat
`projectoverzicht.md` buiten scope zet. Eén installatie per bedrijf, één
database per bedrijf. Twee bedrijven komen elkaar nooit tegen omdat ze elkaars
bestaan niet kennen — een stuk goedkoper dan het alternatief, en bij tien man
per zaak ook eerlijker.

De afstand is klein, want het schema was al generiek: er staat `post` en geen
`bus`, en niets bedrijfsspecifieks in de structuur. Wat er nog moet gebeuren:

- **De naam uit de code.** Nu staat "Urenregistratie" hard in `+layout.svelte`.
  Bedrijfsnaam, kleur en favicon horen in één configuratiebestand.
- **`schema-test.sql` losmaken van de data.** Die zoekt nu `'Bus 2'` en
  `'vroeg'` op naam op. Bij een bedrijf met andere posten faalt hij op iets wat
  niet stuk is. Laat hem pakken wat er is in plaats van wat hij verwacht.
- **Een installatiehandleiding.** Zes stappen: schema, startdata,
  weekgeneratie, logins koppelen, `.env`, deploy. Als jij het over een half jaar
  opnieuw doet ben je die volgorde kwijt.
- **De afrondregel als keuze.** Halve uren zitten in `is_half_uur()` en de
  richting staat als afspraak op het scherm. Een ander bedrijf werkt misschien
  met kwartieren. Dat is één functie en één regel tekst — maar wel op twee
  plekken, dus schrijf op dat ze bij elkaar horen.

**Klaar als:** je een tweede bedrijf hebt opgezet en de enige bestanden die je
hebt aangeraakt `startdata.sql` en het configuratiebestand zijn.

**Niet nu doen.** Dit staat hier zodat het niet in fase 4 tot en met 7 sluipt.
Eerst moet het bij één bedrijf echt werken; een boilerplate van iets dat nog
nooit een maand heeft gedraaid is een boilerplate van je aannames.

---

## Fase 9 — Rooster

**Doel:** het rooster ontstaat in de app in plaats van in de groepsapp, en
niemand hoeft meer terug te scrollen om te weten wanneer hij werkt.

Deze fase draait iets om dat in `projectoverzicht.md` bewust buiten scope
stond: *het rooster niet uit WhatsApp halen.* Dat bezwaar was goed en het is
niet vervallen — "haal je het weg en de app hapert één keer, dan is de groepsapp
binnen een week terug en heb je twee waarheden."

Wat het oplost is de laatste stap hieronder: **de app maakt het
WhatsApp-bericht.** De baas klikt het rooster in elkaar, drukt op kopiëren en
plakt het in de groep. Eén waarheid — de app — en één kanaal — de groep.
WhatsApp wordt niet vervangen maar bediend. Bouw je die knop niet, dan gaat dit
bezwaar alsnog op en moet je deze fase niet beginnen.

### Wat erin zit

1. **Beschikbaarheid invullen.** Elke bezorger zet per weekdag of hij kan.
2. **Het staat de volgende week al ingevuld.** Geen bevestiging nodig, wel aan
   te passen.
3. **Dashboard voor de baas:** wie kan welke dag.
4. **Roostertab,** zichtbaar voor iedereen: wie staat er deze week op welke bus
   en hoe laat. Dat is het scherm dat het terugscrollen in WhatsApp vervangt.
5. **Rooster maken** door namen op bussen te zetten, en een knop die er een
   bericht van maakt voor de groepsapp.

### Het sjabloon blijft de basis

*Beslist bij het opschrijven van deze fase.* De week rolt uit zoals nu, via
`rol_week_uit()`, en de baas verzet alleen wat afwijkt. Beschikbaarheid is
daarbij een signaal en geen invoer: "Lars heeft vrijdag weggezet" kleurt die
dienst, en dan sleep je er iemand anders in.

Het alternatief — elke week vanaf nul plannen — geeft meer vrijheid en kost elke
week werk, ook in de vier weken op de vijf dat er niets verandert. Bij Tjon
staat het rooster grotendeels vast, dus dat is een slechte ruil.

### Twee soorten "ik kan niet"

Hier zit het addertje, en het is de moeite waard om er even bij stil te staan.

*"De waarden van vorige week staan er automatisch in"* betekent letterlijk
overnemen: zet iemand deze week vrijdag weg omdat hij één keer naar een bruiloft
moet, dan staat vrijdag volgende week ook weg. En de week daarna. Niemand die
het merkt, want er staat gewoon wat er stond.

Er zijn dus twee dingen die allebei "ik kan niet" heten:

- **Structureel** — "ik heb op vrijdag college". Dat verandert een paar keer per
  jaar.
- **Incidenteel** — "deze vrijdag ben ik weg". Dat geldt één week.

Het voorstel is om dat te bouwen zoals het sjabloon en de diensten al werken:
een **standaardbeschikbaarheid** per persoon per weekdag, en per week de
**afwijkingen** daarop. Dan is "volgende week staat het al ingevuld" gewoon de
standaard, en is een incidentele afmelding er een voor één week. Wie iets
structureels wil wijzigen krijgt er een keuze bij: *ook voortaan.*

Dat is één vinkje extra en het scheelt het gesprek waarin iemand zegt dat hij al
twee maanden geen vrijdag meer krijgt.

### Waarop

Slepen op laptop of tablet, aantikken op de telefoon — dat is besloten.
Slepen op een klein scherm is bewerkelijk en foutgevoelig, dus daar wordt het
"tik een bus aan, kies een naam". Twee bediening en, één scherm eronder.

### Wanneer

**Na fase 7 of ervoor, maar niet ertussendoor.** Ga je installeren, dan wil je
niet halverwege het rooster omgooien. Doe je fase 9 eerst, dan ziet de baas
meteen het geheel — en dat is precies wat hij te zien krijgt als je het hem
verkoopt.

**Klaar als:** de baas het rooster van een week in de app maakt, op kopiëren
drukt, en dat bericht in de groepsapp zet zonder er iets aan te veranderen.

---

## Open vragen, gekoppeld aan hun fase

| Vraag | Blokkeert | Aan wie |
|---|---|---|
| ~~Afronden: 21:20 wordt 21:00 of 21:30?~~ | ~~Fase 4~~ | **Beantwoord: dichtstbijzijnde half uur** |
| ~~Wie mag bevestigen?~~ | ~~Fase 5~~ | **Beantwoord: twee bazen en een manager** |
| ~~Niet-gemelde dienst: namens invullen?~~ | ~~Fase 5~~ | **Beantwoord: nee, de bezorger meldt zelf** |
| Exportformaat | Bij de installatie (fase 7) | Boekhouder |
| Hoe ziet de huidige Excel eruit? | Bij de installatie (fase 7) | Baas |
| Werkt het restaurantrooster hetzelfde? | Ná fase 7 | Baas |

Wat er nog openstaat gaat allemaal over de export, en dat is één gesprek. De laatste is geen blokkade maar
bepaalt of het model straks de keuken aankan, dus je wil het antwoord vóór je
iets herbouwt om restaurantpersoneel toe te laten.

---

## Opruimen

Schulden die je onderweg bewust hebt gemaakt. Ze staan hier zodat je ze niet
hoeft te onthouden — en zodat je ziet dat het er minder zijn dan het voelt.

### Het prototype is weg ✅

Hier stond eerst dat het prototype vanzelf zou wegvallen zodra het
bezorgerscherm echte data ophaalde, en daarna dat dat maar voor een derde
klopte. Inmiddels is het alle drie gebeurd: `/mijn-week` in fase 4,
`/overzicht` in fase 5, `/export` in fase 6.

Toen ook de uitlegpagina op `/` wegviel — die was alleen nuttig zolang er niets
werkte — hadden `nepdata.ts` en `prototype.svelte.ts` geen gebruikers meer en
zijn ze verwijderd, samen met de prototypestrook in `+layout.svelte`. `/` stuurt
je nu door naar jouw scherm.

De demo staat nog in de branch `fase-0-prototype`, en dat is nu de enige plek
waar hij staat.

### Los op te ruimen

| Wat | Wanneer | Waarom |
|---|---|---|
| `pg_cron` op de weekuitrol | na een paar handmatige weken | Draait nu met de hand. De regel staat klaar onderaan `weekgeneratie.sql` |
| `drop function test_schema();` en `test_weekgeneratie();` | wanneer je eraan denkt | Testfuncties uit fase 1 en 3, staan nog in de database |
| Vercel-deploy | vóór fase 7, en het eerste wat er nu ligt | Dubbel bijhouden werkt niet als de app alleen op jouw laptop draait — en je kunt het de baas pas op zijn eigen telefoon laten zien als het ergens staat |
| `.env` op Vercel zetten | tegelijk | Twee waarden, dezelfde als lokaal |
| Deployment Protection op main | tegelijk | Vanaf fase 4 staan er echte namen en uren in |
| Branch `fase-0-prototype` | laten staan | Sinds het prototype uit `main` is, is dit de enige plek waar de demo nog bestaat |
| `npm audit`: `cookie <0.7.0` | bij een SvelteKit-update | Lage ernst, komt via SvelteKit zelf, er is nog geen fix. `audit fix --force` zou Kit naar 0.0.30 downgraden — niet doen |

### En één gewoonte

**Geef je feedback per fase, niet opgespaard.** Dit is de plek waar dit soort
projecten stilvalt: lever je fase 4 op en komt er daarna een lijst van dertig
opmerkingen, dan is dat geen afronden meer maar opnieuw beginnen. Kijk na elke
fase een kwartier, zeg wat er niet klopt, en dat gaat mee in de volgende. De
"klaar als" per fase is daar precies voor bedoeld.

---

## Wat in geen enkele fase gebouwd wordt

Staat ook in `projectoverzicht.md`, maar hier omdat scope juist tijdens het
bouwen uitloopt en niet tijdens het plannen: geen loonberekening, geen App
Store-app, geen multi-tenancy, geen restaurantpersoneel.

*"Geen rooster in de app" stond in dit rijtje en staat er niet meer.* Zie fase
9 — en zie ook wat daar over die omkering staat, want het oorspronkelijke
bezwaar was goed.

Komt er tijdens een fase iets bij dat hier niet in staat, dan is dat geen
uitbreiding maar een volgende fase. Schrijf het op en maak eerst af waar je mee
bezig was.
