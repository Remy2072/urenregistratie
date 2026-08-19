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

---

## Diensten ruilen via sms

**Het idee.** Kan iemand een dienst niet, dan stuurt de app een berichtje naar
de anderen die die dag beschikbaar zijn: *"Wil jij vrijdag Bus 3 overnemen,
16:00–21:00?"* Wie het eerst reageert, krijgt hem.

Via [Bird](https://bird.com/nl-nl), dat ook het herstel per sms zou doen — dan
is er één sms-kanaal en niet twee.

**Wat er al voor klaarligt.** Beschikbaarheid weet wie er die dag kan.
`persoon_id` op de dienst verzetten is één veld, en `mutaties` legt vast wie er
oorspronkelijk stond. De ruil zelf is dus het kleinste deel.

**Waar het lastig wordt.** Niet in de techniek maar in de regels:

- Mag iemand een dienst zomaar weggeven, of moet de baas erlangs? Nu staat in
  `schema.sql` op `diensten_melden` bewust `with check (persoon_id =
  huidige_persoon_id())` — een bezorger kan een dienst niet op een ander zetten.
  Dat is precies het slot dat hiervoor open zou moeten.
- Wat als niemand reageert? Dan blijft de dienst van de eerste persoon, en dat
  moet hij weten. Anders denkt hij dat hij ervan af is.
- Hoeveel berichtjes stuur je? Acht man appen voor één dienst is acht keer
  betalen, en zeven keer voor niets.

**Volgorde.** Pas nadat het rooster een paar weken echt draait. Dit is een
oplossing voor een probleem dat nu in de groepsapp wordt opgelost, en die
werkt.
