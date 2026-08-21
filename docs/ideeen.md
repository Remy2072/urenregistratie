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

**Het is geen verkooppunt.** Hier stond eerder dat de installatie per bedrijf
wordt verkocht, en dat een rol die de eigenaar niet kan uitzetten dus permanente
toegang van de leverancier tot de gegevens van zijn klant is. Dat klopt niet
meer: het wordt een saas-abonnement (gezegd 2026-08-21). De installatie gaat
nooit over. Hij blijft draaien op een Supabase-project dat wij beheren en de
klant betaalt voor toegang -- dus liggen de sleutels toch al bij ons, permanent,
en niet tot een overdracht die er nooit komt. Het zwaarste bezwaar tegen deze
rol was daarmee een bezwaar tegen een model dat we niet gaan doen.

**Waar het dan wél om gaat.** Niet of wij erbij kunnen, want dat kunnen we
sowieso. Wel of de klant kan zien wanneer. Dat is een gewone saas-vraag en elke
saas beantwoordt hem hetzelfde: er is supporttoegang, hij staat in het contract,
en hij laat een spoor na. De verwerkersovereenkomst verhuist daarmee van
voorwaarde-voor-deze-rol naar voorwaarde-voor-het-abonnement: die heb je vanaf
de eerste betalende klant nodig, met of zonder superadmin.

**Besloten op 2026-08-21: hij wordt onzichtbaar.** Er waren drie vormen in de
running -- een vast account, een supportaccount dat de eigenaar aan- en uitzet,
en toegang die na een dag vervalt. Het is de eerste geworden, en dan strenger:
niemand ziet hem staan, ook de eigenaar niet.

Dat is een keuze en geen vergissing, dus staat hier waar hij op rust: het is een
abonnement op onze installatie, wij hebben de sleutels toch al, en een schakelaar
die de eigenaar moet omzetten is nu juist onbereikbaar voor de eigenaar die
buitengesloten is -- precies het geval waarvoor dit bestaat.

Eén ding hoort daar hard bij: onzichtbaar plus alle rechten betekent dat het
logboek het laatste slot is, en dat hij dat zelf kan openen. Dat valt technisch
niet op te lossen. Het is wat er in het contract moet staan.

**Wat het niet oplost.** Wie de Supabase-sleutels heeft kan sowieso alles, en
dat zijn wij, blijvend. Een superadmin in de app is dus geen extra macht -- het
is een nette voordeur voor iets wat via de achterdeur toch al kan, met als enige
echte winst dat het zichtbaar is. Dat is meteen het argument om hem te loggen in
plaats van hem stil te houden.

**En als het ooit één database wordt.** In fase 8 staat de vraag: per bedrijf
een eigen Supabase-project (model A) of één database met `bedrijf_id` (B en C).
Bij A is superadmin niets anders dan gemak -- je hebt de sleutels van elk project
al. Bij B en C is deze rol het échte mechanisme, en dan is hij geen gemak meer
maar de scheiding tussen klanten zelf: een superadmin die per ongeluk over
`bedrijf_id` heen kijkt is een datalek en niet een bug.

### Wat hij moet kunnen

Alles wat de eigenaar kan, en dan een paar dingen die de eigenaar met opzet niet
kan. Op volgorde van hoe hard ze nodig zijn:

1. **Iemand echt verwijderen.** Er staat nu nergens een delete-policy -- "iemand
   hoort op non-actief te gaan, niet weg". Dat is goed voor de boekhouding en het
   maakt twee dingen onmogelijk: een verkeerd ingevoerde persoon opruimen, en een
   wisverzoek uitvoeren. Dat tweede is geen luxe maar avg artikel 17, en de
   eigenaar kan er vandaag niets mee.
2. **Een eigenaar aanstellen.** Alleen een eigenaar mag een eigenaar wijzigen
   (`persoon_wijziging_bewaken`). Vertrekt de enige eigenaar, dan kan niemand de
   volgende benoemen. Dit is het supportverzoek dat gegarandeerd komt.
3. **Een wachtwoord of passkey zetten voor wie dan ook**, de eigenaar incluis.
   Het geval waarvoor dit idee ooit begon.
4. **De installatie in de leesstand zetten.** Abonnement niet betaald, of een
   overname die nog niet rond is: alles blijft leesbaar, er kan niets bij. Dit is
   het enige recht dat de eigenaar écht niet mag hebben -- anders zet hij het
   terug.
