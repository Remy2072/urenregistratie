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
