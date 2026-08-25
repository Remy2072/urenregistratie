# Bon

Mobiele webapp die het papieren bonnetje na je dienst vervangt. Het rooster is
de invoer, het urenoverzicht voor de boekhouder is de uitvoer.

Twee mappen: `docs/` is om te lezen, `sql/` is om te draaien.

| Om te lezen | Waarvoor |
|---|---|
| `docs/projectoverzicht.md` | Wat het wordt en waarom, en wat we bewust niet bouwen |
| `docs/bouwplan.md` | De fases, met per fase een "klaar als" |
| `docs/installatie.md` | Een nieuwe klant opzetten: accounts, de volgorde van de sql, en het papierwerk |
| `docs/ideeen.md` | Wat we bewust níét nu bouwen, maar te goed is om kwijt te raken |

De inhoud van `sql/` staat hieronder in de volgorde waarin je hem draait. Die
volgorde staat met uitleg in `docs/installatie.md`; twee stappen liggen vast en
die staan hier vet.

| Om te draaien | Waarvoor |
|---|---|
| `sql/schema.sql` | Het datamodel, inclusief rechten. Voor elk bedrijf hetzelfde |
| `sql/schema-test.sql` | Probeert expres wat niet mag. Elke regel hoort 'goed' te zeggen |
| `sql/rollen.sql` | Drie rollen: eigenaar, manager, medewerker |
| `sql/profiel.sql` | Gebruikersnaam en telefoon op `personen` (fase 10). **Altijd ná `rollen.sql`** |
| `sql/beschikbaarheid.sql` | Wanneer iemand kan, vast en per week (fase 9) |
| `sql/herstel.sql` | Herstelcodes voor "wachtwoord vergeten" (fase 13, uitgebreid in 16) |
| `sql/ruilen.sql` | Ruilverzoeken: gericht of open in de groepsapp (fase 14) |
| `sql/agenda.sql` | Agendalinks voor het ics-abonnement (fase 15) |
| `sql/weekgeneratie.sql` | De wekelijkse uitrol van het sjabloon naar diensten |
| `sql/weekgeneratie-test.sql` | Controle op die uitrol: wat als je hem twee keer draait? |
| `sql/startdata.sql` | Posten, diensten en het weekrooster. Het enige dat per bedrijf verschilt |
| `sql/superadmin.sql` | De rol die niemand ziet (fase 17). **Draai hem als laatste** |
| `sql/wipe.sql` | Alles leeg, structuur intact. Voor het dev-project en de showcase — **niet** voor een echte installatie |

## Draaien

```sh
npm install
npm run dev
```

## Waar we nu staan

**Fase 0 tot en met 6 af, plus 9 tot en met 15.** De hele keten draait op de database: de
bezorger meldt zijn dienst, de baas bevestigt, en er komt een bestand uit voor de
boekhouder. Er zit geen nepdata meer in — het prototype uit fase 0 staat nog in
de branch `fase-0-prototype`.

> **Inloggen kan op drie manieren**, en dat is met opzet: gebruikersnaam met
> wachtwoord, het oude e-mailadres met wachtwoord, of een passkey — gezicht,
> vinger of pincode van je eigen toestel. Een passkey zit op één toestel, dus het
> wachtwoord blijft de weg terug. Zie fase 10 en 12.

Dit is het **dev-project**. Hier staan verzonnen namen in en die blijven hier
staan; per bedrijf wordt deze repository gekloond met een eigen
Supabase-project. Zie fase 8 in het bouwplan.

### De schermen

Wat je ziet hangt af van wie je bent — de tabbladen volgen je rol.

- `/mijn-week` — de bezorger. Eén tik voor "gedraaid", knoppen voor afwijken,
  een vergeten dienst kun je achteraf alsnog invullen, en een melding die nog
  niet bevestigd is kun je aanpassen. Ruilen zit hier ook: gericht aan een
  collega, of een link voor de groepsapp.
- `/overzicht` — de baas. Bovenaan alleen afwijkingen, achteraf gemelde en
  niet-gemelde diensten. Bevestigen los of in bulk, en een dienst verzetten.
- `/export` — de boekhouder. Alleen bevestigde diensten, alleen uren, als CSV.
- `/agenda/<sleutel>.ics` — je eigen diensten als agenda-abonnement. Geen
  scherm maar een bestand, want de bezoeker is een agenda-app en die kan niet
  inloggen — daarom is die link wél een geheim.
- `/ruil/<id>` — een ruilverzoek: overnemen of niet. Vraagt een login, en dáárom
  is die link geen geheim.
- `/herstel` — wachtwoord vergeten. Gebruikersnaam **of telefoonnummer**
  invullen, code per sms, zelf een nieuw wachtwoord kiezen. Openbaar, want wie
  hier komt kan niet inloggen.
- `/ik` — je eigen gegevens. Je gebruikersnaam en je naam zijn van de baas; je
  telefoonnummer, je wachtwoord en je passkeys zet je zelf.

Wat er nog moet: installeren bij het eerste bedrijf (fase 7) en deze repo
opschonen tot boilerplate (fase 8). Daar hoort de deploy bij, en die is het
eerste dat er nu ligt.

## Opbouw

| Bestand | Waarvoor |
|---|---|
| `src/lib/model.ts` | De vorm van de gegevens, één op één met `sql/schema.sql` |
| `src/lib/tijd.ts` | Alles met datums en tijden. De enige plek waar de tijdzone uitmaakt |
| `src/lib/server/wie.ts` | Wie ben ik volgens `personen` — de rol komt hier vandaan, niet uit Auth |
| `src/lib/server/login.ts` | Van een gebruikersnaam naar het adres waarmee Supabase iemand kent |
| `src/lib/telefoon.ts` | Alles met telefoonnummers. Eén vorm in de database, een leesbare op het scherm |
| `src/lib/passkey.ts` | Het enige stuk dat in de browser draait: het passkey-venster van de telefoon |
| `src/lib/server/agenda.ts` | Het ics-bestand. De enige plek waar de tijdzone wordt uitgeschreven in plaats van uitgerekend |
| `src/lib/server/bird.ts` | Sms versturen. De enige plek die iets naar buiten stuurt, en de enige met een rekening eraan |
| `src/lib/server/herstel.ts` | Wie je bent, codes verzinnen en narekenen voor "wachtwoord vergeten" |
| `src/lib/server/uren.ts` | Wat de boekhouder krijgt. Het enige bestand dat je aanpast voor een ander formaat |
| `src/lib/componenten/` | Meldkaart, tijdstappers, statusmerkjes |

De nepdata had precies de vorm die Supabase teruggeeft, snake_case en al.
Daardoor kregen de schermen in fase 4 alleen een andere bron en hoefden ze niet
opnieuw gebouwd te worden. Dat is ook zo gelopen; `model.ts` is er nog en is nu
één op één het schema.