5. **Technische dingen die nu geen scherm hebben.** Welke migraties er gedraaid
   zijn, hoeveel sms'jes er deze maand heen gingen en wat dat kost, de foutlog,
   hoeveel agendasleutels er actief zijn. Geen macht over mensen, maar het
   verschil tussen "ik kijk ernaar" en "stuur eens een schermafdruk".
6. **Oude weken echt opruimen.** Retentie is een besluit dat niemand met de hand
   hoort te nemen en dat de eigenaar niet zou moeten kunnen.
7. **Inloggen als iemand anders.** Het krachtigste en het enige waar ik zou
   aarzelen: je ziet dan iemands uren, en uren zijn geld. Als het er komt, dan
   met een regel in `mutaties` die er niet uit te halen is.
8. **Over een afsluiting heen corrigeren.** Nog niet van toepassing: weken kunnen
   nu niet op slot. Zodra een geëxporteerde week wél vastgezet wordt, hoort de
   uitzondering hier te liggen en niet bij de baas.

### Wat "onzichtbaar" betekent in dit schema

Het goede nieuws is dat row level security het grootste deel gratis doet. Voeg
aan `personen_lezen` toe dat een rij met `rol = 'superadmin'` niet meegaat, en
hij verdwijnt in één keer uit elke lijst, elke telling, elk uitklapmenu en elke
export -- want die vragen het allemaal aan dezelfde tabel. Niet in te plannen is
daarmee ook geregeld: wie niet in de lijst staat wordt niet gekozen, en diensten
hoort hij helemaal niet te hebben.

Wat er wél met de hand bij moet:

- **`is_beheerder()` en `is_eigenaar()` moeten hem meerekenen.** Anders heeft hij
  minder rechten dan de eigenaar in plaats van meer.
- **Niemand mag hem maken of wijzigen.** In `persoon_wijziging_bewaken()` erbij:
  een rij met deze rol is voor iedereen verboden terrein, en de rol is niet uit
  te delen. Hij ontstaat één keer via de sql-editor met de servicesleutel, en dat
  is de enige weg.
- **Het logboek verraadt hem.** `mutaties` bewaart wie er iets wijzigde, en de
  bazenschermen zetten daar een naam bij. Een naam die niet gelezen mag worden
  wordt een leeg vakje of een los id, en dát valt op. Er moet dus één keer
  besloten worden wat er dan staat -- "systeem" is het eerlijkste dat nog
  onzichtbaar is -- en dat moet overal hetzelfde zijn.
- **Zijn gebruikersnaam is uniek.** Probeert de eigenaar ooit een account met
  dezelfde naam te maken, dan krijgt hij "al in gebruik" voor iets wat hij niet
  ziet. Neem een naam die niemand kiest.

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

### Waar het wél moet, en daar is het al gedaan

**Het agenda-abonnement** (`/agenda/<sleutel>.ics`, fase 15). Daar is het adres
wél te raden en is elk verschil in het antwoord een gratis hint, dus geeft die
route één antwoord voor alles: sleutel bestaat niet, sleutel is ingetrokken,
persoon heeft geen diensten. Alle drie een 404 zonder uitleg — en een agenda-app
leest toch geen foutmeldingen.

*Ruilen leek hier ook bij te horen en hoort er niet bij.* `/ruil/<id>` vraagt een
login, dus is dat id geen geheim — en wie mag accepteren wordt in de database
bepaald en niet door het kennen van een adres. Dat is de betere oplossing van
hetzelfde probleem: geen geheim dat je hoeft te beschermen.

Wat hiervan overblijft is dus geen werk maar een regel, voor de volgende keer dat
er een adres met een sleutel erin bij komt. Drie dingen om het echt gelijk te
houden:

- **Dezelfde statuscode en dezelfde body.** Niet "verlopen" op het ene scherm en
  "onbekend" op het andere.
- **Hetzelfde werk.** Een vroege `return` die de database niet eens raakt is
  meetbaar sneller dan een antwoord dat wel een query doet. Doe de opzoeking dus
  altijd, ook als je al weet dat je nee gaat zeggen. Om microseconden hoef je je
  niet te bekommeren; om een ontbrekende databasevraag wel.
- **De echte reden in de serverlog**, zoals bij het inloggen. Anders is dit
  onderhoudbaar noch te debuggen.

**Volgorde.** Geen los werk, en niets meer te bouwen: waar het moest is het
gedaan. Dit staat hier als regel voor de volgende keer, zodat hij niet opnieuw
bedacht hoeft te worden — en zodat niemand hem per ongeluk overal gaat toepassen.
