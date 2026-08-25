# Geparkeerde ideeën

Dingen die we bewust níét nu bouwen, maar die te goed zijn om kwijt te raken.
Staat er iets op deze lijst, dan is het een idee en geen belofte — pas als het
een fase in `bouwplan.md` wordt, gaat het gebeuren.

---

## De installatie in de leesstand

De rol van de superadmin is er (fase 17). Dit is het enige recht dat er nog
ontbreekt: een knop die de hele installatie op alleen-lezen zet. Abonnement niet
betaald, of een overname die nog loopt — alles blijft leesbaar, er kan niets bij.

**Waarom het niet zomaar een vinkje is.** Het moet het enige recht zijn dat de
eigenaar níét heeft, anders zet hij het terug. Dus hangt het aan
`is_superadmin()` en niet aan `is_eigenaar()`, en dat is de eerste keer dat die
twee echt uit elkaar lopen.

**Hoe het er waarschijnlijk uitziet.** Eén rij in een instellingentabel, en een
restrictieve policy op elke tabel die zegt: geen insert, geen update, geen delete
zolang die aan staat. Restrictief, want dan hoeft er geen bestaande policy om —
zelfde truc als bij het verbergen in fase 17. En op elk scherm één regel dat het
aan staat, want anders lijkt de app stuk in plaats van op pauze.

**Beslist (2026-08-24): de export blijft werken.** Wie opzegt hoort zijn eigen
uren mee te kunnen nemen, en dat is precies wat de export is. De leesstand zet
dus het schrijven stil en niets anders — geen enkele reden om iemand zijn eigen
gegevens te onthouden om een rekening.

**Volgorde.** Niet vóór fase 7, en zelfs niet vóór de eerste betalende klant.
Zolang jij de enige gebruiker bent is dit een knop voor een probleem dat niet
bestaat.

Twee dingen die pas betekenis krijgen als er iets anders eerst gebeurt: **over
een afsluiting heen corrigeren** kan pas als een geëxporteerde week vastgezet
wordt (dat bestaat nog niet), en **alle bedrijven zien** alleen als het ooit één
database met `bedrijf_id` wordt in plaats van een installatie per bedrijf — die
keuze staat in fase 8.

**En het stuk dat geen code is.** Onzichtbaar plus alle rechten betekent dat het
logboek het laatste slot is, en dat hij dat zelf kan openen. Dat valt technisch
niet op te lossen en staat er daarom niet als taak maar als afspraak: het hoort
in het contract, samen met de verwerkersovereenkomst die er bij het eerste
abonnement toch al moet zijn.

_Drie rechten stonden hier ook en zijn eruit (2026-08-24)._ Inloggen als iemand
anders: niet nodig. Retentie: kan met een delete in de SQL-editor. De technische
overzichten: sms-verbruik en kosten staan in Bird, de foutlog in Supabase → Logs,
en agendasleutels zijn één query.

---

## De week uitrollen met een knop

De weekuitrol is het laatste dat alleen in de SQL-editor kan. Elke maandag
`select rol_week_uit();` intikken in het Supabase-dashboard is niet alleen
omslachtig — het betekent dat de eigenaar een dashboard nodig heeft dat hij
nooit zou moeten zien. **Het doel is Supabase-vrij zijn: alles wat het draaien
van de app vraagt, kan in de app.**

Dat weegt zwaarder dan gemak. Dit wordt een abonnement dat iemand koopt, en na
half november 2026 zit de bouwer er niet meer naast. Een klant die voor één
wekelijkse handeling in een databasedashboard moet, heeft geen product maar een
afhankelijkheid.

### De database is al klaar

Dit is minder werk dan het lijkt, want `weekgeneratie.sql` is er al op gebouwd:

- **Geen `security definer`.** De functie draait met de rechten van wie hem
  aanroept en loopt gewoon tegen row level security aan, net als elk scherm.
