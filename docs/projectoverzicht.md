# Urenregistratie Tjon Express

Werkdocument. Bedoeld om mee te starten en om de AI mee aan te sturen tijdens
het bouwen.

---

## Waar dit over gaat

Bij Tjon Express loopt de personeelsadministratie nu via drie losse stappen:

1. **Rooster** — de baas post elke week een rooster in twee WhatsApp-groepen
   (één voor bezorgers, één voor het restaurant). Het rooster is stabiel:
   vaste mensen, vaste bussen, vaste tijden.
2. **Bonnetje** — na je dienst schrijf je op een horecabonnetje je naam,
   datum, tijden en bus. Dat is het bewijs dat je gewerkt hebt.
3. **Excel** — de baas typt die bonnetjes over in een sheet en stuurt die naar
   de boekhouder, die uitbetaalt.

Dezelfde informatie gaat dus drie keer door mensenhanden.

### Het probleem dat echt bestaat

Het rooster in WhatsApp werkt prima. Daar zit geen pijn, dus daar blijven we
vanaf.

De bonnetjes wél. Vergeet je er één, dan moet je terugrijden of een collega
bellen om hem voor je te schrijven — anders krijg je die dag niet uitbetaald.
Dat is een paar keer gebeurd. Gevolg: er wordt soms niet betaald voor werk dat
gedaan is, en soms wél betaald op basis van wat iemand anders opschreef die er
niet bij was.

**Dat is wat deze app oplost: betrouwbaarheid, niet efficiëntie.**

---

## Wat het wordt

Een mobiele webapp (SvelteKit) waar het rooster de invoer is en het
urenoverzicht de output.

De omkering is het hele idee: **nu moet je iets doen om betaald te worden.
Straks hoef je alleen iets te doen als de werkelijkheid afweek van het
rooster.** Het systeem weet al dat jij vrijdag 16:00–21:00 op Bus 3 staat.

### De weekflow als alles staat

| Wanneer | Wat er gebeurt |
|---|---|
| Maandag 00:00 | Systeem rolt het sjabloon uit naar zeven dagen. Alle diensten staan op *verwacht*. Niemand doet iets. |
| Doordeweeks | Iemand kan niet en ruilt. Wijziging gaat in de app; de groepsapp mag blijven bestaan voor het overleg. |
| Na je dienst | Je opent de app, ziet één regel, tikt op "gedraaid". Langer doorgewerkt? `+30` of `+60` en dan bevestigen. |
| Vergeten | Geen probleem meer. De dag erna alsnog invullen. Er komt een vlaggetje bij dat het achteraf was. Geen ritje terug, geen collega bellen. |
| Zondagavond (baas) | Eén scherm. Bovenaan alleen de afwijkingen: ruilingen, late meldingen, niet-gemelde diensten. De rest hoeft hij niet te bekijken. Onderaan totalen per persoon. |
| Eind van de maand | Eén klik export naar de boekhouder. Alleen uren, geen euro's. |

---

## Wat we bewust NIET bouwen

| Niet doen | Waarom |
|---|---|
| **Geen loonberekening** | Minimumloon is leeftijdsafhankelijk en verandert elk halfjaar. Zodra jij euro's uitrekent, ben jij verantwoordelijk voor fouten in iemands salaris. Lever uren; de boekhouder maakt er geld van. |
| **Geen App Store-app** | €100/jaar voor niets. Een mobielvriendelijke webapp die je op je beginscherm zet, doet hetzelfde. Werkt op iPhone én Android, updaten zonder review. |
| ~~**Het rooster niet uit WhatsApp halen**~~ | **Teruggedraaid — zie fase 9 in het bouwplan.** Het bezwaar klopte: haal je het rooster weg en de app hapert één keer, dan is de groepsapp binnen een week terug en heb je twee waarheden. Wat dat oplost is dat de app het WhatsApp-bericht zélf maakt, om te kopiëren en te plakken. Eén waarheid (de app), één kanaal (de groep). WhatsApp wordt niet vervangen maar bediend. |
| **Geen multi-tenancy** | Klassieke plek waar je per ongeluk de uren van bedrijf A aan bedrijf B laat zien. Bouw voor één bedrijf, netjes generiek. Tweede klant = tweede instance. |
| **Restaurantpersoneel nog niet** | Begin met de bezorgers: één rol, tien man, jij zit er zelf in en merkt direct wat niet werkt. Het model kan de keuken later aan. |

---

## Generiek houden

Doel is dat dit later herbruikbaar is voor een ander bedrijf. Dat kost bijna
niks als je het vanaf het begin doet, en veel als je het achteraf moet
ombouwen.

- **Geen "Bus 2" in code** — tabel `posten`. Elders wordt dat keuken, bar, kassa.
- **Geen "Tjon Express" in componenten** — bedrijfsnaam, posten, standaardtijden:
  allemaal data.
- **Sjabloon instelbaar** — het weekrooster is iets wat de klant zelf zet, niet
  iets wat jij per klant in de code aanpast.
- **Code meenemen naar een volgende klant, nooit de data.**

---

## Datamodel

Zie `schema.sql`. Kort:

