# Geparkeerde ideeën

Dingen die we bewust níét nu bouwen, maar die te goed zijn om kwijt te raken.
Staat er iets op deze lijst, dan is het een idee en geen belofte — pas als het
een fase in `bouwplan.md` wordt, gaat het gebeuren.

---

## Niet elke keer opnieuw inloggen

**Het idee.** Inloggen is één keer per persoon en daarna nooit meer. Nu moeten ze
het er te vaak weer bij pakken, en een wachtwoord dat je twee keer per jaar typt
ben je kwijt — dan gaat de baas een nieuw wachtwoord voorlezen en is dat precies
de moeite die deze app zou wegnemen. Twee richtingen, in deze volgorde: eerst
zorgen dat de sessie écht blijft staan, en daarna pas een passkey (het gezicht of
de vinger van de telefoon zelf).

### Eerst uitzoeken waaróm ze eruit vliegen

Fase 2 belooft "sessie lang laten leven, telefoon onthoudt hem". Gebeurt dat toch
niet, dan is er iets wat we niet weten — en dat is een middag uitzoekwerk dat een
hele feature kan uitsparen. Kandidaten:

- **De cookie.** `hooks.server.ts` zet wat `@supabase/ssr` meegeeft en vult zelf
  alleen het pad aan. Hoe lang hij geldig is komt dus uit die bibliotheek en niet
  uit onze code. Kijk na wat er echt in de browser staat, en vooral of het een
  sessiecookie is die bij het afsluiten verdwijnt.
- **De instellingen in Supabase Auth.** Time-box user sessions en inactivity
  timeout. Standaard uit, maar dat wil je gezien hebben en niet aangenomen.
- **Het verversen.** Een access token leeft een uur; daarna haalt het refresh
  token een nieuw op. Gaat dat mis, dan ziet het eruit als uitgelogd worden.
- **De browser zelf.** Privémodus, "geschiedenis wissen bij afsluiten", of een
  telefoon die een app die weken stil ligt opruimt. Vraag ze ook gewoon hoe ze de
  app openen — dat is sneller dan het uitzoeken.
- **Op het beginscherm zetten.** `manifest.webmanifest` staat er al, dus dit kan
  vandaag: als icoon geopend heeft de app zijn eigen omgeving en zijn eigen
  koekjes, buiten de browserschoonmaak om. Lost dat het op, dan is het antwoord
  een instructie en geen feature.

### Dan de passkey

Wat het echt beter maakt: er is geen wachtwoord meer om over te typen van een
briefje, en inloggen is een blik op de telefoon. Het haalt en passant de zwakste
plek uit het beheerscherm weg — nu leest de baas een wachtwoord voor en typt de
bezorger het over.

Waar het schuurt:

- **Supabase Auth kan dit niet uit zichzelf.** Voor zover ik weet zit er geen
  WebAuthn in; wat je dan bouwt is zelf de passkey afhandelen op de server en
  daarna alsnog een Supabase-sessie laten ontstaan — bijvoorbeeld met een
  eenmalige link die je met de beheersleutel genereert en meteen inwisselt. Kijk
  dit na vóór je iets belooft, want hier hangt de haalbaarheid aan.
- **Een passkey zit op één toestel**, of in de sleutelhanger van Apple of Google.
  Telefoon kwijt is opnieuw aanmelden, dus er moet een tweede weg blijven: het
  wachtwoord dat de baas opnieuw kan zetten, of herstel per sms.
- **Het gaat over de eerste keer, niet de tiende.** Blijft de sessie staan, dan
  logt iemand twee keer per jaar in. Een passkey maakt die twee keer prettiger —
  het is dus de tweede stap, en het uitzoekwerk hierboven is de echte oplossing.

**Wat hiervoor al gedaan is:** fase 10 in `bouwplan.md`. Inloggen gaat op een
gebruikersnaam en het telefoonnummer staat in `personen` — dat was het deel van
dit onderwerp dat wél nodig was. Wat hier overblijft is de sessie die blijft
staan, en de passkey.

**Volgorde.** Het uitzoekwerk mag altijd. De passkey pas als daaruit blijkt dat
mensen er alsnog uit vliegen, of als het wachtwoord op een briefje echt in de weg
zit.

---

## Superadmin

**Het idee.** Een rol boven eigenaar, voor de bouwer. Kan overal bij, in elke
installatie, en kan dus ook een eigenaar die zijn wachtwoord kwijt is weer
binnenlaten.

