-- =====================================================================
-- Fase 17 -- De superadmin die niemand ziet
--
-- Eén rol erbij, boven eigenaar, voor de bouwer. Hij kan alles wat de
-- eigenaar kan en één ding meer, en hij staat in geen enkele lijst --
-- ook niet in die van de eigenaar.
--
-- Waarom dat mag: dit wordt een saas-abonnement en geen verkoop per
-- installatie. De sleutels van dit Supabase-project blijven bij ons,
-- permanent. Deze rol geeft dus geen macht die er niet al was; hij maakt
-- een nette voordeur voor wat via de sql-editor toch al kan. Wat er wél
-- verandert is dat het onzichtbaar gebeurt, en dat hoort daarom in het
-- contract te staan en niet alleen in dit bestand.
--
-- Het gereedschap dat dit mogelijk maakt is de RESTRICTIEVE policy.
-- Gewone policies zijn een 'of': er één bij zetten kan alleen méér
-- toestaan. Een restrictieve policy is een 'en' -- die komt náást alle
-- bestaande te staan en kan alleen minder toestaan. Daardoor hoeft geen
-- enkele policy uit schema.sql of rollen.sql herschreven te worden, en
-- overleeft dit bestand het opnieuw draaien van die twee.
--
-- LET OP -- draai dit ALS LAATSTE, na rollen.sql en profiel.sql. Vier
-- dingen worden hier wel herdefinieerd, omdat het niet anders kan:
-- is_beheerder() en is_eigenaar() (die moeten hem meerekenen),
-- ruilkandidaten() en beschikbaarheid() (die moeten hem overslaan).
-- Draai je rollen.sql, ruilen.sql of schema.sql later nog eens, draai
-- dit bestand er dan direct achteraan. Gaat dat mis, dan mag hij minder
-- dan de eigenaar en staat hij weer in de ruillijst.
--
-- Staat ook in schema.sql, zodat een verse installatie compleet is met
-- één bestand. Veilig om twee keer te draaien.
-- =====================================================================


-- ---------------------------------------------------------------------
-- De rol zelf
--
-- Vierde waarde in dezelfde check. De app kent hem ook (`Rol` in
-- model.ts), want anders klopt het type niet -- maar het beheerscherm
-- biedt hem nergens aan. Deze rol komt alleen uit de sql-editor.
-- ---------------------------------------------------------------------
alter table personen drop constraint if exists personen_rol_check;

alter table personen add constraint personen_rol_check
  check (rol in ('medewerker', 'manager', 'eigenaar', 'superadmin'));


-- ---------------------------------------------------------------------
-- Wie is de superadmin?
--
-- Zelfde vorm als is_beheerder() en is_eigenaar(): stable, definer, en
-- hij leest personen. Dat laatste kan omdat een definer-functie als
-- eigenaar van de tabel draait en dus langs RLS heen gaat -- anders zou
-- een policy die deze functie aanroept naar zichzelf verwijzen.
-- ---------------------------------------------------------------------
create or replace function is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select rol = 'superadmin' and actief
       from personen
      where auth_user_id = auth.uid()),
    false);
$$;


-- ---------------------------------------------------------------------
-- En hij telt mee als beheerder én als eigenaar
--
-- Dit is het hele rechtenverhaal, en het is bewust zo klein: elke policy
-- in dit schema hangt aan deze twee functies. Eén waarde erbij en hij
-- heeft in één keer alles wat de eigenaar heeft, zonder dat er ergens
-- een policy verandert.
--
-- Dit zijn de twee die je kwijt bent als je rollen.sql later opnieuw
-- draait. Zie de waarschuwing bovenaan.
-- ---------------------------------------------------------------------
create or replace function is_beheerder()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select rol in ('manager', 'eigenaar', 'superadmin') and actief
       from personen
      where auth_user_id = auth.uid()),
    false);
$$;

create or replace function is_eigenaar()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select rol in ('eigenaar', 'superadmin') and actief
       from personen
      where auth_user_id = auth.uid()),
    false);
$$;


-- ---------------------------------------------------------------------
-- Onzichtbaar: drie restrictieve policies
--
-- Lezen is de belangrijkste. Eén regel, en hij verdwijnt uit elke lijst,
-- elke telling, elk uitklapmenu en elke export -- want die vragen het
-- allemaal aan deze tabel. Daarmee is "niet in te plannen" ook meteen
-- geregeld voor alles wat via RLS gaat: wie niet in de lijst staat, wordt
-- niet gekozen.
--
-- Dat hij zichzelf wél ziet is nodig: zonder zijn eigen rij weet de app
-- niet wie hij is en laat de database hem nergens bij.
--
-- Er is geen `create policy if not exists`, dus staat er een drop boven.
-- ---------------------------------------------------------------------
drop policy if exists personen_superadmin_verbergen on personen;

