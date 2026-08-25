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
| 0 | Prototype ✅ | Kunnen laten zien | 1 weekend |
| 1 | Schema live ✅ | Fundament dat aantoonbaar klopt | 1 avond |
| 2 | Login ✅ | Rechten kloppen vanaf hier | 1 avond |
| 3 | Weekgeneratie ✅ | Diensten ontstaan vanzelf | 1 avond |
| 4 | Bezorgerscherm ✅ | Jij hebt geen bonnetje meer nodig | 2 weekenden |
| 5 | Bazenscherm ✅ | De baas hoeft niet meer over te typen | 1 weekend |
| 6 | Export ✅ | De boekhouder krijgt wat hij wil | 1 avond |
| 7 | Installatie en overgang ⏳ | Eerste echte draai, dan mag het bonnetje weg | 3 weken doorlooptijd |
| 8 | Boilerplate ⏳ | Een tweede bedrijf zonder codewijziging | 1 weekend |
| 9 | Rooster en beheer ✅ | Beschikbaarheid, het rooster in de app, en de baas die zelf kan instellen | 2 weekenden |
| 10 | Gebruikersnaam en profiel ✅ | Inloggen zonder e-mailadres, en iedereen beheert wat van hem is | 1 avond |
| 11 | Ingelogd blijven ✅ | Een storing is geen uitlog, en de app hoort op je beginscherm | 1 avond |
| 12 | Passkey ✅ | Inloggen met gezicht of vinger, zonder token in de browser | 1 avond |
| 13 | Wachtwoord vergeten ✅ | Zelf weer binnen komen, met een code per sms | 1 weekend |
| 14 | Diensten ruilen ✅ | Gericht per sms, of open in de groepsapp | 1 weekend |
| 15 | Agenda ✅ | Je diensten in de agenda die je al open hebt | 1 avond |
| 16 | Herstel op je nummer ✅ | Je gebruikersnaam vergeten is geen doodlopende weg | 1 avond |
| 17 | Superadmin ✅ | Support zonder het dashboard, en zonder in de ploeg te staan | 1 avond |
| 18 | De showcase ⏳ | Live installatie om te testen, te tonen en te verkopen. Gaat vóór fase 7 | 1 weekend |

**De nummers zijn niet de volgorde, en ze worden ook niet hernummerd.** Ze volgen
wanneer een fase bedacht is. Fase 0 tot en met 6 zijn ook in die volgorde
gedaan; daarna niet meer — fase 8 is bewust uitgesteld tot het bij één bedrijf
echt werkt, en fase 18 moet er juist vóór.

Zo'n nummer is inmiddels een naam. Er staat 163 keer "fase zoveel" in dit
project: in de sql-bestanden, in de code, in de README en in de
commit-geschiedenis. Op volgorde zetten zou die allemaal naar het verkeerde
laten wijzen, en de geschiedenis kun je sowieso niet meer bijwerken. **Wat er
nog open staat lees je daarom aan ⏳ en niet aan het nummer.** Dat zijn er drie,
en met de deploy die eraan voorafgaat is dit de volgorde:

| | Wat | Waarom die plek |
|---|---|---|
| 1 | **Vercel-deploy** (zie Opruimen) | Zonder deploy is er niets om te tonen en kan niemand dubbel bijhouden |
| 2 | **Fase 18** — de showcase | De generale repetitie van `installatie.md`, op een bedrijf dat niet boos kan worden |
| 3 | **Fase 7** — installatie en overgang | Nu pas draait het bij een echte klant, met stappen die al bewezen zijn |
| 4 | **Fase 8** — boilerplate | Een boilerplate van iets dat nog nooit een maand heeft gedraaid is een boilerplate van je aannames |

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

## Fase 7 — Eerste installatie en overgang ⏳

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

### Er komt iets vóór deze fase (2026-08-25)

**Fase 18, de showcase.** Eén live installatie op een verzonnen bedrijf: jij test er in het echt, een prospect ziet werkende software, en
vrienden gebruiken hem als gewone gebruiker.

Wat dat met deze fase doet is dat het de generale repetitie wordt. De hele
`installatie.md` gaat één keer door voor een bedrijf dat niet boos kan worden —
klopt de volgorde van de sql, werkt de deploy, doen passkeys het op een echt
domein. Als je dat bij Tjon voor het eerst uitzoekt, is hij je testomgeving, en
dat is precies wat drie alinea's hierboven staat als de fout die je niet wil
maken.

**En het verandert je rol, ten gunste.** De waarschuwing hierboven — bezorger én
bouwer — wordt kleiner als je het verkoopt in plaats van oplevert. Met een demo,
een prijs en een contract ben je een leverancier en geen collega die iets in
elkaar zette. Dat is beter voor de discussie over die ene dienst, en het is de
route die bij fase 18 staat: showcase, demo aan Tjon, ja, en dan pas deze
fase. Het dubbel bijhouden blijft staan, maar het heet dan onboarding.

**Klaar als:** de baas zegt dat de bonnetjes weg kunnen.

---

## Fase 8 — Boilerplate ⏳

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
`bus`, en niets bedrijfsspecifieks in de structuur.

**Wat er nog moet gebeuren:**

- **De bedrijfspagina.** Het grootste stuk van deze fase, hieronder uitgewerkt.
  Eén pagina voor de eigenaar met naam, kleur, logo en de handvol regels die per
  bedrijf verschillen.
- **`schema-test.sql` losmaken van de data.** Die zoekt nu `'Bus 2'` en
  `'vroeg'` op naam op. Bij een bedrijf met andere posten faalt hij op iets wat
  niet stuk is. Laat hem pakken wat er is in plaats van wat hij verwacht.
- **De afrondregel als keuze.** Halve uren zitten in `is_half_uur()` en de
  richting staat als afspraak op het scherm. Een ander bedrijf werkt misschien
  met kwartieren. Dat is één functie en één regel tekst — maar wel op twee
  plekken, dus schrijf op dat ze bij elkaar horen. Hoort op de bedrijfspagina.
- **De openingstijden van de tijdstapper.** `VROEGSTE` en `LAATSTE` in
  `MeldKaart.svelte` staan op 15:00 en 22:00 omdat de eerste klant 's avonds
  rijdt. Een ochtendploeg tikt daar tegen een muur. Twee getallen, en de enige
  aanname over openingstijden die er in de app nog staat. Hoort op de
  bedrijfspagina.

**Gedaan (2026-08-25):**

- ~~**Een installatiehandleiding.**~~ Het is `installatie.md` geworden: van niets
  naar een draaiende installatie, met de volgorde van de sql-bestanden en de twee
  plekken waar die volgorde niet vrij is.
- ~~**De naam uit de code.**~~ Half. "Urenregistratie" is overal "Bon" geworden
  en de taal van één klant is eruit — de rol `medewerker` heette op het
  beheerscherm "Bezorger", en de voorbeelden bij `posten` en `dienstsoorten`
  noemden alleen bussen. Wat er nog staat is dat "Bon" nu hard in
  `+layout.svelte` staat waar straks de bedrijfsnaam hoort. Dat is de eerste
  regel van de bedrijfspagina hierboven.

Hier stond dat bedrijfsnaam, kleur en favicon in één configuratiebestand horen —
een omgevingsvariabele in Vercel, want een bestand per bedrijf betekent een tak
per bedrijf. Dat argument klopt nog steeds, maar de oplossing is achterhaald: een
env-var betekent dat de eigenaar ons moet bellen om zijn eigen bedrijfsnaam te
wijzigen, en half november 2026 is er niemand om te bellen. Eén repo blijft één
repo; wat per bedrijf verschilt staat in de database van dat bedrijf.

### De bedrijfspagina

Eén pagina voor de eigenaar, `/beheer/bedrijf`, waar staat wie dit bedrijf is:
naam, kleur, logo, en de handvol regels die per bedrijf verschillen. Nu staat
"Bon" hard in `+layout.svelte` en is er geen `instellingen`-tabel.

**Dit verving wat hier eerder stond.** Dat was: bedrijfsnaam, kleur en
favicon in een configuratiebestand — een omgevingsvariabele in Vercel,
want een bestand per bedrijf betekent een tak per bedrijf en dan is "één repo"
weg. Dat argument klopt nog steeds, maar de database lost hetzelfde probleem
beter op: **een env-var betekent dat de eigenaar de bouwer moet bellen om zijn
eigen bedrijfsnaam te wijzigen.** Half november 2026 is die bouwer er niet meer.
Eén repo blijft één repo; wat per bedrijf verschilt staat in de database van dat
bedrijf, en daar hoorde het al.

#### De drie dingen wegen niet hetzelfde

**Naam is gratis.** Eén tekstveld, plus een korte variant voor smalle schermen.
Gebruik hem ook in het WhatsApp-bericht van fase 9 — "Rooster week 34 — Tjon
Express".

**Kleur is de val.** Geen palet. De statuskleuren in `app.css` zijn taal: groen
is bevestigd, amber is gemeld, rood is mis. Kan de eigenaar die zetten, dan
sloopt hij de betekenis van zijn eigen app. Dus precies één kleur — het accent
voor de kop en de knoppen — als **een rijtje van acht geteste presets met "eigen
kleur" als uitweg**. Anders kiest iemand geel, wordt de witte tekst op de knop
onleesbaar, en heb je een contrastprobleem dat je niet ziet omdat jij het niet
gekozen hebt. Presets lossen meteen de donkere modus op, want elke kleur moet
ook dáár werken.

Zet de kleur server-side als CSS-variabele op `<html>`. Dan is de
voorbeeldweergave gratis: hij klikt een kleur en het scherm slaat om vóór
opslaan.

**Logo is het duurst, en de winst zit ergens anders dan je denkt.** Een upload
is Supabase Storage, een policy, een formaatgrens en een formaatkeuze. **Geen
SVG** — een SVG die je op je eigen domein serveert is een XSS-vector zodra
iemand hem rechtstreeks opent. PNG, vierkant, max ~200 KB.

