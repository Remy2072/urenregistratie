# Urenregistratie

Mobiele webapp die het papieren bonnetje na je dienst vervangt. Het rooster is
de invoer, het urenoverzicht voor de boekhouder is de uitvoer.

Achtergrond en beslissingen staan in `docs/`:

| Bestand | Waarvoor |
|---|---|
| `docs/projectoverzicht.md` | Wat het wordt en waarom, en wat we bewust niet bouwen |
| `docs/bouwplan.md` | De acht fases, met per fase een "klaar als" |
| `docs/schema.sql` | Het datamodel, inclusief rechten. Draait op Supabase |

## Draaien

```sh
npm install
npm run dev
```

## Waar we nu staan

**Fase 0 — prototype.** Er zit geen database achter en er wordt niets bewaard:
ververs de pagina en alles staat weer zoals het was. De app doet alsof het
donderdag 20 augustus 2026, 22:15 is, midden in week 34.

Drie schermen:

- `/mijn-week` — de bezorger. Eén tik voor "gedraaid", knoppen voor afwijken,
  en een vergeten dienst kun je achteraf alsnog invullen.
- `/overzicht` — de baas. Bovenaan alleen afwijkingen, achteraf gemelde en
  niet-gemelde diensten. Bevestigen kan los of in bulk.
- `/export` — de boekhouder. Alleen bevestigde diensten, alleen uren.

## Opbouw

| Bestand | Waarvoor |
|---|---|
| `src/lib/model.ts` | De vorm van de gegevens, één op één met `docs/schema.sql` |
| `src/lib/nepdata.ts` | Twee weken verzonnen data. Verdwijnt in fase 4 |
| `src/lib/tijd.ts` | Alles met datums en tijden. De enige plek waar de tijdzone uitmaakt |
| `src/lib/prototype.svelte.ts` | Toestand in het geheugen. Wordt in fase 4 Supabase |

De nepdata heeft precies de vorm die Supabase straks teruggeeft, snake_case en
al. Daardoor krijgen de schermen in fase 4 alleen een andere bron en hoeven ze
niet opnieuw gebouwd te worden.
