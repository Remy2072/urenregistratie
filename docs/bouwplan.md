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
| 7 | Overgang | Het bonnetje mag weg | 3 weken doorlooptijd |

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

## Fase 1 — Schema live

**Doel:** een fundament waarvan je hebt gecontroleerd dat het klopt, niet
waarvan je aanneemt dat het klopt.

1. Supabase-project aanmaken, `schema.sql` in één keer draaien.
2. Beheerder toevoegen (die regel staat uitgecommentarieerd onderaan het
   bestand). Zonder beheerder kan niemand bevestigen.
3. `sjabloon_regels` vullen met week 34: per weekdag welke persoon op welke
   post welke dienstsoort draait.

Dan de constraints **expres kapot proberen te maken**. Dit is de enige fase
waarin dat nog goedkoop is:

| Probeer | Verwacht |
|---|---|
| Dienst met `werkelijk_eind = '21:23'` | Faalt op `dienst_halve_uren` |
| Twee diensten, zelfde persoon, zelfde dag | Faalt op `diensten_persoon_bezet` |
| Status `afgemeld` mét werkelijke tijden | Faalt op `dienst_niet_gewerkt_geen_tijden` |
| Sjabloonregel die een bestaande overlapt | Faalt op `sjabloon_geen_dubbel_slot` |
| Een dienst updaten | Zet een regel in `mutaties` |

Falen alle vier de eerste en verschijnt die laatste regel, dan staat het
fundament. Zo niet, dan wil je dat nu weten en niet in fase 5.

**Klaar als:** die tabel klopt en `select * from uren_export` draait (leeg is
goed).

**Op wiens account.** In `projectoverzicht.md` staat: zijn account, niet het
jouwe. Dat blijft kloppen, maar niet vanaf minuut één — je gaat hem geen
Supabase-account laten aanmaken voor iets wat hij nog niet gezien heeft. Draai
fase 0 en 1 op je eigen gratis project met **verzonnen namen**. Zodra er echte
namen en gewerkte uren in gaan — dat is fase 4 — verhuis je. Op dat moment is
verhuizen ook nog niets: `schema.sql` opnieuw draaien en het sjabloon
overtypen.

---

## Fase 2 — Login

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

---

## Fase 3 — Weekgeneratie

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

---

## Fase 4 — Bezorgerscherm

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

**Blokkerende vraag:** wat gebeurt er bij 21:20? De database staat alleen hele
en halve uren toe, dus de `+30`-knop dwingt al een keuze af. Welke kant je
afrondt is aan de baas, en dat wil je weten vóór je deze knoppen bouwt — daarna
is het een regel waar mensen zich naar gaan gedragen.

**Hier komt de opsplitsing in componenten.** In het prototype staat alles nog
in drie pagina's, en dat is daar prima: die schermen waren om te laten zien,
niet om te onderhouden. Vanaf deze fase ga je er echt in werken, en dan wil je
de meldkaart, de statusmerkjes, de tijdstappers en de dienstregel als losse
componenten hebben. Doe die splitsing aan het begin van de fase, niet aan het
eind — dan bouw je de rest er meteen mee.

**Klaar als:** jij een volle week je eigen diensten meldt zonder één bonnetje te
schrijven. Vanaf hier draait dit naast het bonnetje, niet in plaats daarvan.

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

## Fase 5 — Bazenscherm

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

**Blokkerende vragen:** mag iemand anders dan de baas bevestigen? En: vult hij
een niet-gemelde dienst zelf in op basis van het rooster, of moet de medewerker
het altijd zelf doen? Het eerste is makkelijker, het tweede is eerlijker — en
het bepaalt of dit scherm een "invullen namens"-knop krijgt.

**Klaar als:** de baas een echte week doorloopt en niets hoeft op te zoeken.

---

## Fase 6 — Export

**Doel:** de boekhouder hoeft niets over te typen.

De view `uren_export` staat er al. Wat er nog bij komt is een knop die er een
bestand van maakt over een periode.

**Blokkerende vraag — en dit is de enige die de hele fase tegenhoudt:** welk
formaat wil de boekhouder? Kolomnamen, per dag of weektotaal, CSV of Excel.
Vraag een lege of geanonimiseerde versie van de huidige sheet. Bouw je dit op
gevoel, dan typt de baas het alsnog over en heeft het hele project niets
opgeleverd.

Nooit euro's. Uren eruit, loon is zijn werk.

**Klaar als:** de boekhouder het bestand opent en zegt dat het klopt.

---

## Fase 7 — Overgang

**Doel:** het bonnetje mag weg — en hij besluit dat, niet jij.

Twee tot drie weken dubbel bijhouden: bonnetje én app. Elke week vergelijken.
Zit er verschil in, dan is dat een bug of een misverstand over de regels, en
allebei wil je die nu vinden.

Zet vóór deze fase op papier wat je oplevert en wat er ná oplevering wel en niet
bij zit. Je bent bezorger én bouwer van het systeem dat jouw uren registreert;
dat wordt ongemakkelijk op het moment dat er discussie is over een dienst, en
dat moment is precies het verkeerde om er dan pas over te beginnen.

**Klaar als:** de baas zegt dat de bonnetjes weg kunnen.

---

## Open vragen, gekoppeld aan hun fase

| Vraag | Blokkeert | Aan wie |
|---|---|---|
| Afronden: 21:20 wordt 21:00 of 21:30? | Fase 4 | Baas |
| Wie mag bevestigen? | Fase 5 | Baas |
| Niet-gemelde dienst: namens invullen? | Fase 5 | Baas |
| Exportformaat | Fase 6 | Boekhouder |
| Hoe ziet de huidige Excel eruit? | Fase 6 | Baas |
| Werkt het restaurantrooster hetzelfde? | Ná fase 7 | Baas |

De eerste vier moet je op tijd stellen. De laatste is geen blokkade maar
bepaalt of het model straks de keuken aankan, dus je wil het antwoord vóór je
iets herbouwt om restaurantpersoneel toe te laten.

---

## Wat in geen enkele fase gebouwd wordt

Staat ook in `projectoverzicht.md`, maar hier omdat scope juist tijdens het
bouwen uitloopt en niet tijdens het plannen: geen loonberekening, geen App
Store-app, geen rooster in de app, geen multi-tenancy, geen restaurantpersoneel.

Komt er tijdens een fase iets bij dat hier niet in staat, dan is dat geen
uitbreiding maar een volgende fase. Schrijf het op en maak eerst af waar je mee
bezig was.
