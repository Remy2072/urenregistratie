# Geparkeerde ideeën

Dingen die we bewust níét nu bouwen, maar die te goed zijn om kwijt te raken.
Staat er iets op deze lijst, dan is het een idee en geen belofte — pas als het
een fase in `bouwplan.md` wordt, gaat het gebeuren.

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

_Wat het veroorzaakte staat er niet meer:_ "Nieuw wachtwoord" op je eigen account
gooide je eruit terwijl het nieuwe wachtwoord op een scherm stond dat je op dat
moment niet meer mocht zien. Die knop weigert dat nu, in het scherm en op de
server.

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

Dit is de enige plek in de app waar een link écht een sleutel moet zijn, en dat
is bij het bouwen van fase 14 duidelijk geworden: ruilen leek er ook een nodig te
hebben, maar daar kon het zonder. Accepteren gebeurt daar ingelogd, dus is de link
een adres. Een agenda-app kan niet inloggen, en daarom kan het hier niet zonder.

Reken er dus niet op dat er al een sleutelmechanisme ligt om op te leunen — dat
komt met dit idee zelf. Bewaar alleen de hash, zodat een databasedump geen
abonnementen weggeeft.

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

**Volgorde.** Dit is het soort feature dat een app aardig maakt in plaats van
nodig, dus hij hoort achter de dingen die nodig zijn. En hij staat er alleen voor:
het sleutelmechanisme dat hij nodig heeft bestaat nog niet en komt niet ergens
anders vandaan.

---

## Eén antwoord voor alles wat je niet mag zien

**Hoe het heet.** 404 masking, ook wel cloaking: in plaats van een eerlijke
403 Forbidden geef je 404 Not Found, zodat je niet verklapt dát iets bestaat.
Formeel is het **CWE-204, Observable Response Discrepancy**; bij OWASP valt het
onder Broken Access Control. Het blokkeert _resource enumeration_, en de variant
die we hier al toepassen is _user enumeration_ — "wachtwoord onjuist" versus
"onbekend account" is precies zo'n verschil. GitHub doet het letterlijk zo: geen
toegang tot een private repo betekent dat de repo niet bestaat.

**Wat deze app al zo doet.** Het inlogscherm zegt bij een onbekende
gebruikersnaam, een onbekend adres en een verkeerd wachtwoord hetzelfde: _"klopt
niet."_ De echte reden gaat naar de serverlog. Die keuze had alleen nog geen naam,
en nu wel.

**En het herstelscherm uit fase 13 doet het ook.** Daar leidt elke uitkomst naar
hetzelfde volgende scherm — naam bestaat niet, geen telefoonnummer, limiet
bereikt, of gelukt — met op dat scherm de zin wat je moet doen als er geen sms
komt. Dat was er eerst een eerlijke melding, en het omdraaien kostte niets: wat
iemand nodig heeft is niet weten wélke van de drie het was, maar weten dat hij
naar de baas moet.

### Waarom de rolschermen zo blijven

`/overzicht`, `/beheer` en `/export` zeggen nu "alleen voor de baas" met een
gewone 200. Dat lijkt het geval waar dit voor bedoeld is, en toch is het het
niet:

- **De routes zitten in de clientbundel.** SvelteKit levert zijn routelijst mee
  aan de browser, dus die adressen zijn uit de JavaScript te halen wat de server
  ook antwoordt. Een 404 verbergt daar niets — hij liegt alleen, en niet eens
  overtuigend.
- **Het is geen geheim.** Er werken tien mensen en ze weten allemaal dat er een
  bazenscherm is. Verbergen dat iets bestaat werkt alleen als het bestaan zelf
  informatie is.
- **Het slot zit elders.** Komt een bezorger op `/overzicht`, dan geeft row level
  security hem zijn eigen rijen en niets meer. Dat is de beveiliging; het scherm
  is opruiming.
- **En het kost iets.** De baas die zich vertypt krijgt "bestaat niet" in plaats
  van een zin die hem verder helpt.

### Waar het wél moet, en daar is het geen luxe

Het idee met een sleutel in het adres: **een agenda-abonnement**
(`/agenda/<sleutel>.ics`). Daar is het adres wél te raden, en daar is elk verschil
in het antwoord een gratis hint. Eén antwoord dus voor: sleutel bestaat niet,
sleutel is verlopen, abonnement is opgezegd.

*Ruilen leek hier ook bij te horen en hoort er niet bij.* `/ruil/<id>` vraagt een
login, dus is dat id geen geheim — en wie mag accepteren wordt in de database
bepaald en niet door het kennen van een adres. Dat is de betere oplossing van
hetzelfde probleem: geen geheim dat je moet beschermen.

Drie dingen om het echt gelijk te houden:

- **Dezelfde statuscode en dezelfde body.** Niet "verlopen" op het ene scherm en
  "onbekend" op het andere.
- **Hetzelfde werk.** Een vroege `return` die de database niet eens raakt is
  meetbaar sneller dan een antwoord dat wel een query doet. Doe de opzoeking dus
  altijd, ook als je al weet dat je nee gaat zeggen. Om microseconden hoef je je
  niet te bekommeren; om een ontbrekende databasevraag wel.
- **De echte reden in de serverlog**, zoals bij het inloggen. Anders is dit
  onderhoudbaar noch te debuggen.

**Volgorde.** Geen los werk. Dit is een regel die meegaat op het moment dat die
twee ideeën gebouwd worden — en tot die tijd staat hij hier zodat hij niet
opnieuw bedacht hoeft te worden.