| Tabel | Waarvoor |
|---|---|
| `personen` | Naam, rol (medewerker/beheerder), actief. Nooit verwijderen — op non-actief zetten, anders verdwijnen mensen uit oude weken. |
| `posten` | Bus 2, Bus 3, Bus 4. Later keuken/balie. |
| `dienstsoorten` | vroeg 15:00–20:00, laat 16:00–21:00. Derde soort toevoegen kan zonder codewijziging. |
| `sjabloon_regels` | Het vaste weekrooster, met `geldig_vanaf` / `geldig_tot` zodat wijzigen de geschiedenis niet aantast. |
| `diensten` | De kern. Eén dag, één post, één persoon. |
| `mutaties` | Logboek van elke wijziging. Zonder bonnetje is dit het enige bewijs bij discussie. |

### Drie keuzes die je moet snappen

1. **Geplande tijden staan als kopie in de dienst**, niet als verwijzing naar
   de dienstsoort. Een dienst is een momentopname; verandert het sjabloon
   later, dan mag de geschiedenis niet meeveranderen.
2. **`persoon_id` staat op de dienst**, niet vast aan de sjabloonregel. Een ruil
   is simpelweg dat veld wijzigen, en de mutatie laat zien wie er oorspronkelijk
   stond.
3. **`werkelijk_begin` / `werkelijk_eind` is wat uitbetaald wordt.** Bij
   "gedraaid zoals gepland" kopieer je gepland naar werkelijk, zodat elke
   betaalde dienst altijd werkelijke tijden heeft en de export nooit hoeft te
   kiezen. De geplande tijden blijven staan als vergelijking.

### Statusflow

```
verwacht  →  gemeld  →  bevestigd     (telt mee in de export)
    ↓
afgemeld / vervallen
```

Medewerker meldt, beheerder bevestigt. Dat is precies de rol die het bonnetje
nu speelt. Als iedereen alles kan wijzigen, heb je het bonnetjesprobleem
digitaal nagebouwd.

### Twee praktische regels

- **Alles binnen één kalenderdag** (14:00–21:00), dus `time` volstaat, geen
  datum+tijd. Wel valideren dat eind na begin ligt.
- **Alleen hele en halve uren.** 21:00 of 21:30, nooit 21:23. Zit als constraint
  in het schema. Invoeren gaat met knoppen (`−30`, `+30`, `+60`), geen
  tijdkiezer — dat prutst niet op een telefoon in de kou.

### Wat het schema zelf al afdwingt

Regels die alleen in het scherm staan, gelden niet — een API-aanroep gaat er
langs. Deze zitten daarom in de database:

- **Niemand staat op twee plekken tegelijk**, en één bus is per starttijd maar
  één keer bezet. Allebei als *partiële* index, zodat een vervallen dienst je
  niet blokkeert als je hem opnieuw moet inplannen.
- **Niet gewerkt is niet gewerkt.** Een afgemelde dienst kan geen werkelijke
  tijden meer bevatten. Anders staat er iets dat niet meetelt in de export maar
  bij discussie wél leest als bewijs dat er gewerkt is.
- **Medewerker meldt, beheerder bevestigt** — afgedwongen met row level
  security, niet met een verborgen knop. Een medewerker komt alleen bij zijn
  eigen diensten, kan de status hoogstens op `gemeld` zetten en mag zijn
  *geplande* tijden niet aanraken. Dat laatste is de achterdeur die er anders
  in zit: geplande eindtijd op 23:00 zetten en dan "gedraaid zoals gepland"
  melden is het bonnetjesprobleem digitaal nagebouwd.
- **Het sjabloon kan geen dubbele regel bevatten** — niet twee keer dezelfde
  post met dezelfde dienstsoort in een overlappende periode, en niemand twee
  keer op dezelfde weekdag. Anders maakt de maandaguitrol er stilletjes twee
  diensten van, of loopt hij elke week stuk.
- **Het logboek vult zichzelf.** Elke wijziging aan een dienst schrijft een
  regel in `mutaties`, via een trigger in de database. Zou de app dat doen,
  dan ontbreekt de regel precies bij de weg waar niemand aan dacht — een
  correctie via de Supabase-console, een script, een tweede scherm.
- **Niets wordt verwijderd.** Personen gaan op non-actief, diensten op
  `afgemeld` of `vervallen`; de database staat verwijderen niet toe. Een dienst
  wissen zou ook zijn logboek meenemen, en dat is het bewijs waar je bij
  discussie op terugvalt.

---

## Bouwvolgorde

Begin bij het einde: de waarde zit in het overzicht dat naar de boekhouder
gaat. Rooster is invoer, bonnetjes zijn ruis.

> Uitgewerkt in `bouwplan.md`, met per fase een "klaar als". Eén afwijking
> daar: **login is naar voren gehaald**, want sinds het rechtenmodel in het
> schema zit hangt elk scherm eraan. Zie de toelichting in dat bestand.

**Weekend 1 — clickable prototype**
Nepdata, geen login, geen database, alleen op je laptop. Week 34 hardcoded.
Doel: kunnen laten zien wat jij ziet, wat de baas ziet, wat de boekhouder
krijgt.

