# Een nieuwe klant opzetten

Van niets naar een draaiende installatie. Volg dit van boven naar beneden — de
volgorde is op een paar plekken niet vrij, en waar dat zo is staat erbij waarom.

Fase 8 in `bouwplan.md` vraagt om dit bestand. Daar staat het *waarom* van dit
model (één repo, een installatie per bedrijf, en wanneer dat kantelt naar één
database); hier staat wat je doet.

---

## Vooraf: op wiens account

**Alles op jouw account. De klant maakt nergens iets aan.**

Dat is de keuze uit fase 17: dit wordt een saas-abonnement en geen verkoop per
installatie, dus de sleutels van elk Supabase-project blijven permanent bij ons.
Vroeger stond het omgekeerd in fase 8 — alles op het account van de baas, want de
bouwer vertrekt — en dat is achterhaald.

Weet wat dat betekent voordat je klant één aanneemt: **jij bent verwerker van hun
personeelsgegevens.** Dat is geen technisch punt en het staat verderop als
papierwerk, maar het is de reden dat dit bovenaan staat en niet onderaan.

---

## Eenmalig, niet per klant

| Wat | Waarom één | Waar je op let |
|---|---|---|
| **Deze repo** | Eén repo voor alle installaties. Eén push en ze zijn allemaal bij | Dus ook: één fout overal tegelijk. Niet op vrijdagavond deployen |
| **Vercel-team** | Alle klantprojecten hangen eronder | Hobby mag niet voor commercieel gebruik. Zodra klant één betaalt, betaal jij ook |
| **Bird-account** | Sms gaat één kant op en jij bent de afzender. Eén account is de normale vorm | Het tegoed is gedeeld — een klant met een drukke ploeg drukt op jouw rekening. En de afzendernaam is die van jou, niet van de klant |
| **Eén domein** | `klantnaam.jouwdomein.nl` per installatie | Zie stap 3: dit ligt vast zodra de eerste passkey is aangemeld |

---

## Per klant, in volgorde

### 1. Supabase-project

Nieuw project in jouw organisatie, regio EU.

**Betaald plan, niet het gratis plan.** Hier staan de uren waarop mensen worden
uitbetaald; dat is een ander soort verlies dan een website die een dag uit de
lucht is. Backups zijn het hele argument. Dit is meteen de grootste vaste kost
per klant en dus de bodem onder je abonnementsprijs.

### 2. Vercel-project

Zelfde repository, eigen omgevingsvariabelen, eigen domein. Je raakt geen code
aan — wat per klant verschilt zijn de variabelen uit stap 5 en de vulling van
`startdata.sql`.

### 3. Het domein vastleggen — nu, niet later

De Relying Party ID voor passkeys is het domein, en die staat per
Supabase-project. Fase 12 zegt het scherp: **wat je op `localhost` aanmeldt werkt
niet op het echte domein.** Dat is geen fout maar de kern van WebAuthn.

Gevolg: verhuis je een klant later naar een ander adres, dan moet iedereen zijn
passkey opnieuw aanmelden. Kies het adres dus voordat er iemand inlogt, en zet
in Supabase Auth het echte domein bij RP ID en `https://…` bij origins.

### 4. De SQL, in deze volgorde

```
schema.sql
schema-test.sql          ← draai hem echt
rollen.sql
profiel.sql              ← moet ná rollen.sql
beschikbaarheid.sql
herstel.sql
ruilen.sql
agenda.sql
weekgeneratie.sql
weekgeneratie-test.sql   ← draai hem echt
startdata.sql            ← hún posten, mensen en rooster
superadmin.sql           ← altijd als laatste
```

Twee dingen liggen vast, de rest mag door elkaar:

- **`profiel.sql` ná `rollen.sql`.** Ze overschrijven allebei
  `persoon_wijziging_bewaken()` en de laatste wint. Andersom draaien kost je de
  bewaking op de gebruikersnaam, en dat merk je nergens aan.
- **`superadmin.sql` als laatste.** Zijn restrictieve policies komen náást de
  bestaande te staan, en hij moet het opnieuw draaien van `schema.sql` en
  `rollen.sql` overleven — niet andersom.

**De twee testbestanden zijn geen formaliteit.** Elke regel hoort 'goed' te
zeggen. Dit is het laatste moment waarop iets kapotmaken gratis is: er zit nog
geen data in en niemand werkt ermee.

