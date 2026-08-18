-- =====================================================================
-- Drie rollen: eigenaar, manager, medewerker
--
-- Hiervoor waren er twee: medewerker en beheerder. De baas bleek er
-- twee te zijn plus een manager, en die manager mag alles behalve de
-- boekhouding.
--
-- De verhouding is een rangorde en geen lijstje:
--
--   eigenaar     alles, inclusief de export en het toekennen van rollen
--   manager      alles behalve die twee, en mag zelf ook rijden
--   medewerker   zijn eigen week
--
-- Een manager komt niet aan rollen. Hij neemt bezorgers aan, corrigeert
-- namen en zet mensen op non-actief; wie er manager of eigenaar wordt
-- beslist de eigenaar. En aan een eigenaar komt hij helemaal niet. Dat staat hieronder in de policy en niet
-- alleen in het scherm, want een formulier is zo nagemaakt.
--
-- Dit bestand staat ook in schema.sql. Het is er apart zodat je het op
-- een database die al draait kunt bijdraaien.
-- =====================================================================


-- ---------------------------------------------------------------------
-- De kolom
--
-- 'beheerder' wordt 'eigenaar'. Dat is wie er tot nu toe in stond: de
-- baas zelf. Een manager is nieuw en die zet je er met de hand bij, of
-- via het beheerscherm.
-- ---------------------------------------------------------------------
alter table personen drop constraint if exists personen_rol_check;

update personen set rol = 'eigenaar' where rol = 'beheerder';

alter table personen add constraint personen_rol_check
  check (rol in ('medewerker', 'manager', 'eigenaar'));


-- ---------------------------------------------------------------------
-- Wie mag beheren?
--
-- is_beheerder() houdt zijn naam, want dat is precies wat hij zegt: mag
-- deze persoon beheren. Alle policies in schema.sql hangen eraan en die
-- hoeven dus niet één voor één om. Wat verandert is dat er nu twee
-- rollen onder vallen.
-- ---------------------------------------------------------------------
create or replace function is_beheerder()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select rol in ('manager', 'eigenaar') and actief
       from personen
      where auth_user_id = auth.uid()),
    false);
$$;


-- ---------------------------------------------------------------------
-- En wie is de eigenaar?
--
-- Alleen voor twee dingen: de export, en het aanraken van een andere
-- eigenaar.
-- ---------------------------------------------------------------------
create or replace function is_eigenaar()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select rol = 'eigenaar' and actief
       from personen
      where auth_user_id = auth.uid()),
    false);
$$;


-- ---------------------------------------------------------------------
-- De boekhouding is van de eigenaar
--
-- Let op wat dit wél en niet doet. Een manager die diensten bevestigt
-- ziet gewerkte uren -- dat is nu eenmaal wat er op dat scherm staat, en
-- zonder die uren kan hij niets beoordelen. Wat hij niet krijgt is het
-- bestand dat naar de boekhouder gaat: het overzicht over een periode,
-- van de hele ploeg, in één keer.
--
-- Dat verschil zit hier en niet alleen in de route. Zet iemand de link
-- naar het bestand door, dan komt er nog steeds niets uit.
-- ---------------------------------------------------------------------
create or replace view uren_export
with (security_invoker = true) as
select
  p.naam                                              as medewerker,
  d.datum,
  po.naam                                             as post,
  d.werkelijk_begin                                   as begin,
  d.werkelijk_eind                                    as einde,
  extract(epoch from (d.werkelijk_eind - d.werkelijk_begin)) / 3600 as uren,
  (d.gepland_begin, d.gepland_eind)
    is distinct from (d.werkelijk_begin, d.werkelijk_eind)          as afwijkend,
  d.opmerking
from diensten d
join personen p  on p.id  = d.persoon_id
join posten   po on po.id = d.post_id
where d.status = 'bevestigd'
  and is_eigenaar()
order by p.naam, d.datum;

grant select on uren_export to authenticated;


-- ---------------------------------------------------------------------
-- Een manager komt niet aan een eigenaar
--
-- using is de rij zoals hij was, with check de rij zoals hij wordt. Door
-- allebei te toetsen kan een manager een eigenaar niet wijzigen én
-- niemand tot eigenaar promoveren -- die tweede is anders het gaatje
-- waar de hele rangorde doorheen valt.
-- ---------------------------------------------------------------------
drop policy if exists personen_wijzigen  on personen;
drop policy if exists personen_toevoegen on personen;

-- Een manager neemt bezorgers aan, en verder niemand. Wie er manager wordt
-- beslist de eigenaar.
create policy personen_toevoegen on personen
  for insert to authenticated
  with check (is_eigenaar() or (is_beheerder() and rol = 'medewerker'));

create policy personen_wijzigen on personen
  for update to authenticated
  using      (is_eigenaar() or (is_beheerder() and rol <> 'eigenaar'))
  with check (is_eigenaar() or (is_beheerder() and rol <> 'eigenaar'));

-- ---------------------------------------------------------------------
-- Rollen zijn van de eigenaar
--
-- De policy hierboven houdt een manager bij een eigenaar vandaan, maar niet
-- bij het veld `rol` zelf: een policy ziet de rij zoals hij was óf zoals hij
-- wordt, nooit allebei tegelijk. Voor "dit veld mag jij niet veranderen" heb
-- je dus een trigger nodig -- dezelfde reden als bij
-- dienst_wijziging_bewaken(), waar een medewerker zijn eigen geplande tijden
-- niet mag verzetten.
--
-- Wat een manager wél mag: iemand aannemen, een naam corrigeren, iemand op
-- non-actief zetten. Wat hij niet mag: van iemand een manager maken, of van
-- zichzelf een eigenaar.
-- ---------------------------------------------------------------------
create or replace function persoon_wijziging_bewaken()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- service role (migraties, scripts) en de eigenaar mogen alles
  if auth.uid() is null or is_eigenaar() then
    return new;
  end if;

  if old.rol = 'eigenaar' then
    raise exception 'Alleen een eigenaar wijzigt een eigenaar';
  end if;

  if new.rol is distinct from old.rol then
    raise exception 'Alleen een eigenaar wijzigt rollen';
  end if;

  return new;
end;
$$;

drop trigger if exists persoon_wijziging_bewaken on personen;

create trigger persoon_wijziging_bewaken
  before update on personen
  for each row execute function persoon_wijziging_bewaken();


-- ---------------------------------------------------------------------
-- Wie er niet meer werkt, komt nergens meer bij
--
-- huidige_persoon_id() keek alleen of de login aan een persoon hing, niet
-- of die persoon er nog werkte. Iemand op non-actief kon dus nog gewoon
-- zijn eigen diensten zien en melden.
--
-- De login blijft bestaan -- weggooien zou de koppeling met zijn oude
-- diensten meenemen -- maar hij levert niets meer op. Vinkt de baas hem
-- weer aan, dan werkt alles weer.
-- ---------------------------------------------------------------------
create or replace function huidige_persoon_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select id from personen where auth_user_id = auth.uid() and actief;
$$;
