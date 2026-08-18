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

## Draaien

```sh
npm install
npm run dev
```

## Waar we nu staan

**Fase 0 tot en met 6 af.** De hele keten draait op de database: de bezorger
meldt zijn dienst, de baas bevestigt, en er komt een bestand uit voor de
boekhouder. Er zit geen nepdata meer in — het prototype uit fase 0 staat nog in
de branch `fase-0-prototype`.

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

Wat er nog moet: installeren bij het eerste bedrijf (fase 7) en deze repo
opschonen tot boilerplate (fase 8).

## Opbouw

| Bestand | Waarvoor |
|---|---|
| `src/lib/model.ts` | De vorm van de gegevens, één op één met `docs/schema.sql` |
| `src/lib/tijd.ts` | Alles met datums en tijden. De enige plek waar de tijdzone uitmaakt |
| `src/lib/server/wie.ts` | Wie ben ik volgens `personen` — de rol komt hier vandaan, niet uit Auth |
| `src/lib/server/uren.ts` | Wat de boekhouder krijgt. Het enige bestand dat je aanpast voor een ander formaat |
| `src/lib/componenten/` | Meldkaart, tijdstappers, statusmerkjes |

De nepdata had precies de vorm die Supabase teruggeeft, snake_case en al.
Daardoor kregen de schermen in fase 4 alleen een andere bron en hoefden ze niet
opnieuw gebouwd te worden. Dat is ook zo gelopen; `model.ts` is er nog en is nu
één op één het schema.