Het logo in de kop zie je één seconde per bezoek. Het logo als
**beginschermicoon** zie je elke dag, en deze app is bewust geen App Store-app
dus iedereen zet hem op zijn beginscherm. Daar zit de waarde — wat betekent dat
het ook de `manifest.json` en de favicon moet voeden, server-side gegenereerd.
Dat is meer werk dan een plaatje in een header, en het is de reden dat het logo
de tweede stap is en niet de eerste.

#### Wat er nog meer op die pagina hoort

De regel is: alleen een veld als er iets is dat het opeet. Anders bouw je een
formulier dat nergens uitkomt.

| Optie | Wat het opeet | Oordeel |
|---|---|---|
| **Afrondregel** (half uur / kwartier) | `is_half_uur()` én de regel tekst op het scherm | **Ja.** Fase 8 noemt dit al. Echte bedrijfsinfo: het verandert gedrag |
| **Contactpersoon bij vragen** | Eén regel op "er klopt iets niet" — wie bel je | **Ja.** Na het vertrek van de bouwer staat daar niet meer zijn naam |
| **Boekhouder: naam + e-mail** | De export: bestandsnaam en de mailknop | **Ja**, zodra de export verstuurt in plaats van downloadt |
| **Adres / KvK** | De kop van het exportbestand | **Misschien.** Vraag de boekhouder of hij het nodig heeft; zo niet, niet doen |
| **Het verzonnen e-maildomein** (fase 10) | Nu een omgevingsvariabele | **Nee.** Zelfde overdrachtsargument, maar dit wijzigen breekt bestaande logins. Blijft bij de bouwer |
| **Kleur per post** (Bus 2 blauw, Bus 3 groen) | Het rooster | **Nee.** Botst frontaal met de statuskleuren |
| **Lettertype, vrije CSS** | — | **Nee.** Dat is een themabouwer, geen bedrijfsinfo |

#### Wat er omheen moet

**Alleen de eigenaar.** `is_eigenaar()`, niet `mag_beheren()`. Een beheerder
bevestigt diensten; hij bepaalt niet hoe het bedrijf heet.

**Elke wijziging in `mutaties`.** Dat is de gewoonte van deze app, en een
bedrijfsnaam die stilletjes verandert is precies zo'n ding waarvan je later wil
weten wie het deed.

**De leesstand zet deze pagina ook dicht.** Zie `ideeen.md`: de
restrictieve policy hoort ook op de instellingentabel te liggen, anders is dit
het gaatje waar nog wél geschreven kan worden.

#### Volgorde

Naam, kleur en afrondregel eerst — dat is één tabel, één pagina en geen opslag.
Logo daarna, want dat is Storage plus manifest plus favicon. De rest van de
tabel zijn losse velden die je erbij zet op het moment dat het ding dat ze
opeet bestaat.

Dit stond als los idee in `ideeen.md` met de vraag of het er vóór fase 8 kon.
Dat onderscheid hield geen stand: fase 8 is letterlijk "een tweede bedrijf
zonder een `.svelte` aan te raken", en dat is precies wat deze pagina doet. Los
bouwen levert twee halve oplossingen op — een instellingentabel die de helft van
de instellingen kent, en een fase 8 die er alsnog omheen moet. **Sinds
2026-08-25 hoort het hier (fase 8) en niet meer op de ideeënlijst.**

### Wat je per bedrijf nodig hebt

*Opgeschreven toen de vraag kwam wat er eigenlijk aan diensten onder deze app
hangt. De stappen zelf staan in `installatie.md`; hier staat alleen wat het is en
wat het kost.*

| Wat | Per bedrijf? | Kost | Op wiens account |
|---|---|---|---|
| **Deze repo** | Nee, één voor allemaal | — | Jij |
| **Vercel** | Ja, één project | Hobby is niet voor commercieel gebruik; reken op het betaalde plan | Jij |
| **Supabase** | Ja, één project | Betaald, want backups | Jij |
| **Bird** | Nee, één voor allemaal | Per bericht, gedeeld tegoed | Jij |

**Alles op jouw account, en de klant maakt nergens iets aan.** Hier stond het
omgekeerde: alles op de account van de baas, want de bouwer vertrekt. **Dat is
achterhaald (2026-08-25).** Fase 17 heeft die keuze al gemaakt — dit wordt een
saas-abonnement en geen verkoop per installatie, dus de sleutels van elk
Supabase-project blijven permanent bij ons. Dat is model A hieronder, maar dan op
jouw account in plaats van dat van de klant.

Wat het oude bezwaar waard was blijft staan en verhuist alleen: je bent na je
vertrek de beheerder van andermans loongegevens. Bij een verkoop was dat een fout;
bij een abonnement is het het product, en dan hoort er een verwerkersovereenkomst
tegenover te staan. Zie "Wat het met de overdracht doet" verderop.

**Backups zijn de reden om voor Supabase te betalen.** Hier staan de uren waarop
mensen worden uitbetaald. Dat is een ander soort verlies dan een website die een
dag uit de lucht is.

### Eén repo, vier installaties

Vercel kan dezelfde repository naar meerdere projecten uitrollen, elk met zijn
eigen omgevingsvariabelen. Vier bedrijven zijn dan vier Vercel-projecten en vier
Supabase-projecten, met één keer code.

Wat dat betekent:

- **Eén push en ze zijn allemaal bij.** Elke installatie bouwt zichzelf opnieuw.
  Eén verbetering komt overal terecht — en één fout ook, dus dit is precies de
  reden dat je niet op vrijdagavond deployt.
- **De databases blijven gescheiden.** Eigen namen, eigen uren, eigen logins,
  eigen sleutels. Twee bedrijven kennen elkaars bestaan niet, en dat blijft zo:
  dit is geen multi-tenancy en dat is bewust.
- **Maar elke migratie draai je vier keer.** Dat is de prijs van dit model en die
  loopt op met het aantal bedrijven. Houd de `.sql`-bestanden dus op één plek en
  in volgorde, en zet per bedrijf af wat je gedraaid hebt. Bij meer dan twee
  installaties is de Supabase CLI (`supabase db push`) het moment waard.
- **Migratie eerst, deploy daarna.** Altijd in die volgorde. Code die een nieuwe
  kolom nodig heeft valt om op een database waar die kolom nog niet staat, en dan
  krijgt de hele ploeg "nog niet gekoppeld" te zien. Dat is bij fase 10 één keer
  bijna gebeurd; nu staat het hier als regel.
- **Laat de versies niet uit elkaar lopen.** Eén repo betekent dat alle
  installaties dezelfde code draaien. Blijft één bedrijf achter met zijn schema,
  dan moet je code schrijven die met twee schema's overweg kan, en dat is precies
  het soort last waar je hier niet aan wil beginnen.

**Wat er dus per bedrijf verschilt** is geen code maar instelling: de vulling van
`startdata.sql`, en de omgevingsvariabelen in Vercel — de Supabase-sleutels, het
domein voor de verzonnen adressen, en straks de bedrijfsnaam en de kleur. Dat is
ook het argument om die naam in een variabele te zetten en niet in een bestand
dat je commit: een bestand per bedrijf betekent een tak per bedrijf, en dan is
het "één repo" weg.


### Als dit een SaaS wordt

*Opgeschreven toen de vraag kwam wat er gebeurt bij drie klanten, en daarna bij
zestien. Het antwoord verschilt per aantal, en dat is precies het punt.*

Eerst een misverstand uit de weg: **SaaS betekent dat de klant nergens een account
hoeft aan te maken, niet dat er één database is.** Die twee worden vaak
verwisseld, en de keuze eronder is een andere.

| | Wat het is | Wat het kost |
|---|---|---|
| **A. Eén project per klant** | Zoals nu, maar op jouw account. De klant ziet Supabase nooit | Nul codewijziging. Wel per project betalen, en elke migratie zo vaak als er klanten zijn |
| **B. Eén database voor iedereen** | `bedrijf_id` op elke tabel, en in elke policy | Het hele rechtenmodel opnieuw. Eén fout in één policy legt de loongegevens van alle klanten open |
| **C. Schema per klant, één database** | Klinkt als het midden | Slechtste van twee: de migratielast van A én de blast radius van B |

**Bij een handvol klanten is A het antwoord.** Je klant merkt geen verschil, je
code verandert niet, en een fout bij de één kan de ander niet raken — de scheiding
is een aparte database en niet een kolom die iemand kan vergeten.

**Bij een stuk of zestien kantelt het naar B**, en niet omdat zestien veel is maar
omdat de rekening dan gaat praten: zestien betaalde projecten (en backups wil je,
want dit zijn de uren waarop mensen worden uitbetaald) tegenover één. Migreren is
niet het argument — dat is met de Supabase CLI een lus en tien minuten.

**Wat je vóór B geregeld moet hebben**, niet erna:

- **Eén plek waar `bedrijf_id` wordt afgedwongen.** Niet dertig policies die het
  allemaal zelf goed moeten doen.
- **Tests op je policies** die falen zodra iemand data van een ander bedrijf kan
  zien. Bij A is zo'n test aardig; bij B is hij het enige dat tussen jou en een
  datalek staat.

Zonder die twee is B geen kostenbesparing maar een tijdbom onder een
loonadministratie.

### En één klant met vijf zaken is een schemavraag

Vijf aparte platforms voor één eigenaar kan gewoon, met model A. Maar de vraag
eronder is een andere: **wil die eigenaar ooit één overzicht over al zijn zaken?**

Zo ja, dan is dat geen hostingkeuze maar een dimensie die het schema mist: een
*vestiging* naast `posten`, en rollen die per vestiging gelden. Vraag hem dat vóór
je zijn tweede zaak inricht — bouw je het één keer in, dan is het een kolom; kom
je er later achter, dan zit je vijf databases aan elkaar te praten.

