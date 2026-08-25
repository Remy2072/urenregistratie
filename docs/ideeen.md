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

## De bedrijfspagina

Eén pagina voor de eigenaar, `/beheer/bedrijf`, waar staat wie dit bedrijf is:
naam, kleur, logo, en de handvol regels die per bedrijf verschillen. Nu staat
"Bon" hard in `+layout.svelte` en is er geen `instellingen`-tabel.

**Dit vervangt wat fase 8 erover zegt.** Daar staat dat bedrijfsnaam, kleur en
favicon in een configuratiebestand horen — een omgevingsvariabele in Vercel,
want een bestand per bedrijf betekent een tak per bedrijf en dan is "één repo"
weg. Dat argument klopt nog steeds, maar de database lost hetzelfde probleem
beter op: **een env-var betekent dat de eigenaar de bouwer moet bellen om zijn
eigen bedrijfsnaam te wijzigen.** Half november 2026 is die bouwer er niet meer.
Eén repo blijft één repo; wat per bedrijf verschilt staat in de database van dat
bedrijf, en daar hoorde het al.

### De drie dingen wegen niet hetzelfde

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

### Wat er nog meer op die pagina hoort

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

### Wat er omheen moet

**Alleen de eigenaar.** `is_eigenaar()`, niet `mag_beheren()`. Een beheerder
bevestigt diensten; hij bepaalt niet hoe het bedrijf heet.

**Elke wijziging in `mutaties`.** Dat is de gewoonte van deze app, en een
bedrijfsnaam die stilletjes verandert is precies zo'n ding waarvan je later wil
weten wie het deed.

**De leesstand zet deze pagina ook dicht.** Zie het idee hierboven: de
restrictieve policy hoort ook op de instellingentabel te liggen, anders is dit
het gaatje waar nog wél geschreven kan worden.

### Volgorde

Naam, kleur en afrondregel eerst — dat is één tabel, één pagina en geen opslag.
Logo daarna, want dat is Storage plus manifest plus favicon. De rest van de
tabel zijn losse velden die je erbij zet op het moment dat het ding dat ze
opeet bestaat.

Dit kan vóór fase 8 in plaats van erbinnen: het maakt de app niet
overdraagbaarder in de zin van "tweede bedrijf erbij", maar wel in de zin van
"de eigenaar kan het zelf" — en dat is de helft van fase 8 die er toch al moest
komen.

---