**Daarna:**

1. **Datamodel opzetten** — `schema.sql` draaien, sjabloonregels vullen met
   week 34.
2. **Weekgeneratie** — elke maandag het sjabloon uitrollen naar zeven dagen.
3. **Bezorgerscherm** — mobiel, jouw week, één tik bevestigen, snel afwijken,
   achteraf melden mogelijk.
4. **Bazenscherm** — afwijkingen bovenaan met het verschil erbij
   ("21:00 → 21:30, +30 min"), bevestigen, totalen per persoon.
5. **CSV-export** — pas bouwen als je van de boekhouder weet welk formaat hij
   wil.
6. **Login** — zo simpel mogelijk: inloggen en `personen.auth_user_id` vullen,
   de rechten zelf staan al in het schema. Oorspronkelijk als laatste gepland,
   maar in `bouwplan.md` naar voren gehaald: zolang die kolom leeg is komt de
   app nergens bij, en dan bouw je alle schermen langs de rechten heen om ze
   op het eind alsnog te moeten nalopen.

### Niet vibe-coden

- **Het schema** — klopt dat niet, dan bouw je drie weken lang om een fout heen.
- **De login** — beveiliging die je niet begrijpt, is geen beveiliging.
- **Alles met euro's** — dat bouw je dus überhaupt niet.

---

## Kosten

| Post | Prijs |
|---|---|
| Hosting (Vercel of Netlify) | gratis tot een paar euro/maand |
| Database (gratis tier) | €0 — ruim genoeg voor 10 man en 7 diensten per dag |
| Domein | ~€10/jaar, of gratis onder het domein van de website |
| App Store | niet van toepassing |

Draait dus voor bijna niets. Dat is meteen het argument tegenover Eitje of
Shiftbase (€2–5 per medewerker per maand, dus €240–600/jaar voor tien man).

**Zet het op zijn account, niet op jouw persoonlijke.** Het is zijn bedrijf en
zijn personeelsgegevens, en jij wil dit niet in handen hebben als je ooit stopt
met bezorgen.

---

## Open vragen

### Aan de baas

- [ ] Hoe ziet de Excel eruit? Per dag of weektotaal per persoon? Vraag een lege
      of geanonimiseerde versie — dan bouw je op zijn structuur in plaats van
      een nieuwe die hij moet leren.
- [ ] Hoeveel tijd kost die administratie hem per week? (Bepaalt of dit voor hem
      een project of een hobby is.)
- [x] **Afronden:** klaar om 21:20 — wordt dat 21:30 of 21:00? Naar boven of
      naar het dichtstbijzijnde? Hier bestaat nu een ongeschreven gewoonte, en
      zodra het in een app staat wordt het een regel.
      **Antwoord: het dichtstbijzijnde half uur, knip op `:15` en `:45`.**
      21:10 wordt 21:00, 21:20 wordt 21:30.
- [ ] Werkt het restaurantrooster hetzelfde? Andere dienstlengtes, pauzes? Als
      het afwijkt, wil je dat weten vóór je het model vastzet.
- [x] Wie mag een dienst bevestigen of aanpassen — alleen hij, of ook iemand
      anders? **Antwoord: drie mensen — twee bazen en een manager.**
- [x] Niet-gemelde dienst: vult hij die zelf in op basis van het rooster, of
      moet de medewerker het altijd zelf bevestigen? (Eerste is makkelijker,
      tweede is eerlijker.) **Antwoord: de bezorger meldt zelf. De baas ziet
      wie het nog niet gedaan heeft en kan appen, maar vult niets in.**

### Aan de boekhouder

- [ ] Welk exportformaat? Kolomnamen, per dag of weektotaal, CSV of Excel.
      Past jouw export niet, dan typt de baas het alsnog over en heb je niets
      opgelost.

---

## Waar je op moet letten

**Overgang met dubbel bijhouden.** Twee of drie weken bonnetje én app, zodat de
baas kan vergelijken. Klopt het, dan gaat het bonnetje weg — en hij besluit
dat, niet jij.

**Persoonsgegevens.** Namen en gewerkte uren van personeel. Houd het minimaal:
voornamen en diensten, geen adressen of BSN. Geen publieke URL, wachtwoorden
erop.

**Jouw dubbele pet.** Je bent bezorger én bouwer van het systeem dat jouw uren
registreert. Dat wordt ongemakkelijk zodra er ooit discussie is over een
dienst. Bespreek dat vooraf en zet op papier wat je oplevert en wat er ná
oplevering wel en niet bij zit.

**Verwachting over betaling.** De pijn van de bonnetjes is vooral jouw pijn,
niet die van de baas — een vergeten bonnetje bespaart hem geld. Reken er dus
niet op dat hier meteen een opdracht uit komt. Realistischer: bouw dit als
leerproject en portfoliostuk, laat het draaien met een paar collega's, en als
hij ziet dat het gebruikt wordt komt hij misschien zelf vragen.

**De website blijft prioriteit.** Daar zit zijn eigen probleem (16% commissie
per bestelling) en dat is de opdracht waar geld voor is. Dit project is jouw
vondst — leuker, maar niet urgenter.