### Bird hoeft niet per klant

Sms gaat één kant op en de afzender is jouw platform, dus één Bird-account voor
alle klanten werkt en is de normale vorm. Twee dingen om te weten: het tegoed is
gedeeld — een klant met een drukke ploeg drukt op jouw rekening — en de afzender
is jouw naam en niet die van de klant.

### Wat het met de overdracht doet

Dit stond hier als waarschuwing vooraf en is inmiddels de gekozen weg. Bij een
SaaS ben jíj de eigenaar van de database met hun uren — en daarmee de verwerker
van hun personeelsgegevens. Dan hoort er per klant een verwerkersovereenkomst te
liggen, en dan kun je niet meer weglopen zonder overdracht.

Dat is geen technisch punt en het staat hier ook niet om je tegen te houden. Het
is een ander product dan "geïnstalleerd en verkocht", en dat is precies wat het
geworden is — zie fase 17. Het papierwerk dat erbij hoort staat als losse stap in
`installatie.md`, want het is geen code en wordt daarom vergeten.

**Klaar als:** je een tweede bedrijf hebt opgezet en het enige bestand dat je
hebt aangeraakt `startdata.sql` is. De rest zet de eigenaar zelf, op zijn
bedrijfspagina.

**Niet nu doen.** Dit staat hier zodat het niet in fase 4 tot en met 7 sluipt.
Eerst moet het bij één bedrijf echt werken; een boilerplate van iets dat nog
nooit een maand heeft gedraaid is een boilerplate van je aannames.

---

## Fase 9 — Rooster ✅

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

> **Gedaan.** `/rooster`, `/beschikbaarheid` en `/beheer`.
>
> **Beschikbaarheid staat in twee tabellen** — `beschikbaarheid_standaard` en
> `beschikbaarheid_week` — precies zoals `sjabloon_regels` en `diensten` twee
> dingen zijn. Wat normaal geldt, en wat er deze week van afwijkt. De knop
> "Voortaan ook zo" maakt van een uitzondering alsnog je nieuwe normaal.
>
> **Een week die al loopt ligt vast.** Het scherm laat de knoppen weg en de
> server weigert het ook, want een formulier is zo nagemaakt.
>
> **De view `rooster` was nodig en niet voorzien.** Een bezorger mag via de
> policies alleen zijn eigen diensten zien — daar staan werkelijke tijden in en
> die gaan over geld — maar het weekrooster moet iedereen kunnen zien. Die view
> draait daarom als eigenaar en toont precies wat er nu in de groepsapp hangt:
> dag, bus, naam, geplande tijden. Geen werkelijke tijden, geen opmerkingen.
>
> **Slepen is gesneuveld.** Het werkte niet prettig genoeg, dus indelen gaat met
> keuzelijsten — op de telefoon en op de laptop hetzelfde. Dat het "op allebei"
> moest werken is daarmee eerder gehaald dan met twee bedieningen.
>
> **Een bus of scooter kan maar één keer per dag.** Dat is een afspraak in het
> scherm en geen constraint in de database. Moet er ooit toch een bus tweemaal
> uit, dan is dat een aanpassing hier en geen migratie.
>
> ### En er kwam een beheerscherm bij
>
> Niet gepland, wel nodig: de baas kon geen bus toevoegen, geen diensttijd
> wijzigen en niemand aannemen. Dat ging allemaal via de SQL-editor, en dat
> werkt zolang jij er bent — maar je vertrekt en verkoopt het.
>
> `/beheer` doet posten, dienstsoorten en mensen. Verwijderen kan alleen zolang
> er niets aan hangt; daarna houdt de database het tegen en is non-actief het
> antwoord, zodat oude weken blijven kloppen. Jezelf degraderen kan niet.
>
> **Logins aanmaken hoort erbij**, en dat was de vraag die het scherm
> afdwong: zonder login kan iemand wel ingeroosterd worden maar zijn uren nooit
> melden — en omdat niemand namens hem invult, komt hij dan ook nooit in de
> export. Hij werkt dan wel en wordt niet uitbetaald.
>
> Dat vraagt de beheersleutel van Supabase. Die staat in
> `src/lib/server/beheersleutel.ts` — een `.server.`-bestand dat SvelteKit nooit
> naar de browser stuurt — en wordt alleen gebruikt achter een controle op
> beheerder. Geen uitnodigingsmails: die stranden op de gratis tier en vragen
> dat iemand in zijn mail komt op het moment dat hij wil inloggen, precies de
> stap waar dit project vanaf wilde. Het wachtwoord komt één keer in beeld, en
> daarom is er ook een knop voor een nieuw wachtwoord — één keer verkeerd
> verversen sluit iemand anders definitief buiten.
>
> **En het sjabloon kan er ook in**, op `/beheer/sjabloon`. Wijzigingen gaan in
> per een datum en gooien niets weg — zo blijft terug te zien wie er in maart op
> dinsdag stond. Alleen een regel die nog nooit gegolden heeft mag echt weg.
> De twee uitsluitingen uit `schema.sql` krijgen daar gewone taal: "Die staat op
> die weekdag al ingeroosterd" in plaats van `sjabloon_geen_dubbele_persoon`.
>
> Daarmee hoeft de baas voor het werk zelf niet meer in Supabase. Wat er nog
> overblijft is de wekelijkse uitrol, en die verdwijnt zodra `pg_cron` erop
> staat.

---

## Fase 10 — Gebruikersnaam en profielpagina ✅

**Doel:** inloggen zonder dat er een e-mailadres bij komt kijken, en iedereen
beheert zelf wat van hem is.

Dit was het eerste idee in `ideeen.md` en het stond daar als besloten model. Wat
het oplost: nu logt iemand in met een adres dat hij nooit gebruikt en dat de baas
voor hem verzonnen heeft. Dat is één ding te veel om te onthouden op een telefoon
in de kou, en het is meteen de reden dat er een wachtwoord op een briefje staat.

### Wat erin zit

1. **Een gebruikersnaam per persoon** — `daanb`, uniek, en van de baas. Alleen om
   in te loggen; hij wordt nergens getoond behalve op `/ik` en in het beheerscherm.
2. **Een telefoonnummer per persoon** — van hem zelf en van de baas. Er gaat nog
   niets heen; het veld is de voorwaarde voor herstel per sms en voor ruilen.
3. **`/inloggen` op gebruikersnaam** in plaats van op adres.
4. **`/ik` wordt een profielpagina.** Je eigen gegevens, je telefoonnummer
   wijzigen, en je wachtwoord wijzigen met het huidige erbij.
5. **`/beheer` krijgt die twee velden**, en bij het aanmaken van een login staat
   het adres al voorgesteld.

### Het verzonnen domein hoefde niet

In het idee stond dat de app er zelf een adres van maakt: jij typt `daanb`, de app
logt in als `daanb@<domein>`. Daar hing een blokkerende vraag aan — accepteert
Supabase een domein dat niet bestaat? — en die vraag is nu weg, want het kan
zonder.

De server zoekt het adres op bij de gebruikersnaam en logt daarmee in. Drie dingen
gaan daarmee voor niets meer stuk: het maakt niet uit wat voor adressen er in Auth
staan, de accounts die er al zijn hoeven niet om, en de baas kan een adres in
`/beheer` wijzigen zonder dat er iemand buiten staat.

Wat het kost: opzoeken gaat langs de beheersleutel, want in `auth.users` komt de
gewone sleutel niet. Staat die sleutel niet in `.env`, dan log je in met je
adres — het inlogscherm zegt dat dan ook. Dat is dezelfde sleutel die al nodig is
om een login aan te maken, dus er komt geen voorwaarde bij die er niet al was.

**En niet via de database.** Een functie die voor iedereen een gebruikersnaam naar
een adres omzet zou dit zonder beheersleutel kunnen, maar dat is precies een
lijst van je collega's die je zonder in te loggen kunt aflopen. Het inlogscherm
zegt met opzet niet of een adres bestaat; dat zou je daar aan de achterkant weer
weggeven.

### Wat de database moet weten

Twee kolommen op `personen`, een uniciteitsindex op de gebruikersnaam in kleine
letters, en één regel erbij in `persoon_wijziging_bewaken()`: **van je eigen rij
mag je alleen je telefoonnummer wijzigen.** Dat kan niet in een policy, want die
ziet de rij zoals hij was óf zoals hij wordt, nooit allebei — dezelfde reden als
bij `rol`. De policy erbij zegt alleen dát je aan je eigen rij mag komen; de
trigger zegt waaraan.

Je naam en je gebruikersnaam blijven van de baas. Kan iedereen zijn eigen naam
wijzigen, dan staat er morgen iets anders in het rooster dan gisteren en klopt
geen enkel oud overzicht meer.

**Niet doen:** passkeys, en wachtwoord vergeten per sms. Dat zijn de twee ideeën
die hierop wachten en ze wachten met een reden — eerst dit veld en dit scherm,
dan pas een kanaal erbij.

**Klaar als:** je als Daan inlogt met `daanb` en zijn wachtwoord, op `/ik` je
telefoonnummer wijzigt en je wachtwoord verandert met het oude erbij, en de baas
in `/beheer` voor iemand anders een gebruikersnaam en een nummer kan zetten —
terwijl jij bij die van je collega niet komt, ook niet met een nagemaakt
formulier.