create policy personen_superadmin_verbergen on personen
  as restrictive for select to authenticated
  using (rol <> 'superadmin' or is_superadmin());


-- Niemand maakt deze rol aan. De sql-editor en de servicesleutel gaan
-- langs RLS heen, dus die kunnen het nog steeds -- en dat is de enige weg.
drop policy if exists personen_superadmin_niet_maken on personen;

create policy personen_superadmin_niet_maken on personen
  as restrictive for insert to authenticated
  with check (rol <> 'superadmin' or is_superadmin());


-- En niemand komt aan zijn rij of promoveert iemand tot deze rol. using
-- is de rij zoals hij was, with check zoals hij wordt -- die tweede is
-- hier de belangrijkste van de twee.
drop policy if exists personen_superadmin_niet_wijzigen on personen;

create policy personen_superadmin_niet_wijzigen on personen
  as restrictive for update to authenticated
  using      (rol <> 'superadmin' or is_superadmin())
  with check (rol <> 'superadmin' or is_superadmin());


-- ---------------------------------------------------------------------
-- Het tweede slot: een trigger ernaast, niet erin
--
-- "Dit veld mag jij niet veranderen" past niet in een policy, want een
-- policy ziet de rij zoals hij was óf zoals hij wordt. Dezelfde reden
-- als bij `rol` in fase 9, en dus dezelfde oplossing.
--
-- Maar bewust een APARTE trigger. persoon_wijziging_bewaken() staat al in
-- drie bestanden (schema.sql, rollen.sql, profiel.sql) en elke keer
-- wint de laatste die je draait; een vierde plek maakt die val alleen
-- groter. Twee triggers op dezelfde tabel vuren allebei.
--
-- De melding zegt niet wat je fout deed. Dat is de regel uit idee 6: geef
-- geen antwoord waaruit blijkt dat er iets is om te vinden.
-- ---------------------------------------------------------------------
create or replace function persoon_superadmin_bewaken()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- De sql-editor en de servicesleutel mogen alles: zo ontstaat deze rol
  -- in de eerste plaats. En hijzelf mag zijn eigen rij bijwerken.
  if auth.uid() is null or is_superadmin() then
    return new;
  end if;

  -- Twee gevallen, en met opzet niet in één regel: op een insert bestaat
  -- `old` niet, en Postgres belooft niet dat het de linkerkant van een `or`
  -- als eerste bekijkt. Dan lees je een veld van niets.
  if tg_op = 'UPDATE' then
    if old.rol = 'superadmin' or new.rol = 'superadmin' then
      raise exception 'Deze rol bestaat niet';
    end if;
  else
    if new.rol = 'superadmin' then
      raise exception 'Deze rol bestaat niet';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists persoon_superadmin_bewaken on personen;

create trigger persoon_superadmin_bewaken
  before insert or update on personen
  for each row execute function persoon_superadmin_bewaken();


-- ---------------------------------------------------------------------
-- Het ene recht dat hij méér heeft: verwijderen
--
-- Er stond tot nu toe nergens een delete-policy, en dat was een keuze:
-- "iemand hoort op non-actief te gaan, niet weg". Gevolg was wel dat een
-- verkeerd ingevoerde persoon er nooit meer uit kon.
--
-- Let op wat dit niet is. De foreign keys van diensten en sjabloon_regels
-- staan zonder cascade, dus iemand die ooit gewerkt heeft gaat er niet
-- uit -- daar loopt de delete op stuk. Dat is goed: bij zo'n verzoek is
-- de vraag niet "mag ik verwijderen" maar "wat gebeurt er met die uren",
-- en dat is een besluit en geen knop. Wat hier kan is de schoonmaak van
-- een fout van vijf minuten oud.
--
-- Hij kan hiermee ook zijn eigen rij verwijderen. Dat laat ik staan: wie
-- deze rol heeft, heeft ook de sleutels om hem opnieuw te maken.
-- ---------------------------------------------------------------------
drop policy if exists personen_verwijderen on personen;

create policy personen_verwijderen on personen
  for delete to authenticated
  using (is_superadmin());