**`startdata.sql` is het enige bestand dat per bedrijf verschilt.** Gooi het
voorbeeld weg en typ hun eigen posten, dienstsoorten, mensen en weekrooster in.
Doe dat in de SQL-editor en commit het niet — namen van personeel horen niet in
deze repo.

### 5. Omgevingsvariabelen in Vercel

| Variabele | Nodig? | Zonder |
|---|---|---|
| `PUBLIC_SUPABASE_URL` | Ja | De app start niet |
| `PUBLIC_SUPABASE_KEY` | Ja | Idem. Dit is de publieke sleutel; wat beschermt is row level security, niet deze sleutel |
| `SUPABASE_SECRET_KEY` | Ja | "Login aanmaken" werkt niet en iedereen logt in op e-mailadres in plaats van gebruikersnaam |
| `LOGIN_DOMEIN` | Alleen als nodig | Wordt `uren.local`. Weigert Supabase dat verzonnen domein, zet er dan een domein neer dat de klant echt bezit |
| `BIRD_API_KEY` + `BIRD_WORKSPACE_ID` + `BIRD_CHANNEL_ID` | Alleen mét sms | "Wachtwoord vergeten" werkt door, maar de code komt in de serverlog in plaats van in een sms |

`SUPABASE_SECRET_KEY` staat bewust niet op `PUBLIC_`. Wie hem heeft mag alles, in
elke tabel, namens iedereen.

### 6. Een login per persoon

Via de knop op het beheerscherm. De app stelt zelf een adres voor
(`daanb@<domein>`); dat adres bestaat nergens en er gaat nooit post heen.

### 7. Deploy, en pas dan de rest

**Migratie eerst, deploy daarna. Altijd in die volgorde.** Code die een nieuwe
kolom nodig heeft valt om op een database waar die kolom nog niet staat, en dan
krijgt de hele ploeg "nog niet gekoppeld" te zien. Bij fase 10 is dat één keer
bijna gebeurd.

### 8. De weekuitrol

Draai `rol_week_uit()` de eerste weken met de hand. Is dat een paar weken saai
geweest, dan mag cron het overnemen — de regel staat klaar onderaan
`weekgeneratie.sql`.

**Let op het tijdstip: `pg_cron` rekent in de tijdzone van de database.** Maandag
00:00 Nederlandse tijd is `0 1 * * 1` in de zomer. Staat de cron verkeerd, dan
rolt de week op zondagavond uit en staat er een dag in het rooster die er nog
niet hoort te staan.

---

## Wat geen account is maar wel per klant moet

Dit deel weegt bij een abonnement zwaarder dan bij verkoop, en het staat nergens
als code.

- **Een verwerkersovereenkomst.** Jij host hun personeelsgegevens. Die hoort te
  liggen vóór de eerste echte dienst erin staat, niet erna.
- **De superadmin op papier.** Onzichtbaar plus alle rechten betekent dat jij het
  logboek kunt openen, en dat valt technisch niet op te lossen. Het hoort in het
  contract — zie `ideeen.md`.
- **Wat er wel en niet bij zit.** Fase 7 zegt dat al voor de eerste klant; vanaf
  klant twee is het een abonnementsvoorwaarde.

---

## Bij de tweede klant en verder

- **Elke migratie draai je zo vaak als er klanten zijn.** Dat is de prijs van dit
  model. Houd de `.sql`-bestanden op één plek en in volgorde, en zet per klant af
  wat je gedraaid hebt. Bij meer dan twee installaties is de Supabase CLI
  (`supabase db push`) het uitzoeken waard.
- **Laat de versies niet uit elkaar lopen.** Eén repo betekent dat alle
  installaties dezelfde code draaien. Blijft één klant achter met zijn schema,
  dan moet je code schrijven die met twee schema's overweg kan — precies de last
  waar je hier niet aan wil beginnen.
- **Bij een stuk of zestien klanten kantelt het model.** Niet omdat zestien veel
  is, maar omdat zestien betaalde projecten gaan praten. Wat er dan moet gebeuren
  en wat je daarvóór geregeld moet hebben, staat in fase 8 onder "Als dit een
  SaaS wordt". Begin daar niet aan zonder die twee voorwaarden.