> **Gebouwd, database bij.** `/inloggen` gaat op gebruikersnaam, `/ik` is een
> profielpagina, en `/beheer` heeft de twee velden erbij. `rollen.sql` en
> `profiel.sql` zijn op 19 augustus 2026 gedraaid, in die volgorde, en de drie
> controles erna — kolommen, trigger, policy — staan op true.
>
> **Die volgorde is geen detail.** `rollen.sql` zet zijn eigen versie van
> `persoon_wijziging_bewaken()` neer, zonder de regel over je eigen rij. Draai je
> hem als laatste, dan mag iedereen weer zijn eigen naam en rol zetten en valt er
> niets om — je merkt het niet. De waarschuwing staat nu in beide bestanden.
>
> **Getoetst en het loopt:** inloggen op gebruikersnaam, het telefoonnummer op
> `/ik`, en het wachtwoord wijzigen met het oude erbij. De gebruikersnamen staan
> erin. Wie er nog geen heeft logt in met het adres dat hij al had — dat blijft
> met opzet werken, want anders staat iemand buiten op het moment dat je uitrolt.
>
> Twee dingen kwamen uit het gebruiken zelf en zijn meteen recht gezet: **een
> Nederlands nummer is precies tien cijfers** (een cijfer te veel of te weinig
> merk je anders pas als er iemand niet gebeld wordt — de app rekent het om, de
> database toetst het na), en **na een nieuw wachtwoord stuurt de app je naar het
> inlogscherm**. Dat laatste hing eerst af van wat Supabase met je bestaande
> sessie doet; dan staat er "gewijzigd" op een scherm dat bij de volgende klik
> alsnog wegvalt.
>
> ### De beheersleutel mag niks
>
> Dit kostte de eerste inlogpoging, en het is het soort ding dat je één keer
> tegenkomt: *"de beheersleutel gaat langs alle rechten heen"* is in dit project
> niet waar. De grants in `schema.sql` staan alleen op `authenticated`, en het
> Supabase-project is aangemaakt met "automatically expose new tables" uit — dus
> `service_role` heeft op geen enkele tabel iets.
>
> Dat viel drie fases lang niet op, omdat die sleutel tot nu toe alleen de
> **Auth**-API aanraakte: accounts aanmaken en wachtwoorden zetten gaan langs
> `auth.users` en niet langs een grant. Het opzoeken van een adres bij een
> gebruikersnaam is de eerste keer dat de server met die sleutel een gewone tabel
> leest, en het antwoord was `permission denied for table personen`.
>
> Vandaar één grant in `profiel.sql`: **lezen, en alleen `personen`.** Bouw je
> straks iets waar die sleutel meer nodig heeft — ruilen via sms, een
> agenda-abonnement — dan geef je dat er bewust bij en zie je dat ook in het
> schema staan.
>
> Bijkomend: het inlogscherm zegt bij elke mislukte poging hetzelfde, want het
> verschil verklapt welke namen bestaan. De echte reden gaat naar de serverlog.
> Zonder die regel was dit een middag zoeken geweest in plaats van één blik.
>
> ### En het e-mailveld is weg
>
> Bij "Login aanmaken" typte de baas een adres. Dat hoeft niet meer: de app maakt
> het adres uit de gebruikersnaam. Supabase Auth kan niet zonder adres, maar er
> gaat nooit post heen en niemand logt er meer mee in — dus het is
> loodgieterswerk en geen invoer.
>
> Het veld staat er nog wel, dichtgeklapt, voor precies één geval: weigert
> Supabase het verzonnen domein, dan typ je er een adres in dat wel mag. En
> zonder gebruikersnaam kun je geen login meer aanmaken. Dat is geen drempel maar
> de bedoeling: zo krijgt iedereen er een.

---

## Fase 11 — Ingelogd blijven ✅

**Doel:** de belofte uit fase 2 waarmaken. Eén keer inloggen en daarna nooit
meer.

Dat stond er als aanname — *"sessie lang laten leven, telefoon onthoudt hem"* —
en de klacht was dat het niet zo werkt. Dus eerst uitzoeken en pas daarna
bouwen; een passkey erop zetten zonder te weten waarom mensen eruit vliegen is
een oplossing zoeken bij een symptoom.

### Wat het uitzoeken opleverde

**De cookie was het niet.** `@supabase/ssr` zet hem op 400 dagen, het maximum
dat browsers aanhouden. Dat is nu wel expliciet in `hooks.server.ts` neergezet
in plaats van overgelaten aan een standaard die met een volgende versie kan
veranderen — en meteen op `httpOnly`, wat hij niet was. Dat kan hier omdat deze
app geen browserclient heeft: alles gaat server-side, dus geen enkele regel
JavaScript hoeft die cookie te lezen. Een cookie die scripts niet kunnen lezen,
kunnen ze ook niet stelen.

**Wat het wél was: een storing en een uitlog waren hetzelfde antwoord.**
`veiligeSessie()` gaf bij elke fout van `getUser()` "niet ingelogd" terug, en de
deurcontrole stuurde je dan naar `/inloggen`. Eén hik in het netwerk, één trage
seconde bij Supabase, en je stond op het inlogscherm — terwijl je sessie prima
was. Dat is precies hoe een app de naam krijgt dat je er steeds uit ligt.

Nu zijn het drie antwoorden: ingelogd, uitgelogd, en niet na te gaan. Dat laatste
geeft een 503 met de zin dat je *niet* bent uitgelogd, en dus geen inlogscherm
waar iemand zijn wachtwoord voor gaat opzoeken.

Let op de kant die je makkelijk verkeerd om denkt: **een verlopen refresh token
komt terug als 400, en dat is wél een antwoord.** Zou je alleen 401 en 403 als
antwoord aanmerken, dan krijgt precies degene die echt opnieuw moet inloggen
eindeloos "even geen verbinding". Een storing is wat Supabase zelf niet kon
beantwoorden: geen netwerk, te veel verzoeken, of iets aan hun kant.

**En er kwamen twee foutpagina's bij**, want die waren er niet. `+error.svelte`
voor fouten tijdens het laden van een pagina, en `src/error.html` voor fouten in
`hooks.server.ts` — daar bestaat er nog geen Svelte-app om iets in te tonen, en
juist daar komt die 503 uit. Zonder dat bestand is de vriendelijkste zin van de
app een kale zwart-witte melding.

### De goedkoopste oplossing staat niet in de code

**De app op je beginscherm.** `manifest.webmanifest` lag er al, dus dit kon
altijd al: als icoon geopend heeft de app zijn eigen omgeving en zijn eigen
koekjes, buiten de schoonmaak van de browser om. Dat is nu uitleg op `/ik` — die
zichzelf weghaalt zodra de app al zo geopend is — en dichtgeklapt op het
inlogscherm, waar iemand staat die daar niet wilde zijn.

### En de instellingen zijn nagekeken

Het enige stuk van deze fase dat niet in code te zetten is: **Authentication →
Sessions** in Supabase. Nagekeken en het stond goed, dus de oorzaak zat
werkelijk in onze eigen code:

| Instelling | Stand |
|---|---|
| Enforce single session per user | uit |
| Time-box user sessions | 0 — nooit |
| Inactivity timeout | 0 — nooit |
| Access token expiry | 3600 seconden, de aanbeveling |
| Detect and revoke compromised refresh tokens | aan |
| Refresh token reuse interval | 10 seconden, de aanbeveling |

Die laatste twee zo laten. Dat hergebruikvenster van tien seconden is er precies
voor twee verzoeken die tegelijk aankomen met een net verlopen token — en dat
gebeurt hier, want `app.html` haalt bij hoveren al data op. Zonder dat venster
zou het tweede verzoek de hele reeks tokens laten intrekken en lig je eruit.

De eerste drie staan trouwens op Pro en niet op de gratis tier, dus die konden
het ook niet zijn. Gezien hebben is beter dan aangenomen.

**Niet gedaan: de passkey.** Die staat nog in `ideeen.md` en hij wacht op wat
hierboven opgeleverd wordt: blijkt na deze fase dat mensen er nog steeds uit
vliegen, dan is er een echte reden om hem te bouwen. Zo niet, dan was het een
oplossing voor een probleem dat we net hebben weggehaald.

**Klaar als:** je een week lang niet opnieuw hebt hoeven inloggen, en een korte
storing je geen inlogscherm meer geeft.

---

## Fase 12 — Inloggen met een passkey ✅

**Doel:** inloggen met het gezicht, de vinger of de pincode van je eigen
telefoon. Geen wachtwoord meer om over te typen van een briefje.

Dit stond in `ideeen.md` met een aanname eronder die fout was: *"Supabase Auth
kan dit niet uit zichzelf, dus bouw je WebAuthn zelf om Auth heen."* Er zit wel
een passkey-API in — in `@supabase/supabase-js` 2.112.3, die we al hadden, achter
een vlag `auth.experimental.passkey`. Daarmee viel het duurste deel weg voordat
het begon.

### De tweetraps-API is wat dit ontwerp mogelijk maakt

Naast `signInWithPasskey()`, dat de hele dans in de browser doet, zit er een
lagere laag onder: `passkey.startAuthentication()` en `verifyAuthentication()`,
en hetzelfde paar voor aanmelden. Dat is precies wat deze app nodig had.

Want de eerste ingeving is een browserclient neerzetten, en dan loop je meteen
tegen fase 11 aan: de sessiecookie staat op `httpOnly`, dus JavaScript kan er
niet bij — en een sessie die in de browser ontstaat, komt daar dus nooit in.

Met de tweetraps-API hoeft dat niet:

1. **De server** vraagt de opdracht op bij Supabase (dat vraagt bij aanmelden een
   sessie, en die zit in de cookie).
2. **De browser** doet het enige stukje dat alleen daar kán:
   `navigator.credentials` opent het venster van de telefoon.
3. **De server** laat het antwoord controleren. Bij inloggen ontstaat de sessie
   daar, en `hooks.server.ts` schrijft hem in de cookie — dezelfde weg als bij
   een wachtwoord.

Er komt dus **geen Supabase-client en geen token in de browser.** Dat is niet
alleen netter, het is ook de reden dat fase 11 z'n `httpOnly` mag houden.

### Wat er in de browser staat