**Waarom het aantrekkelijk is.** Nu zit die knop achter precies het account waar
iemand buiten staat. Met twee eigenaren dekken ze elkaar af, maar bij één
eigenaar is de enige uitweg het Supabase-dashboard — en dat is precies wat we
aan het wegwerken zijn.

**Waarom het niet zomaar kan.** Dit project wordt per bedrijf geïnstalleerd op
het account van dat bedrijf, en daarna verkocht. Een rol die de eigenaar niet
kan uitzetten is dan een permanente toegang van de leverancier tot de
personeelsgegevens van zijn klant — namen, uren, telefoonnummers. Dat is geen
technisch probleem maar een afspraak, en die hoort op papier te staan vóór je
hem bouwt.

Drie vormen, oplopend in hoe netjes:

1. **Vaste superadmin.** Eén account dat er altijd is. Makkelijkst, en precies
   waar een klant terecht ongemakkelijk van wordt.
2. **Supportaccount dat de eigenaar aan- en uitzet.** Standaard uit. Gaat aan
   als er iets kapot is, en gaat daarna weer uit. Zichtbaar in het
   beheerscherm, zodat niemand zich hoeft af te vragen of het aan staat.
3. **Tijdelijke toegang op verzoek.** Zelfde als 2, maar hij vervalt vanzelf na
   een dag. Meeste werk, minste uitleg achteraf nodig.

Vorm 2 lijkt de juiste ruil: je kunt helpen als het nodig is, en de eigenaar
houdt de sleutel.

**Wat het niet oplost.** Wie de Supabase-sleutels heeft kan sowieso alles. Een
superadmin in de app is dus geen extra macht — het is een nette voordeur voor
iets wat via de achterdeur toch al kan. Dat is meteen het argument om hem
zichtbaar en uitzetbaar te maken in plaats van stilzwijgend.

### En tot die tijd: de achterdeur zelf

Dit is één keer echt gebeurd, tijdens fase 10, en dan wil je niet gaan zoeken.
Sluit je jezelf buiten, dan zet je in de SQL-editor een nieuw wachtwoord:

```sql
select p.naam, p.gebruikersnaam, u.email
  from personen p join auth.users u on u.id = p.auth_user_id
 order by p.naam;

update auth.users
   set encrypted_password = extensions.crypt('tijdelijk', extensions.gen_salt('bf'))
 where email = 'het adres uit de regel hierboven';
```

Werkt `extensions.crypt` niet, dan staat pgcrypto in `public` en kan het zonder
dat voorvoegsel. Log daarna in met dat tijdelijke wachtwoord en zet op `/ik`
meteen een echte — daar hoort het oude erbij.

*Wat het veroorzaakte staat er niet meer:* "Nieuw wachtwoord" op je eigen account
gooide je eruit terwijl het nieuwe wachtwoord op een scherm stond dat je op dat
moment niet meer mocht zien. Die knop weigert dat nu, in het scherm en op de
server.

---

## Diensten ruilen via sms

**Het idee.** Kan iemand een dienst niet, dan stuurt hij een verzoek naar één
collega: *"Neem jij vrijdag Bus 3 over, 16:00–21:00?"* Die krijgt een sms met een
link. Tikt hij erop en accepteert hij, dan is de dienst weg bij de eerste en
staat hij bij hem in Mijn week. Er hoeft niemand tussen te zitten.

**Gericht, niet rondgestuurd.** Hier stond eerst het omgekeerde: een berichtje
naar iedereen die die dag kan, en wie het eerst reageert krijgt de dienst. Dat is
duurder en rommeliger — acht man appen is acht keer betalen en zeven keer voor
niets, en twee mensen die tegelijk op de link tikken moet je ook nog uitleggen.
In de groepsapp vraag je het ook aan de één van wie je denkt dat hij kan.
Reageert hij niet, dan vraag je de volgende.