-- ---------------------------------------------------------------------
-- De twee lijsten die langs RLS heen gaan
--
-- ruilkandidaten() is security definer en ziet dus alles. Daar stond al
-- dat een eigenaar niet ingeroosterd wordt; de superadmin hoort in
-- hetzelfde rijtje. Dit is het patroon om in de gaten te houden: elke
-- definer-functie die mensen opsomt moet hem zelf overslaan.
--
-- beschikbaarheid() is invoker en dus al gedekt voor iedereen behalve
-- hemzelf. De regel staat er zodat hij ook zichzelf niet in het
-- beschikbaarheidsraster tegenkomt -- hij hoort in geen enkel rooster,
-- ook niet in zijn eigen beeld ervan.
-- ---------------------------------------------------------------------
create or replace function ruilkandidaten(p_dienst_id uuid)
returns table (persoon_id uuid, naam text, kan boolean, bezet boolean)
language sql
stable
security definer
set search_path = public
as $$
  with d as (select * from diensten where id = p_dienst_id)
  select
    p.id,
    p.naam,
    coalesce(bw.kan, bs.kan, true),
    exists (
      select 1 from diensten x
       where x.persoon_id = p.id
         and x.datum = (select datum from d)
         and x.status not in ('afgemeld', 'vervallen')
    )
  from personen p
  cross join d
  left join beschikbaarheid_standaard bs
         on bs.persoon_id = p.id
        and bs.weekdag = extract(isodow from d.datum)::smallint
  left join beschikbaarheid_week bw
         on bw.persoon_id   = p.id
        and bw.weekdag      = extract(isodow from d.datum)::smallint
        and bw.week_maandag = date_trunc('week', d.datum)::date
  where p.actief
    and p.rol not in ('eigenaar', 'superadmin')  -- die worden niet ingeroosterd
    and p.id <> d.persoon_id                     -- en jezelf vragen heeft geen zin
  order by p.naam;
$$;

create or replace function beschikbaarheid(maandag date)
returns table (
  persoon_id uuid,
  naam       text,
  weekdag    smallint,
  kan        boolean,
  afwijking  boolean
)
language sql
stable
set search_path = public
as $$
  select
    p.id,
    p.naam,
    d.weekdag::smallint,
    coalesce(bw.kan, bs.kan, true),
    bw.kan is not null and bw.kan is distinct from coalesce(bs.kan, true)
  from personen p
  cross join generate_series(1, 7) as d(weekdag)
  left join beschikbaarheid_standaard bs
         on bs.persoon_id = p.id and bs.weekdag = d.weekdag::smallint
  left join beschikbaarheid_week bw
         on bw.persoon_id   = p.id
        and bw.weekdag      = d.weekdag::smallint
        and bw.week_maandag = date_trunc('week', maandag)::date
  where p.actief
    and p.rol <> 'superadmin'
  order by p.naam, d.weekdag;
$$;


-- ---------------------------------------------------------------------
-- Hoe hij ontstaat
--
-- Niet via een scherm, en dat is het punt: er is geen knop die hem maakt,
-- dus er is ook geen knop die iemand anders kan vinden.
--
--   1. Dashboard -> Authentication -> Users -> Add user. Een e-mailadres
--      en een wachtwoord, "auto confirm user" aan. Kopieer het uuid uit
--      de lijst.
--   2. De insert hieronder, met dat uuid, een naam en een gebruikersnaam
--      die niemand ooit zelf kiest. Die naam is uniek in de hele tabel:
--      neemt de eigenaar hem per ongeluk ook, dan krijgt hij "al in
--      gebruik" voor iets wat hij niet ziet.
--
-- insert into personen (naam, rol, actief, auth_user_id, gebruikersnaam)
-- values ('Onderhoud', 'superadmin', true,
--         '00000000-0000-0000-0000-000000000000', 'onderhoud');
--
-- Inloggen gaat daarna gewoon met die gebruikersnaam. Het opzoeken van
-- het inlogadres draait met de beheersleutel en gaat langs RLS heen, dus
-- onzichtbaar zijn belet hem niet naar binnen te komen. Een passkey kan
-- ook, net als bij iedereen.
--
-- Controleren doe je van twee kanten: log in als de eigenaar en kijk of
-- de ploeg in /beheer compleet is zonder hem, en log in als hem en kijk
-- op /ik onder "Wat de database jou laat zien" -- daar staat de enige
-- regel in de hele app die toegeeft dat hij bestaat.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- Rechten
--
-- is_superadmin() mag door `authenticated` aangeroepen worden, want de
-- policies hierboven doen dat namens hem. Dat verklapt niets: het
-- antwoord is voor iedereen behalve hem simpelweg false.
-- ---------------------------------------------------------------------
grant execute on function is_superadmin() to authenticated;