`src/lib/passkey.ts`, en verder niets. Het zet de opdracht om van JSON naar
ArrayBuffers en het antwoord weer terug, want WebAuthn werkt met buffers en JSON
kan die niet aan. Nieuwe browsers doen dat zelf — `parseCreationOptionsFromJSON`
en `toJSON` uit WebAuthn niveau 3 — en het handwerk eronder is het vangnet voor
de rest.

Eén ding daarin is geen techniek maar toon: **een weggeklikt venster is geen
fout.** WebAuthn gooit dan `NotAllowedError`, en dat is negen van de tien keer
iemand die op "annuleer" tikt. Daar hoort geen rode balk bij.

### Twee dingen die je alleen merkt door het te doen

**SvelteKit staat geen naamloze actie naast benoemde acties toe.** Het
inlogscherm had een `default`-actie voor het wachtwoord, en de passkey heeft er
twee nodig. Die heet nu `wachtwoord`, en het formulier wijst er expliciet naar.
`svelte-check` ziet dat niet — je merkt het pas op het scherm.

**Het dashboard heeft drie velden, en de poort is de valkuil.** Authentication →
Passkeys vraagt naast de schakelaar om een *Relying Party ID* (`localhost`) en om
*Relying Party Origins*, en die laatste moet exact overeenkomen met de adresbalk,
**poort inbegrepen**: `http://localhost:5173`. Staat daar een andere poort, dan
weigert Supabase zonder dat je ziet waarom.

Wat er terugkomt is trouwens beter dan gehoopt: er zit geen `allowCredentials` in
de opdracht, dus de passkey is *discoverable*. Je hoeft dus **geen gebruikersnaam
te typen** — knop, gezicht, binnen.

### Wat dit betekent voor de installatie

De Relying Party ID is het domein waar passkeys bij horen, en die staat per
Supabase-project. Dat past precies bij hoe dit verkocht wordt: elk bedrijf heeft
zijn eigen project, dus elk project wijst naar zijn eigen domein.

**Maar wat je op `localhost` aanmeldt, werkt niet op het echte domein.** Dat is
geen fout maar de kern van WebAuthn. Bij de deploy in fase 7 zet je hier het
echte domein en `https://…` bij origins, en meldt iedereen zich daar opnieuw aan.
Doe dat dus ná de deploy en niet ervoor.

### Het wachtwoord blijft

Een passkey zit op één toestel. Telefoon kwijt is opnieuw aanmelden, dus het
wachtwoord blijft de weg terug — en de baas kan er nog altijd een nieuw voor je
zetten. Dat staat ook zo op `/ik`, naast de knop. En het is beta: goed genoeg om
te gebruiken, niet om je enige deur te maken.

**Klaar als:** je op `/ik` een passkey aanmeldt en daarna inlogt zonder je
wachtwoord in te tikken.

> **Gedaan.** Aangemeld en ingelogd zonder wachtwoord. Op `/ik` staat een lijst
> van je passkeys met naam en datum, je kunt er een weghalen, en de knop op het
> inlogscherm verschijnt alleen op een toestel dat het kan.

---

## Fase 13 — Wachtwoord vergeten, met een sms ✅

**Doel:** wie zijn wachtwoord kwijt is, komt er zelf weer in. Zonder de baas, en
zonder in zijn mail te hoeven.

Tot nu toe was er precies één weg terug: de baas drukt op "Nieuw wachtwoord" en
leest het voor. Dat werkt, maar het wacht op hem — en op een zaterdagavond is dat
een bezorger die zijn uren niet kan melden.

### De flow

1. **Op het inlogscherm:** een link *"Wachtwoord vergeten?"* naar `/herstel`.
2. **Je tikt je gebruikersnaam in.** Drie mogelijke uitkomsten:
   - **Bestaat niet** → *"Die gebruikersnaam bestaat niet."*
   - **Bestaat, geen telefoonnummer** → *"Vraag een nieuw wachtwoord aan bij je
     werkgever."*
   - **Bestaat mét nummer** → een sms met een eenmalige code en een link.
3. **De link opent hetzelfde scherm**, waar je je gebruikersnaam en de code
   invult. De link is een snelkoppeling, geen sleutel: er zit niets geheims in.
4. **Daarna het volgende scherm:** je nieuwe wachtwoord, twee keer.
5. **En dan word je uitgelogd** en log je één keer opnieuw in. Dat is wat `/ik`
   ook doet na een wachtwoordwijziging, en zo weet je zeker dat het nieuwe
   wachtwoord werkt.

### Eén afloop voor alle gevallen, en hoe we daar kwamen

Dit ging heen en weer, en het is de moeite waard om te weten waarom.

**Eerst zo gebouwd:** een eerlijke melding. Bestaat die gebruikersnaam niet, dan
staat dat er — want de bezorger die `daan` typt in plaats van `daanb` kan er dan
zelf op komen, en dat is de veel waarschijnlijkere gebeurtenis. Een melding die
hem voor een typefout naar de baas stuurt kost twee mensen tijd.

**Daarna omgedraaid**, omdat het beter kan zonder dat je dat verliest. Het
probleem met die eerlijke melding is dat je met namen intikken kunt uitvissen wie
er werkt — precies de enumeratie uit idee 6 in `ideeen.md`. Maar wat je écht wil
is niet een fóutmelding, het is dat iemand *weet wat hij moet doen*. En dat kan
op het volgende scherm staan.

Dus gaat nu **elke uitkomst naar hetzelfde codescherm** — naam bestaat niet, geen
telefoonnummer, vandaag al drie keer gevraagd, sms mislukt, of gewoon gelukt — en
staat daar: *"Komt er geen sms? Dan bestaat die gebruikersnaam niet, staat er
geen nummer bij, of zijn er vandaag al drie codes aangevraagd. Vraag in dat geval
je werkgever."*

Daarmee is er geen verschil meer te meten, en hoeft niemand te wachten op een sms
zonder te weten waarom hij niet komt. De echte reden gaat naar de serverlog.

De enige uitzondering is een storing aan onze kant — geen beheersleutel, database
onbereikbaar. Die zegt het wel, want die gaat niet over dit account.

En de limiet op het aantal pogingen blijft, met een andere reden dan eerst: niet
tegen het aflopen van namen, maar tegen de rekening. Elke poging kan een sms zijn.

### Wat het dicht houdt

- **De code is tien minuten geldig**, en er is er één per persoon: een nieuwe
  aanvraag maakt de vorige ongeldig.
- **Drie pogingen per code.** Zes cijfers zonder limiet is te raden.
- **Drie aanvragen per persoon per dag**, en een limiet per bezoeker op het
  opzoeken van namen. Elke sms is geld.
- **In de database staat alleen de hash** van de code, nooit de code zelf. Een
  databasedump levert dus geen werkende codes op.
- **Tussen scherm 2 en 3 zit een kortlopend koekje.** Anders opent iemand het
  wachtwoordscherm rechtstreeks en zet hij een wachtwoord zonder ooit een code te
  hebben gehad.
- **Je oude wachtwoord blijft werken** tot het nieuwe gezet is. Anders is dit een
  knop waarmee je een collega buitensluit.

### Wat er nieuw is aan de buitenkant

Het versturen zelf zit achter één module. Staan er geen Bird-sleutels in `.env`,
dan zet de app de code in de serverlog en werkt de rest gewoon — dezelfde
opzet als de beheersleutel. Zo is de hele flow te bouwen en te testen voordat er
een sms-account bestaat, en is aansluiten later drie waarden in `.env`.

`/herstel` is het tweede openbare scherm naast `/inloggen`. Dat lijstje is met
opzet kort.

**Klaar als:** je met een vergeten wachtwoord via een sms weer binnen bent, en
iemand zonder telefoonnummer een melding krijgt die hem naar de baas stuurt.

> **Gedaan.** `herstel.sql` is op 21 augustus 2026 gedraaid; de drie controles —
> tabel, functies, en géén policy op die tabel — staan op true. De hele flow is
> doorlopen: gebruikersnaam, code, nieuw wachtwoord, uitgelogd, opnieuw naar
> binnen.
>
> **Zonder Bird werkt het al.** Staan er geen sleutels in `.env`, dan komt het
> bericht in de serverlog. Dat is niet alleen handig om te testen: het betekent
> dat het gesprek met de baas over dat account niet in de weg staat van het
> bouwen. Aansluiten is later drie waarden in `.env`, en de aanroep zelf staat in
> één bestand — `src/lib/server/bird.ts`.
>
> **Wat níét getest is:** die aanroep naar Bird. Er is geen account, dus die vorm
> is op hun documentatie gebaseerd en niet op een geslaagd verzoek. Reken erop dat
> daar bij het aansluiten nog een correctie op moet.
>
> **En een passkey blijft staan na een nieuw wachtwoord.** Meegenomen als controle
> dat fase 12 en 13 elkaar niet in de weg zitten: een wachtwoordwijziging trekt je
> sessies in, maar raakt je passkeys niet. Opnieuw aanmelden hoeft alleen als het
> domein verandert — dus bij de deploy.

---

## Fase 14 — Diensten ruilen ✅

**Doel:** kan iemand een dienst niet, dan regelt hij het zelf — en het rooster in
de app is daarna meteen waar.

Nu gebeurt dat in de groepsapp: *"iemand vrijdag?"*, iemand zegt ja, en dan moet
de baas het nog omzetten. Dat laatste blijft liggen of gaat mis, en dan staat er
in de app iemand anders dan er die avond rijdt.

### Twee soorten verzoek

**Gericht.** Je kiest één collega. Die krijgt een sms met een tekst en een link.
Tikt hij erop, dan logt hij in (of hij is al ingelogd) en krijgt hij de dienst te
zien met ja en nee.

**Open.** Je krijgt een link en zet die zelf in de groepsapp. Wie het eerst
accepteert, krijgt de dienst. Nul sms'jes, en de groep doet het werk.