Via [Bird](https://bird.com/nl-nl), dat ook het herstel per sms zou doen — dan
is er één sms-kanaal en niet twee.

### De vier stappen

1. **Vragen.** In Mijn week zit bij een dienst die nog moet komen een knop
   "Ruilen". Je kiest een collega uit een lijstje en verstuurt.
2. **De sms.** Eén berichtje: wie het vraagt, welke dag, welke bus, hoe laat, en
   een link met een geheim erin.
3. **Accepteren.** Die link opent een scherm zonder inloggen — de sms ís de
   sleutel — met één knop: "Ik neem hem over".
4. **Verplaatsen.** `persoon_id` op de dienst gaat om. Weg bij de een, zichtbaar
   bij de ander, en `mutaties` legt vast wie er oorspronkelijk stond.

**Wat er al voor klaarligt.** Beschikbaarheid weet wie er die dag kan.
`persoon_id` op de dienst verzetten is één veld, `mutaties` schrijft zichzelf, en
`diensten_persoon_bezet` vangt dat iemand na de ruil niet op twee bussen staat.
De ruil zelf is dus het kleinste deel.

### Wat er nog niet is

- **Nummers die echt ingevuld zijn.** De kolom staat er sinds fase 10, en de
  bezorger mag hem zelf zetten op `/ik`. Maar leeg is leeg: vóór dit iets kan
  doen moet je één keer de ploeg langs. Een verzoek aan iemand zonder nummer moet
  trouwens ook een nette zin geven en geen stille mislukking.
- **Een tabel `ruilverzoeken`:** van wie, aan wie, welke dienst, de status,
  wanneer het verzoek vervalt, en de *hash* van de sleutel — niet de sleutel
  zelf. Een databasedump mag geen werkende links opleveren. Laat Postgres hashen
  (`sha256()` zit in de kern), dan is er één plek waar dat gebeurt.
- **Een weg langs de policies.** Op `diensten_melden` staat bewust `with check
  (persoon_id = huidige_persoon_id())`: een bezorger kan een dienst niet op een
  ander zetten. Dat slot moet blijven staan. De ruil hoort dus in een `security
  definer`-functie die zelf controleert of de dienst van de vrager is, nog op
  'verwacht' staat, of de sleutel geldig en niet verlopen is, en of de ontvanger
  die dag vrij is. Zelfde patroon als `huidige_persoon_id()` en de triggers.
- **Eén openbaar scherm.** `/ruil/<sleutel>` moet werken zonder login. Dat wordt
  de tweede uitzondering in `openbaar` in `hooks.server.ts` naast `/inloggen`, en
  die lijst is met opzet kort — het gaat van een exacte vergelijking naar een
  vergelijking op begin van het pad, dus zorgvuldig doen.
- **De namen van je collega's.** Een bezorger mag via `personen` alleen zichzelf
  zien, dus voor dat keuzelijstje is iets als `ruilkandidaten(dienst)` nodig:
  naam, kan hij die dag, staat hij al ingeroosterd. En of er een nummer bekend is
  als ja of nee — het nummer zelf hoeft nooit in de browser te staan.

### Waar het lastig wordt

Niet in de techniek maar in de regels:

- **Moet de baas erlangs?** Dit voorstel zegt nee: twee bezorgers regelen het,
  zoals nu in de groepsapp. Maar hij moet het wél zien — openstaande verzoeken op
  zijn scherm, en een geruilde dienst die opvalt in het weekoverzicht. Wil hij
  het laatste woord, dan is dat één statusstap extra: geaccepteerd wacht op zijn
  tik. Vraag hem dat vóór je bouwt, want het gaat over wie verantwoordelijk is
  als er niemand komt opdagen.
- **Wat als niemand accepteert?** Dan blijft de dienst van de eerste persoon, en
  dat moet op zijn scherm staan: *"verzoek verstuurd naar Omar, nog geen
  antwoord"*. Anders denkt hij dat hij ervan af is. Een verzoek dat vervalt op
  het moment dat de dienst begint is daar duidelijk over.
- **Wie de link doorstuurt.** Wie de sms heeft kan accepteren, ook zijn broer.
  Dat is dezelfde afweging als bij elke herstel-link: kort geldig en één keer
  bruikbaar is het antwoord, geen tweede slot erop.
- **Alleen vooraf.** Ruilen kan voor een dienst die nog moet komen. Een dienst
  die al gemeld of bevestigd is verzetten is een correctie, en die is van de baas.
- **Wat het kost.** Eén verzoek is één sms, en dat is de goedkoopste vorm die er
  is. Geen herinneringen. Uitzoeken vóór je begint: wat Bird per bericht rekent,
  en of de afzender aangemeld moet worden voordat een Nederlands nummer hem
  binnenkrijgt.

**Volgorde.** Pas nadat het rooster een paar weken echt draait, en niet vóór het
telefoonnummerveld. Dit lost iets op dat nu in de groepsapp gebeurt en daar
werkt. De winst zit ook niet in het ruilen zelf maar erin dat het rooster meteen
klopt: geen bericht meer in de groep waarin twee mensen iets afspreken dat
niemand doorvoert.

---

## Je diensten in je eigen agenda (ics-abonnement)

**Het idee.** Eén keer op een link tikken en daarna staan je diensten in de agenda
die je toch al open hebt — met een melding een uur ervoor als je die zelf aanzet.
Geen scherm dat je moet openen om te weten of je vrijdag werkt, en het rooster
staat naast je college-uren en je vrije dagen in plaats van ernaast.

Niet een export die je één keer downloadt maar een **abonnement**: de agenda haalt
de lijst zelf op. Ruilt de baas een dienst, dan verandert hij daar ook.

### Hoe het werkt

Een agenda-app kan niet inloggen. Het abonnement is dus een adres met een geheim
erin — `/agenda/<sleutel>.ics` — dat teruggeeft wat er in de agenda hoort en niets
meer: dag, geplande tijden, welke bus. Geen werkelijke tijden, geen opmerkingen,
om dezelfde reden als bij de view `rooster`.

Dat is de tweede plek waar een link-met-een-sleutel opduikt; ruilen via sms is de
eerste. Bouw je ze los, dan staat hetzelfde mechanisme twee keer in de app op
twee manieren. **Eén tabel voor sleutels**, met bij elke sleutel waar hij voor is
en van wie, is dan waarschijnlijk de betere ruil — en bewaar alleen de hash,
zodat een databasedump geen abonnementen weggeeft.

En dan langs de rechten heen op dezelfde manier: een verzoek zonder login komt
via de policies nergens, dus dit wordt een `security definer`-functie die zelf de
sleutel controleert en alleen de diensten van díé persoon teruggeeft. Plus een
tweede uitzondering in `openbaar` in `hooks.server.ts`.

### Wat je bij het bouwen tegenkomt

- **De tijdzone, en dit keer echt.** Zet er `DTSTART;TZID=Europe/Amsterdam` met
  een `VTIMEZONE` in, dan hoef je zelf niet te rekenen. Ga je naar UTC omzetten,
  dan doe je zomertijd met de hand en staat één weekend per jaar de hele ploeg
  een uur verkeerd in zijn agenda. `tijd.ts` bestaat precies hiervoor.
- **`UID` moet vast liggen per dienst** — het id van de dienst. Verzin je er elke
  keer een nieuwe, dan komt dezelfde avond bij elke verversing opnieuw in de
  agenda te staan.
- **En dan mist er iets in het schema:** een agenda wil weten wanneer een gebeurtenis
  het laatst wijzigde (`LAST-MODIFIED`, `SEQUENCE`), en `diensten` heeft alleen
  `aangemaakt_op`. Dat is te halen uit de laatste regel in `mutaties` voor die
  dienst — mooi bijeffect van het logboek — of het wordt een kolom.
- **Weggehaalde diensten verdwijnen vanzelf.** De lijst ís de waarheid: staat een
  vervallen of weggeruilde dienst er niet meer in, dan haalt de agenda hem weg.
  Geen afmeldberichten nodig.
- **Hoe ver terug.** Alleen wat komt, plus een paar weken geschiedenis. Anders
  groeit het bestand elk jaar en leest niemand het oude deel ooit terug.

### Waarom "meteen" niet klopt

De agenda bepaalt zelf hoe vaak hij kijkt, en dat kan bij Google een paar uur tot
een dag zijn. Je kunt een verversingstijd meegeven (`REFRESH-INTERVAL`,
`X-PUBLISHED-TTL`) maar het is een suggestie. Een ruil van vanmiddag staat dus
misschien pas morgen in je agenda — en daarom blijft de app de plek waar het
rooster écht staat en is dit een gemak erbovenop. Zo moet je het ook uitleggen,
anders vertrouwt iemand zijn agenda op een avond dat het net veranderd is.

**De goedkope versie** — een knopje "zet in mijn agenda" per dienst dat één
`.ics`-bestandje geeft — is een middag werk, heeft geen geheime link nodig en
staat er meteen in. Maar je doet het per dienst, en een ruil volgt niet mee. Als
opstapje is het prima; als eindpunt gaat iedereen het na twee weken vergeten.

**Waar de link komt te staan.** Op `/ik`, dat sinds fase 10 een profielpagina is:
één knop om hem te kopiëren en één om een nieuwe te maken — waarmee de
oude vervalt, net als bij "Nieuw wachtwoord". Op een iPhone opent zo'n link
meteen de vraag of je je wil abonneren; bij Google Agenda moet het via "agenda
toevoegen → via url", en dat gaat op een telefoon niet. Reken erop dat je het
voor de helft van de ploeg één keer moet voordoen.

**Volgorde.** Na het rooster (fase 9 staat er) en niet vóór het sleutelmechanisme
waar ruilen ook op leunt. Dit is het soort feature dat een app aardig maakt in
plaats van nodig, dus hij hoort achter de dingen die nodig zijn.
