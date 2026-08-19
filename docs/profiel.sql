-- =====================================================================
-- Fase 10 -- Gebruikersnaam en profielpagina
--
-- Twee kolommen op personen, en één regel erbij in de trigger die
-- bewaakt wat je aan een persoon mag veranderen.
--
--   gebruikersnaam  'daanb' -- alleen om in te loggen, en van de baas
--   telefoon        +31612345678 -- van hem zelf, en van de baas
--
-- De naam en de gebruikersnaam zijn met opzet niet van de persoon zelf.
-- Kan iedereen zijn eigen naam wijzigen, dan staat er morgen iets anders
-- in het rooster dan gisteren en klopt geen enkel oud overzicht meer.
-- Zijn telefoonnummer is wel van hem: dat verandert als hij een nieuw
-- nummer neemt, en daar hoeft de baas niet aan te pas te komen.
--
-- Het adres waarmee iemand inlogt staat NIET hier maar in auth.users.
-- Dat blijft zo: de app zoekt bij een gebruikersnaam het adres op en
-- logt daarmee in. Zie de uitleg bij fase 10 in bouwplan.md.
--
-- Dit bestand staat ook in schema.sql. Het is er apart zodat je het op
-- een database die al draait kunt bijdraaien zonder de rest opnieuw uit
-- te voeren, en het is veilig om twee keer te draaien.
--
-- VOLGORDE: eerst rollen.sql, daarna dit bestand. Rollen.sql zet een
-- oudere versie van persoon_wijziging_bewaken() neer; draai je hem ná
-- dit bestand, dan is de regel hieronder over je eigen rij weer weg.
-- =====================================================================


-- ---------------------------------------------------------------------
-- De kolommen
--
-- Allebei mogen null zijn. Wie er al in staat heeft nog geen van beide,
-- en iemand die nooit inlogt hoeft ook geen gebruikersnaam -- dan blijft
-- hij gewoon in het rooster staan zoals nu.
--
-- De gebruikersnaam staat in kleine letters, cijfers, punt, streepje of
-- liggend streepje. Geen apenstaartje, en dat is niet netheid: het
-- inlogscherm accepteert straks een gebruikersnaam óf een adres, en het
-- verschil daartussen is precies dat teken.
-- ---------------------------------------------------------------------
alter table personen add column if not exists gebruikersnaam text;
alter table personen add column if not exists telefoon      text;

alter table personen drop constraint if exists personen_gebruikersnaam_vorm;
alter table personen add  constraint personen_gebruikersnaam_vorm
  check (gebruikersnaam is null
     or  gebruikersnaam ~ '^[a-z0-9][a-z0-9._-]{1,31}$');

-- Eén vorm en geen zeven. Anders staat hetzelfde nummer er als 06-12345678,
-- 0612345678 en +31 6 12345678 in, en dan is "heeft deze persoon een
-- nummer" nog wel te beantwoorden maar "is dit hetzelfde nummer" niet.
-- De app rekent het om vóór het opslaan; dit is het slot erachter.
--
-- En een Nederlands nummer is precies tien cijfers: +31 en dan negen, want
-- de nul vooraan valt weg tegen het landnummer. Een cijfer te veel of te
-- weinig is de fout die je anders pas merkt als er iemand niet gebeld
-- wordt. Voor een buitenlands nummer weten we de lengte niet, dus daar
-- gelden alleen de grenzen van E.164 zelf.
alter table personen drop constraint if exists personen_telefoon_vorm;
alter table personen add  constraint personen_telefoon_vorm
  check (telefoon is null
     or (telefoon ~ '^\+[1-9][0-9]{7,14}$'
         and (telefoon !~ '^\+31' or telefoon ~ '^\+31[1-9][0-9]{8}$')));

-- Twee keer 'daanb' kan niet, want dan weet het inlogscherm niet wie je
-- bent. Namen mogen wél dubbel: twee mensen mogen allebei Daan heten,
-- want dat is een label en geen sleutel.
create unique index if not exists personen_gebruikersnaam_uniek
  on personen (gebruikersnaam)
  where gebruikersnaam is not null;