Dat tweede is de vondst van dit ontwerp. Hier stond eerst een berichtje naar
iedereen die die dag kan — acht man appen is acht keer betalen en zeven keer voor
niets. Nu bedient de app de groepsapp, net zoals fase 9 dat met het rooster doet.

### De link is geen sleutel

Accepteren kan alleen ingelogd. Daarmee is de link een adres en geen geheim:
iedereen in de groep kan erop tikken, maar alleen wie kan inloggen — een collega —
kan accepteren. Doorgestuurd naar buiten levert niets op dan een inlogscherm.

Dat scheelt een hoop: geen geheim in een URL, geen hash in de database, en geen
derde openbaar scherm. En het volgt uit de regel hieronder: **wie die dag vrij is
mag een open verzoek accepteren.** Er valt met die link dus niets af te schermen
wat niet al mag.

Wél nodig: **onthouden waar je heen wilde.** De deurcontrole stuurt je naar
`/inloggen` en vergeet daarna waarvoor je kwam. Dat wordt `?verder=`, met de
controle dat het een pad binnen deze app is — anders is het een open omleiding.

### De regels

- **Alleen een dienst die nog moet komen**, en alleen met status 'verwacht'. Al
  gemeld of bevestigd verzetten is een correctie, en die is van de baas.
- **Eén verzoek per dienst tegelijk.** Gericht óf open. Wel opeenvolgend: zegt
  Omar nee, dan gooi je hem open.
- **Wie die dag vrij is mag accepteren.** Beschikbaarheid is een kleuring en geen
  slot — "ik had weggezet maar ik doe het wel" moet kunnen. Wie die dag al ergens
  staat kan niet, en dat weigert `diensten_persoon_bezet` sowieso.
- **De baas kijkt alleen mee.** Hij hoeft niet te tikken; hij ziet openstaande
  verzoeken en een geruilde dienst valt op in zijn weekoverzicht. Dat is bewust
  zo besloten: twee bezorgers regelen dit, zoals nu in de groep.
- **Intrekken kan**, en dat is geen luxe: die link blijft in de groepsapp staan.
  Vind je iemand in het echt, dan sluit je het verzoek. Verder vervalt hij als de
  dienst begint.
- **Twee mensen die tegelijk tikken** worden in de database beslist, in één
  update. De winnaar ziet zijn week; de verliezer leest *"Omar was je net voor"*
  en geen constraint-fout.

### Wat de database erbij krijgt

Eén tabel `ruilverzoeken` en een handvol `security definer`-functies, om dezelfde
reden als altijd: op `diensten` staat bewust `with check (persoon_id =
huidige_persoon_id())`, dus een bezorger kan een dienst niet op een ander zetten.
Dat slot blijft staan. De functies doen de ruil en controleren zelf alles.

Eén ervan is er alleen omdat de rechten kloppen: **`ruilkandidaten()`**. Een
bezorger mag via `personen` alleen zichzelf zien, dus zonder die functie is er
geen keuzelijstje. Hij geeft naam, kan-die-dag en staat-al-ingeroosterd — geen
telefoonnummers.

En anders dan bij fase 13 komt hier **geen beheersleutel** aan te pas: degene die
accepteert is ingelogd, dus alles gaat met zijn eigen sessie en langs de policies.

**Klaar als:** je een dienst gericht wegvraagt en de ander hem overneemt, en je
een open verzoek in de groepsapp zet waar de eerste die tikt hem krijgt — en in
beide gevallen staat het rooster meteen goed.

> **Gedaan.** Allebei getest: de open link en het gerichte verzoek. Twee dingen
> kwamen pas boven door het te gebruiken.
>
> ### `security definer` gaat niet langs een trigger
>
> Dit kostte de eerste ruil. De functie draait als eigenaar en komt dus langs de
> policies — maar `dienst_wijziging_bewaken()` staat er nog, en die zegt *"alleen
> een beheerder mag het rooster van een dienst wijzigen"* zodra `persoon_id`
> verandert. Precies wat een ruil doet.
>
> Dat slot moest blijven: het is wat verhindert dat een bezorger via de API een
> dienst op een ander zet. De uitweg is een vlag (`app.ruil`) die alleen
> `ruil_accepteren()` zet en die één transactie meegaat. Een client kan hem niet
> zetten — `set_config()` zit in `pg_catalog` en is via de API niet te bereiken.
>
> Bijeffect dat juist goed is: door die deur gaat ook de stempel
> `gemeld_op`/`gemeld_door` niet mee. Een ruil is geen melding; wie hem overneemt
> meldt hem later zelf.
>
> ### De link hoort bij het verzoek, niet bij het scherm
>
> Eerst hield het scherm de link vast na het aanmaken. Die verdween meteen weer,
> want zodra het verzoek bestond sprong de kaart naar de andere tak — en daar
> stond hij niet. Nu wordt hij afgeleid uit het verzoek zelf (`/ruil/<id>`), dus
> hij is er ook nog als je de app morgen opnieuw opent en hem nog eens in de groep
> wil zetten. De link zelf staat niet in beeld; er is alleen een kopieerknop.
>
> ### En het staat ook in het rooster
>
> Erbij gekomen nadat het werkte, en het hoorde er meteen bij: een dienst die
> aangeboden wordt krijgt op `/rooster` een merkje **"wordt aangeboden"** met een
> tik erop om hem over te nemen. Dat is het scherm waar de ploeg de week bekijkt,
> en dus de plek waar iemand denkt *"die kan ik wel"*. Zonder dat moet je in Mijn
> week zijn of in de groepsapp, en dan blijft een aangeboden dienst hangen omdat
> niemand ernaar keek.
>
> Wie hem niet mag overnemen leest dat op het volgende scherm: de database
> beslist, niet die link.
>
> ### Wat er nog niet getoetst is
>
> **De wedloop.** Twee mensen die tegelijk op dezelfde open link tikken — de
> tweede hoort *"Iemand was je net voor"* te krijgen. Dat is één update met een
> where-clause op de dienst zoals hij was, dus het hoort te kloppen, maar het is
> niet met twee echte vingers geprobeerd.

---

## Fase 15 — Je diensten in je eigen agenda ✅

**Doel:** je diensten staan in de agenda die je toch al open hebt, zonder dat je
de app hoeft te openen.

Op `/ik` maak je één link en die plak je in Agenda op je telefoon of laptop.
Daarna staat er per dienst: welke dag, hoe laat, welke bus. Ruilt iemand een
dienst weg, dan verdwijnt hij bij de volgende verversing uit zijn agenda en
verschijnt hij in die van de ander — de lijst ís de waarheid, dus er hoeft niets
afgemeld te worden.

### Dit is de enige plek waar een link écht een geheim is

Bij ruilen (fase 14) bleek dat niet nodig: accepteren gebeurt ingelogd, dus is
zo'n link een adres. **Een agenda-app kan niet inloggen.** Die URL is dus het
enige bewijs, en dat heeft drie gevolgen die er alle drie zijn:

- In de database staat **alleen de hash** van de sleutel. Een dump levert geen
  werkende abonnementen op.
- **"Nieuwe link maken"** is geen gemak maar het enige middel om een oude link
  dood te maken — en dat is nodig, want zo'n URL belandt op plekken waar je hem
  niet meer weghaalt. Gebruik je hem in Google Agenda, dan staat hij op hun
  servers.
- Het opzoeken gaat **via de beheersleutel op de server**, niet via een functie
  die voor `anon` open staat. Anders kan iedereen met de publieke sleutel
  sleutels afvuren op de database.

En je ziet die link één keer, net als een wachtwoord.

### Wat er in staat, en wat niet

Dag, geplande tijden, welke post. **Geen werkelijke tijden en geen opmerkingen**
— dezelfde reden als bij de view `rooster`: dat gaat over geld en dat blijft
tussen hem en de baas. Vier weken terug en alles wat komt.

Besloten bij het bouwen: de titel is **"Werk — Bus 3"**, en er zit **geen
herinnering** in. Wie een melding wil zet die zelf; een opgelegde piep een uur
vooraf is precies waarvoor mensen een abonnement opzeggen.

### Drie dingen die alleen door het te doen bleken

**De deur keek naar het hele pad.** `openbaar` in `hooks.server.ts` vergeleek op
de volledige URL, dus `/agenda/<sleutel>.ics` viel er niet onder en werd naar het
inlogscherm gestuurd — een agenda-app die moet inloggen. Nu vergelijkt hij ook op
wat eronder hangt, met een schuine streep erachter zodat `/agenda-instellingen`
er niet ongemerkt onder valt.

**`mutaties` bleek precies het ontbrekende veld.** Een agenda wil weten wanneer
een gebeurtenis het laatst wijzigde (`LAST-MODIFIED`, `SEQUENCE`), en `diensten`
heeft alleen `aangemaakt_op`. Dat komt nu uit het logboek: de laatste mutatie is
de wijzigingstijd en het aantal mutaties is het versienummer. Geen kolom erbij.

**En de tijdzone is uitgeschreven in plaats van uitgerekend.** Het bestand zegt
`DTSTART;TZID=Europe/Amsterdam` en levert een `VTIMEZONE`-blok mee met de
zomertijdregels. Zo staat 22 augustus op +02:00 en 27 december op +01:00 zonder
dat wij iets omrekenen — en dat is precies het soort fout dat je pas in maart
merkt.

### Lokaal te testen, en dat is niet zelfsprekend

Agenda op een Mac accepteert `http://localhost:5173/agenda/<sleutel>.ics`, en een
telefoon accepteert het IP van je laptop (`npm run dev -- --host`). Alleen Google
Agenda kan niet: die haalt de lijst op met zijn eigen servers en heeft dus een
publieke URL nodig. **Na de deploy verandert het adres**, dus dan abonneert
iedereen zich opnieuw — net als bij de passkeys.

