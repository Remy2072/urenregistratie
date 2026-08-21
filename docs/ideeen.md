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
