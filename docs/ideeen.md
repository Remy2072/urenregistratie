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

**Beslist (2026-08-25): dit is fase 8 en niet iets ervoor.** Hier stond dat het
er los voor kon, omdat het de app wel "de eigenaar kan het zelf"-baar maakt maar
niet "tweede bedrijf erbij"-baar. Dat onderscheid houdt geen stand: fase 8 is
letterlijk "een tweede bedrijf zonder een `.svelte` aan te raken", en dat is
precies wat deze pagina doet. Los bouwen levert twee halve oplossingen op — een
instellingentabel die de helft van de instellingen kent, en een fase 8 die er
alsnog omheen moet.

---

## De showcase

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
- **De leesstand hergebruiken.** Het idee bovenaan dit bestand is bedoeld voor
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

**Dit is fase 18 geworden (2026-08-25).** Bovenaan dit bestand staat dat iets
pas gebeurt als het een fase in `bouwplan.md` wordt, en fase 7 verwees hier al
naar als iets dat eraan voorafgaat — dan is het een belofte en geen idee meer.
Wat hier staat blijft de uitwerking; de fase zegt wat er af moet zijn.

---