**Klaar als:** je diensten in je eigen agenda staan en een ruil er bij de
volgende verversing in doorkomt.

> **Gedaan en gezien.** In Agenda op de eigen machine, met de link van `/ik`.

---

## Fase 16 — Herstel op je telefoonnummer ✅

**Doel:** wie zijn wachtwoord kwijt is en zijn gebruikersnaam ook, komt er nog
steeds zelf weer in.

Fase 13 vroeg om een gebruikersnaam. Dat leek redelijk tot de vraag kwam: en als
hij die ook niet meer weet? Dan is er geen route meer, en dat raakt de baas het
hardst — een bezorger loopt naar de baas, maar de baas loopt naar niemand.

### Waarom dit een echt gat was en geen luxe

De gebruikersnaam is **niet van de persoon zelf**. Dat staat zo in
`profiel.sql`, en met een reden: de baas verzint hem, zodat er geen tweede lijst
namen ontstaat die niemand bijhoudt. Maar daarmee vraagt de app iemand om iets
te onthouden dat hij nooit zelf gekozen heeft — en dat één keer per jaar nodig
heeft. Zijn telefoonnummer weet hij wél, en hij heeft het toestel in zijn hand.

Dus vraagt stap 1 nu om **een gebruikersnaam of een telefoonnummer**. Eén veld,
geen keuzeknop: je typt wat je weet.

### Hoe de app de twee uit elkaar houdt

In de app aan de vorm, in de database aan de plus. `alsWie()` probeert eerst
`alsTelefoon()`: lukt dat, dan is het een nummer en staat het meteen in één vorm
(`+31612345678`). Lukt het niet, dan moet het een gebruikersnaam zijn. In de
database beslist daarna de plus, want `personen_gebruikersnaam_vorm` staat als
eerste teken alleen a-z en 0-9 toe — dat onderscheid is dus geen gok maar een
regel die er al stond.

Het nummer gaat voor, en dat heeft één rare hoek: een gebruikersnaam die uit tien
cijfers bestaat zou als telefoonnummer gelezen worden. Die bestaat niet en zou
ook niet moeten bestaan — gebruikersnamen zijn `daanb`, geen cijferreeksen — maar
het staat hier zodat het geen verrassing is.

### Twee mensen met hetzelfde nummer krijgen niets

Een huisnummer, twee broers in dezelfde ploeg. `telefoon` is niet uniek en dat
blijft zo — het strenger maken zou het invoeren lastiger maken voor een geval dat
zich zelden voordoet. Maar herstellen kan dan niet: bij twee treffers weet
niemand wiens wachtwoord er gezet moet worden, en **kiezen is hier precies de
fout die je niet wil maken.** Dus geeft `herstel_wie()` bij twee treffers niets
terug, en die twee gebruiken hun gebruikersnaam. Op het scherm staat dat als een
van de redenen waarom er geen sms komt.

### Wat er in het adres staat, en wat er níét in staat

Stap 2 heeft hetzelfde kenmerk nodig als stap 1, dus dat gaat mee in de URL:
`?stap=code&naam=%2B31612345678`. Je eigen nummer, dat je zelf net intikte, in je
eigen adresbalk.

Wat er níét gebeurt: het nummer omrekenen naar de gebruikersnaam en die
meegeven. Dat zou er comfortabeler uitzien en het is precies een gaatje — dan
kan iedereen een nummer intikken en krijgt hij de gebruikersnaam van die persoon
terug. Het kenmerk gaat dus onveranderd door de drie stappen heen.

Dat verandert ook wat de teller in `teVeelGeprobeerd()` doet. Die stond er tegen
de sms-rekening; nu houdt hij ook tegen dat iemand nummers gaat aftasten om te
zien wie er in de ploeg zit. De harde grens (drie codes per persoon per dag)
staat nog steeds in de database.

### Niet meegebouwd: inloggen met je telefoonnummer

Dat lijkt de volgende stap en het is er geen. Inloggen is het moment dat je het
wél weet — je wachtwoordmanager vult je gebruikersnaam in, of je hebt een
passkey en typt helemaal niets. Herstellen is het moment dat je het niet weet.
Alleen die tweede had dit nodig.

### Draaien

`herstel.sql` opnieuw, in zijn geheel. Er staan twee `drop function` regels in,
want een parameternaam wijzigen kan niet met `create or replace` alleen — en een
drop haalt ook de rechten weg. Draai je alleen het middenstuk, dan bestaat de
functie wel en mag `service_role` er niet meer bij; het `grant`-blok onderaan
repareert dat. `schema.sql` is meegewijzigd, dus een verse installatie is nog
steeds één bestand.

**Klaar als:** je op `/herstel` je 06-nummer intikt, een code krijgt en een nieuw
wachtwoord zet — zonder dat je je gebruikersnaam ergens hoefde op te zoeken.

> **Gedaan en gezien.** Met een 06-nummer, de code uit de serverlog, en een nieuw
> wachtwoord erna.

---

## Fase 17 — De superadmin die niemand ziet ✅

**Doel:** één rol boven eigenaar, voor de bouwer. Alles wat de eigenaar kan en
een paar dingen meer, en hij staat in geen enkele lijst — ook niet in die van de
eigenaar.

Waarom dat mag staat in `ideeen.md` en komt hierop neer: dit wordt een
saas-abonnement en geen verkoop per installatie. De sleutels van dit
Supabase-project blijven bij ons, permanent. Deze rol geeft dus geen macht die er
niet al was — hij maakt een nette voordeur voor wat via de sql-editor toch al
kan. Wat er wél verandert is dat het onzichtbaar gebeurt, en daarom hoort het in
het contract en niet alleen in een sql-bestand.

### Het gereedschap: de restrictieve policy

Dit is de eerste keer dat dit project er een gebruikt, en het is precies wat hier
nodig was.

Gewone policies zijn een **of**: er één bij zetten kan alleen méér toestaan. Voor
"niemand mag deze rij zien" had ik dus `personen_lezen` uit `schema.sql` moeten
herschrijven — en dat is nu net de fout die in fase 10 al een keer gemaakt is,
waar `rollen.sql` en `profiel.sql` dezelfde trigger overschrijven en de laatste
wint.

Een **restrictieve** policy is een **en**. Hij komt náást alle bestaande te
staan en kan alleen minder toestaan. Daardoor hoeft geen enkele policy uit
`schema.sql` of `rollen.sql` om, en overleeft `superadmin.sql` het opnieuw
draaien van die twee. Drie stuks:

- **lezen** — `rol <> 'superadmin' or is_superadmin()`. Hij verdwijnt daarmee uit
  elke lijst, telling, keuzelijst en export in één keer, want die vragen het
  allemaal aan dezelfde tabel.
- **toevoegen** — niemand maakt deze rol aan.
- **wijzigen** — `using` houdt iedereen van zijn rij af, `with check` belet dat
  iemand zichzelf of een ander tot superadmin promoveert.

Voor het "dit veld mag jij niet veranderen"-deel is er ook een trigger nodig
(dezelfde reden als bij `rol` in fase 9), en die staat er **naast**
`persoon_wijziging_bewaken()` in plaats van erin. Dat is met opzet: die functie
staat al in drie bestanden en een vierde maakt de val alleen groter. Twee
triggers op dezelfde tabel vuren allebei.

De melding als je het toch probeert is `Deze rol bestaat niet`. Dat is dezelfde
regel als in idee 6: geef geen antwoord waaruit blijkt dat er iets is om te
vinden.

### Wat hij mag

`is_beheerder()` en `is_eigenaar()` rekenen hem mee. Dat is het hele
rechtenverhaal: elke policy in dit schema hangt aan die twee, dus hij krijgt in
één keer alles wat de eigenaar heeft zonder dat er één policy verandert.

Wat hij méér heeft dan de eigenaar is voorlopig één ding: **verwijderen**. Er was
tot nu toe nergens een delete-policy — "iemand hoort op non-actief te gaan, niet
weg" — en daardoor kon een verkeerd ingevoerde persoon nooit meer opgeruimd
worden. Nu kan dat, en alleen door hem.

Let op wat dat niet is: de foreign keys van `diensten` en `sjabloon_regels` staan
zonder cascade. Iemand die ooit gewerkt heeft gaat er dus niet uit, en dat is
goed — bij zo'n verzoek is de vraag niet "mag ik verwijderen" maar "wat gebeurt
er met die uren", en dat is een besluit en geen knop. Wat er nu kan is de
schoonmaak van een fout van vijf minuten oud.

### Niet in te plannen

De restrictieve leespolicy regelt het grootste deel: wie niet in de lijst staat,
wordt niet gekozen. Op drie plekken moest het er met de hand bij:

- **`ruilkandidaten()`** is `security definer` en gaat dus langs RLS heen. Daar
  stond al `p.rol <> 'eigenaar'`; dat is nu `not in ('eigenaar', 'superadmin')`.
  Dit is het patroon om in de gaten te houden: elke definer-functie die mensen
  opsomt moet hem zelf overslaan.
- **`beschikbaarheid()`** slaat hem ook over. Die is invoker en dus al gedekt
  voor iedereen behalve hemzelf — dit is er zodat hij zichzelf ook niet in het
  beschikbaarheidsraster tegenkomt.
- **`magRijden()`** in het roosterscherm gaf `true` voor iemand die het niet mag
  zien. Dat was een echt gaatje en geen theorie: `data?.rol !== 'eigenaar'` is
  ook waar als `data` null is, dus een nagemaakt formulier met een onzichtbaar
  id kwam erdoor. Nu is het `wordtIngeroosterd(data?.rol)`, en die zegt nee bij
  onbekend.

### Wat er nog lekt, en waarom dat blijft

- **Zijn gebruikersnaam is uniek.** Maakt de eigenaar ooit een account met
  dezelfde naam, dan krijgt hij "al in gebruik" voor iets wat hij niet ziet. Dus:
  een naam die niemand kiest.