-- ---------------------------------------------------------------------
-- Van je eigen rij mag je alleen je telefoonnummer wijzigen
--
-- Dit is dezelfde reden als bij `rol`: "je mag je eigen rij aanpassen,
-- maar alleen dit ene veld" past niet in een policy. Een policy ziet de
-- rij zoals hij was óf zoals hij wordt, nooit allebei tegelijk. De
-- policy hieronder zegt dus alleen dát je aan je eigen rij mag komen, en
-- deze trigger zegt waaraan.
--
-- Zonder die trigger is je eigen rij het gat in het hele rechtenmodel:
-- dan zet je jezelf op eigenaar en ben je klaar.
-- ---------------------------------------------------------------------
create or replace function persoon_wijziging_bewaken()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- service role (migraties, scripts) mag alles
  if auth.uid() is null then
    return new;
  end if;

  -- Je eigen rij, en je bent geen beheerder: alleen je telefoonnummer.
  -- Een manager of eigenaar valt hier niet onder -- die mag meer, en voor
  -- hem gelden de regels verderop.
  if not is_beheerder() and old.auth_user_id = auth.uid() then
    if (new.naam, new.rol, new.actief, new.gebruikersnaam, new.auth_user_id)
       is distinct from
       (old.naam, old.rol, old.actief, old.gebruikersnaam, old.auth_user_id) then
      raise exception 'Van je eigen gegevens kun je alleen je telefoonnummer wijzigen';
    end if;
    return new;
  end if;

  -- Niet je eigen rij, en geen beheerder: dan heb je hier niets te zoeken.
  -- De policies laten dit al niet toe; dit is het tweede slot.
  if not is_beheerder() then
    raise exception 'Alleen een beheerder wijzigt iemand anders';
  end if;

  -- de eigenaar mag alles
  if is_eigenaar() then
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
-- En de policy erbij
--
-- personen_wijzigen laat alleen een beheerder aan de tabel. Deze policy
-- komt ernaast te staan (policies zijn een 'of', geen 'en') en laat je
-- aan je eigen rij. Wat je daar mag doen bepaalt de trigger hierboven.
-- ---------------------------------------------------------------------
drop policy if exists personen_eigen_gegevens on personen;

create policy personen_eigen_gegevens on personen
  for update to authenticated
  using      (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());


-- ---------------------------------------------------------------------
-- De beheersleutel mag bij personen. Alleen lezen, alleen deze tabel.
--
-- Dit was de verrassing bij het bouwen van fase 10: "de beheersleutel gaat
-- langs alle rechten heen" is hier niet waar. De grants in schema.sql staan
-- op `authenticated`, en dit Supabase-project is aangemaakt met
-- "automatically expose new tables" uit -- dus de rol achter die sleutel
-- (`service_role`) heeft op geen enkele tabel iets. Dat viel niet op zolang
-- die sleutel alleen voor de Auth-API werd gebruikt: accounts aanmaken en
-- wachtwoorden zetten gaan langs auth.users en niet langs een grant.
--
-- Het opzoeken van een adres bij een gebruikersnaam is de eerste keer dat
-- de server met die sleutel een tabel leest. Zonder de regels hieronder
-- krijgt hij 'permission denied for table personen' en zegt het inlogscherm
-- alleen dat het niet klopt.
--
-- Bewust zo klein mogelijk: lezen, en alleen deze tabel. Wat de sleutel
-- verder nodig heeft, geef je er dan ook bewust bij.
--
-- In een do-blok, want `service_role` bestaat alleen op Supabase. Draai je
-- dit schema op een gewone Postgres, dan slaat hij deze regels over.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant usage on schema public to service_role';
    execute 'grant select on personen to service_role';
  end if;
end $$;


-- ---------------------------------------------------------------------
-- Hier houdt de migratie op.
--
-- Wat er niet in staat: het adres waarmee iemand inlogt. Dat blijft in
-- auth.users en daar komt de gewone sleutel niet bij -- de app zoekt het
-- op met de beheersleutel, op de server, en dat is de enige plek waar
-- een gebruikersnaam en een adres bij elkaar komen. Vandaar het grant
-- hierboven: zonder dat leest ook de beheersleutel `personen` niet.
-- ---------------------------------------------------------------------