- **De rolcheck zit erin.** `if auth.uid() is not null and not is_beheerder()`
  — een medewerker die het probeert krijgt "Alleen een beheerder rolt een week
  uit", en dat is nu een leesbare fout in plaats van een lege lijst.
- **`grant execute … to authenticated` staat er al.** Er hoeft geen recht bij.
- **Hij geeft terug wat hij deed**, als tabel met datum, post, tijden en
  `resultaat`. Dat is precies wat een scherm nodig heeft.
- **Twee keer draaien is veilig.** Hij slaat over wat er al staat, raakt gemelde
  diensten niet aan, en zet een annulering van de baas niet stilletjes terug.

Dat laatste is de reden dat dit een knop mág zijn. Een knop die per ongeluk
twee keer ingedrukt wordt en dan iets kapotmaakt, hoort geen knop te zijn.

### Wat er dan nog moet

Een formulieractie op `/beheer/sjabloon` — daar hoort hij, want je hebt net het
sjabloon aangepast en wil het neerzetten. Twee knoppen: **deze week** en
**volgende week** (`rol_week_uit()` neemt een datum).

**Met een voorbeeld ervoor.** `sjabloon_slots(maandag)` is de droogloop: hij
zegt wat er zou gebeuren zonder iets te schrijven. Dus eerst "17 diensten, 3
staan er al" laten zien, en dan pas de knop. Een uitrol die zwijgend slaagt is
eng; een uitrol die eerst laat zien wat hij gaat doen is een gereedschap.

En achteraf de teruggegeven tabel tonen, niet alleen "gelukt".

### De knop is niet genoeg

Hier zit een eerlijk bezwaar tegen dit idee, en het staat in
`projectoverzicht.md`: *"nu moet je iets doen om betaald te worden. Straks hoef
je alleen iets te doen als de werkelijkheid afweek van het rooster."* Een knop
die iemand elke maandag moet indrukken zet dat terug — vergeet hij het, dan
staat de hele ploeg maandag voor een leeg scherm.

**Dus allebei.** `pg_cron` blijft het plan en doet het maandagnacht vanzelf; de
knop is er voor het moment dat je het sjabloon wijzigt en het nú wil zien, en
voor als de cron een keer niet liep. Dat is ook waarom het scherm moet tonen
wanneer de week voor het laatst is uitgerold: dan zie je dat de cron werkt zonder
het ergens anders te moeten controleren.

Eén handeling blijft dan in de SQL-editor: die cron één keer aanzetten. Dat is
installatiewerk en hoort in `installatie.md`, niet in het wekelijkse ritme.

### Een variant die de knop overbodig maakt

In plaats van iemand laten drukken: de app rolt de week uit zodra iemand hem
nodig heeft. Opent de eerste persoon `/rooster` of `/mijn-week` in een week waar
nog geen diensten staan, dan gebeurt het daar.

**Voordeel:** niemand hoeft iets te weten, en het kan niet vergeten worden.
**Nadeel:** een pagina die stilletjes schrijft, is een pagina die je bij een bug
niet vertrouwt. Twee mensen tegelijk is geen probleem — de functie is
idempotent en de exclusion constraint vangt de rest — maar "waarom staan er
opeens diensten" is een vraag die je dan niet uit een logregel kunt
beantwoorden.

Te overwegen als de cron ooit een keer stilvalt en het opvalt dat niemand het
merkte.

---

_Twee ideeën zijn hier weggegaan omdat ze een fase werden (2026-08-25)._
**De bedrijfspagina** — de eigenaar zet zelf naam, kleur en logo — staat nu in
`bouwplan.md` bij fase 8. **De showcase** — één live installatie op een
verzonnen bedrijf, om te testen, te tonen en te verkopen — is fase 18 geworden.

Dat is precies de afspraak bovenaan dit bestand: wordt het een fase, dan is het
geen idee meer en hoort het niet meer op deze lijst. Wat hier staat is wat er
níét gebeurt.
