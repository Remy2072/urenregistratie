# Urenregistratie

Mobiele webapp die het papieren bonnetje na je dienst vervangt. Het rooster is
de invoer, het urenoverzicht voor de boekhouder is de uitvoer.

Achtergrond en beslissingen staan in `docs/`:

| Bestand | Waarvoor |
|---|---|
| `docs/projectoverzicht.md` | Wat het wordt en waarom, en wat we bewust niet bouwen |
| `docs/bouwplan.md` | De fases, met per fase een "klaar als" |
| `docs/schema.sql` | Het datamodel, inclusief rechten. Voor elk bedrijf hetzelfde |
| `docs/startdata.sql` | Posten, diensten en het weekrooster. Het enige dat per bedrijf verschilt |
| `docs/weekgeneratie.sql` | De wekelijkse uitrol van het sjabloon naar diensten |
| `docs/profiel.sql` | Gebruikersnaam en telefoon op `personen` (fase 10). Draai hem altijd ná `rollen.sql` |
| `docs/herstel.sql` | Herstelcodes voor "wachtwoord vergeten" (fase 13) |

## Draaien

```sh
npm install
npm run dev
```

## Waar we nu staan

**Fase 0 tot en met 6 af, plus 9 tot en met 13.** De hele keten draait op de database: de
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
  niet bevestigd is kun je aanpassen.
- `/overzicht` — de baas. Bovenaan alleen afwijkingen, achteraf gemelde en
  niet-gemelde diensten. Bevestigen los of in bulk, en een dienst verzetten.
- `/export` — de boekhouder. Alleen bevestigde diensten, alleen uren, als CSV.
- `/herstel` — wachtwoord vergeten. Gebruikersnaam invullen, code per sms, zelf
  een nieuw wachtwoord kiezen. Openbaar, want wie hier komt kan niet inloggen.
- `/ik` — je eigen gegevens. Je gebruikersnaam en je naam zijn van de baas; je
  telefoonnummer, je wachtwoord en je passkeys zet je zelf.

Wat er nog moet: installeren bij het eerste bedrijf (fase 7) en deze repo
opschonen tot boilerplate (fase 8). Daar hoort de deploy bij, en die is het
eerste dat er nu ligt.

## Opbouw

| Bestand | Waarvoor |
|---|---|
| `src/lib/model.ts` | De vorm van de gegevens, één op één met `docs/schema.sql` |
| `src/lib/tijd.ts` | Alles met datums en tijden. De enige plek waar de tijdzone uitmaakt |
| `src/lib/server/wie.ts` | Wie ben ik volgens `personen` — de rol komt hier vandaan, niet uit Auth |
| `src/lib/server/login.ts` | Van een gebruikersnaam naar het adres waarmee Supabase iemand kent |
| `src/lib/telefoon.ts` | Alles met telefoonnummers. Eén vorm in de database, een leesbare op het scherm |
| `src/lib/passkey.ts` | Het enige stuk dat in de browser draait: het passkey-venster van de telefoon |
| `src/lib/server/bird.ts` | Sms versturen. De enige plek die iets naar buiten stuurt, en de enige met een rekening eraan |
| `src/lib/server/herstel.ts` | Codes verzinnen en narekenen voor "wachtwoord vergeten" |
| `src/lib/server/uren.ts` | Wat de boekhouder krijgt. Het enige bestand dat je aanpast voor een ander formaat |
| `src/lib/componenten/` | Meldkaart, tijdstappers, statusmerkjes |

De nepdata had precies de vorm die Supabase teruggeeft, snake_case en al.
Daardoor kregen de schermen in fase 4 alleen een andere bron en hoefden ze niet
opnieuw gebouwd te worden. Dat is ook zo gelopen; `model.ts` is er nog en is nu
één op één het schema.