- **`mutaties` bewaart wie er iets wijzigde.** Nu nog nergens een probleem, want
  geen enkel scherm zet die naam erbij. Komt dat er, dan hoort daar één keer
  besloten te worden wat er staat — "systeem" is het eerlijkste dat nog
  onzichtbaar is.
- **Het Supabase-dashboard laat hem gewoon zien.** Dat is consequent: bij een
  abonnement komt de eigenaar daar niet.

### Wat er niet in zit

Vier van de acht rechten uit `ideeen.md` zijn opzettelijk niet gebouwd, want het
zijn eigen fases met eigen schermen: inloggen als iemand anders, de installatie
in de leesstand zetten, retentie, en de technische overzichten (sms-verbruik,
foutlog, migraties). De rol staat er nu; die kunnen er los bij.

### Hoe hij ontstaat

Niet via een scherm, en dat is het punt. In het dashboard een gebruiker
aanmaken (Authentication → Users → Add user, auto confirm aan), het uuid
kopiëren, en dan de insert die als commentaar onderaan `superadmin.sql` staat.
Inloggen gaat daarna gewoon met die gebruikersnaam — het opzoeken van het
inlogadres draait met de beheersleutel en die gaat langs RLS heen, dus
onzichtbaar zijn belet hem niet naar binnen te komen.

**Draaien:** `superadmin.sql`, en wel **als laatste** — na `rollen.sql` en
`profiel.sql`. Het herdefinieert `is_beheerder()`, `is_eigenaar()`,
`ruilkandidaten()` en `beschikbaarheid()`; draai je één van die bestanden later
opnieuw, dan hoort dit bestand er direct achteraan. Gaat dat mis, dan is het
gevolg dat hij mínder mag dan de eigenaar en weer in de ruillijst staat — geen
stille ramp, maar wel iets wat je moet weten.

**Klaar als:** de eigenaar in `/beheer` de ploeg ziet zonder hem, en hij zelf kan
inloggen en alles ziet.

> **Gedaan en gezien.** Ingelogd als de superadmin: alles zichtbaar. Ingelogd als
> de eigenaar: hij staat er niet.

---

## Fase 18 — De showcase ⏳

**Doel:** één live installatie op een verzonnen bedrijf, die tegelijk je
testomgeving, je verkoopdemo en het speelveld voor je vrienden is.

**Deze fase wordt vóór fase 7 uitgevoerd.** Het nummer volgt wanneer het idee
landde, niet wanneer het aan de beurt is — net zoals fase 8 als laatste komt.

Eén live installatie op een verzonnen bedrijf, die drie dingen tegelijk doet:
jij test het product in het echt, een prospect ziet werkende software in plaats
van een verhaal, en vrienden hebben een account waarmee ze het als gewone
gebruiker gebruiken.

**Hij komt vóór fase 7, en dat is het hele argument.** Dit is de eerste echte
doorloop van `installatie.md`: de hele checklist één keer voor een bedrijf dat
niet boos kan worden. Klopt de volgorde van de sql? Werkt de deploy? Doen
passkeys het op een echt domein? Dat wil je weten vóórdat de eerste klant
meekijkt, niet tijdens.

### Niet de ontwikkeldatabase leegmaken

De verleiding is om dit Supabase-project leeg te gooien en er de showcase van te
maken. Doe dat niet: dan vraag je één omgeving om drie dingen die elkaar bijten.

| | Wil | Botst met |
|---|---|---|
| **Testomgeving** | Kapot mogen zijn | Een prospect die dinsdagochtend meekijkt |
| **Showcase** | Altijd staan en er goed uitzien | Jij die aan fase 8 bouwt, en dus aan het schema |
| **Vrienden als echte user** | Data die blijft staan | Een demo die je wil kunnen resetten |

**Twee Supabase-projecten dus, allebei gratis.** Backups zijn er voor de
loongegevens van echte klanten, niet voor een demo — daar valt de kostenreden
weg. Dit project blijft de breekbare ontwikkeldatabase; de showcase wordt een
nieuw project, en daarmee gewoon klant nul in het model van fase 8.

**Bijvangst.** Een gratis Supabase-project gaat na zeven dagen stilte in de
pauzestand, en een demo die slaapt als er iemand kijkt is dood. Vrienden die hem
echt gebruiken houden hem wakker. Dat is een argument vóór het vriendenplan en
geen bijzaak.

### De demodata is het werk

Dit is het stuk dat bepaalt of de demo verkoopt, en het is meer dan
`startdata.sql` met andere namen. **Een lege demo is een slechte demo:**
`/overzicht` zonder afwijkingen is een leeg scherm en `/export` zonder
bevestigde diensten levert een leeg bestand — precies de twee schermen waar de
baas op let.

Dus een `demodata.sql` met een week of zes geschiedenis. Niet willekeurig
gevuld, maar **rond het verhaal dat verkoopt**: iemand die langer doorwerkte,
een ruil die via de groepsapp rondging, een late melding, en vooral iemand die
zijn dienst vergat en hem de dag erna alsnog invulde. Dat laatste is het hele
product — eindigt de demo daarop, dan heb je het uitgelegd zonder een woord.

**Resetbaar, en zeg dat tegen je vrienden.** Na drie demo's en vier vrienden is
het een rommeltje, dus `demodata.sql` moet leeggooien en opnieuw vullen. Weten
je vrienden dat niet, dan is het geen demo meer maar een applicatie met
gebruikers, en dan kun je niet meer resetten.

### Wat er omheen moet

- **Een demo-strook op elk scherm.** "Dit is een demo, deze mensen bestaan
  niet." Voorkomt dat een prospect denkt dat hij echte loongegevens ziet, en
  voorkomt dat jij ooit de verkeerde installatie openhebt.
- **De reset als superadminknop.** Die rol bestaat al en is onzichtbaar (fase
  17). Dit past er precies in, en het is meteen de eerste keer dat hij iets
  nuttigs doet.
- **De leesstand hergebruiken.** Dat idee staat in `ideeen.md` en is bedoeld voor
  wanbetalers, maar het is exact wat je wil als een prospect na het gesprek zelf
  mag rondklikken: alles zien, niets stuk kunnen maken.
- **Niet Tjon.** Verzonnen bedrijf, verzonnen namen. Een prospect de data van je
  eerste klant laten zien is het verkeerde signaal, ook als het maar bussen zijn.
- **Telefoonnummers alleen als iemand het wil.** Sms-herstel wil een echt
  nummer, en dat is meteen het enige echte persoonsgegeven in de hele demo.
- **Het domein ligt vast zodra de eerste vriend zich aanmeldt.** Passkeys hangen
  aan het domein; verhuizen betekent dat iedereen zich opnieuw aanmeldt.

### De verkooproute

1. Showcase live — de eerste doorloop van `installatie.md`
2. Demo aan Tjon
3. Ja → Tjon is klant 1, en dan draai je de installatie voor de tweede keer, met
   stappen die al bewezen zijn
4. Dubbel bijhouden blijft, maar het is nu onboarding en geen bouwfase

**Voor Tjon doet de demo iets anders dan voor de rest.** Tjon hoeft niet
overtuigd te worden dát het bonnetje een probleem is — dat weten ze. Voor hen
bewijst de demo dat het wérkt. Bij een vreemde prospect moet hetzelfde scherm
ook nog het probleem verkopen. Twee gesprekken, één demo.

### Wat verkopen nodig heeft en er nog niet is

- **Een prijs.** De bodem is bekend: een betaald Supabase-project per klant
  (reken op ongeveer $25 per maand), plus je Vercel-team, plus sms. Onder de €50
  per maand houd je niets over.
- **Een verwerkersovereenkomst.** Staat al in `installatie.md`. Zonder dat kun je
  niet verkopen — niet omdat het niet mag, maar omdat je het bij de eerste vraag
  erover niet hebt.
- **Wat er wel en niet bij zit.** Fase 7 zegt dat al.
- **Wat er gebeurt als jij stopt.** Dit is de enige die echt spannend is.

**Die laatste is urgent geworden in plaats van theoretisch.** Verkoop je Tjon een
gehost abonnement, dan zeg je toe dat je hun loonadministratie blijft draaien
nadat je daar weg bent. Dat is niet fout — het is precies de saas-keuze uit fase
17 — maar het contract moet zeggen wat er gebeurt als je ermee ophoudt.

Het goede nieuws: het antwoord is half af. De export werkt, en bij de leesstand
staat al besloten dat wie opzegt zijn eigen uren mee mag nemen. Dat is de
exit-clausule, en hij zit al in de app. Wat er nog omheen moet is een regel of
drie: opzegtermijn, hoe ze hun data krijgen, en wat er met de installatie gebeurt
als jij ermee stopt.

### Volgorde

Na de Vercel-deploy, want zonder deploy is er niets om te showen. Vóór fase 7.
De demodata is het meeste werk en het minst technische; de rest is
`installatie.md` volgen.

**Klaar als:** een vreemde de app op zijn eigen telefoon kan openen, inloggen, en
een week aan diensten ziet die er echt uitziet — en jij hem daarna met één
opdracht terugzet naar de begintoestand.

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
| ~~`rollen.sql` opnieuw draaien op Supabase~~ | **gedaan, 19 augustus 2026** | Samen met `profiel.sql` en in die volgorde. `huidige_persoon_id()` kijkt nu naar `actief`, dus iemand op non-actief komt ook technisch nergens meer bij |
| ~~`profiel.sql` draaien op Supabase~~ | **gedaan, 19 augustus 2026** | Twee kolommen op `personen`, de uniciteitsindex, de policy op je eigen rij en de trigger erover. Draai je ooit `rollen.sql` opnieuw, dan moet dit bestand er direct achteraan — anders is de regel over je eigen rij weer weg |
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
