-- =====================================================================
-- Fase 15 -- Je diensten in je eigen agenda
--
-- Eén tabel en twee functies. Je maakt een agendalink, plakt die in de
-- agenda die je toch al open hebt, en je diensten staan erin.
--
-- Dit is de enige plek in de app waar een link écht een geheim is. Bij
-- ruilen kon het zonder -- daar moet je inloggen om te accepteren -- maar
-- een agenda-app kan niet inloggen. Wie die URL heeft ziet dus waar en
-- wanneer jij werkt, en daarom staat hier alleen de hash van de sleutel
-- en is er een knop om er een nieuwe te maken.
--
-- Staat ook als los bestand in `agenda.sql`, en veilig om twee keer te
-- draaien.
-- =====================================================================


-- ---------------------------------------------------------------------
-- agenda_sleutels
--
-- Eén actieve sleutel per persoon: een nieuwe maakt de oude ongeldig.
-- Dat is nodig omdat zo'n URL op plekken belandt waar je hem niet meer
-- weghaalt -- Google kopieert hem naar zijn eigen servers zodra je hem
-- daar gebruikt. "Nieuwe link" is dus geen gemak maar het enige middel
-- om een oude link dood te maken.
--
-- laatst_gebruikt_op is er om één vraag te kunnen beantwoorden: haalt er
-- nog iets die agenda op, of abonneerde niemand zich ooit?
-- ---------------------------------------------------------------------
create table if not exists agenda_sleutels (
  id                 uuid primary key default gen_random_uuid(),
  persoon_id         uuid not null references personen(id) on delete cascade,
  sleutel_hash       text not null,
  aangemaakt_op      timestamptz not null default now(),
  ingetrokken_op     timestamptz,
  laatst_gebruikt_op timestamptz
);

create unique index if not exists agenda_sleutel_uniek
  on agenda_sleutels (sleutel_hash);

create index if not exists agenda_sleutel_per_persoon
  on agenda_sleutels (persoon_id)
  where ingetrokken_op is null;


-- ---------------------------------------------------------------------
-- Een sleutel zetten of intrekken
--
-- Dit gebeurt terwijl je ingelogd bent, dus met je eigen sessie en
-- zonder beheersleutel. De sleutel zelf verzint de app; hier komt alleen
-- de hash binnen -- zo staat het geheim nergens dubbel.
-- ---------------------------------------------------------------------
create or replace function agenda_sleutel_zetten(p_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ik uuid := huidige_persoon_id();
begin
  if v_ik is null then
    raise exception 'Je bent niet ingelogd';
  end if;

  update agenda_sleutels
     set ingetrokken_op = now()
   where persoon_id = v_ik
     and ingetrokken_op is null;

  insert into agenda_sleutels (persoon_id, sleutel_hash) values (v_ik, p_hash);
  return true;
end;
$$;

create or replace function agenda_sleutel_intrekken()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ik uuid := huidige_persoon_id();
begin
  update agenda_sleutels
     set ingetrokken_op = now()
   where persoon_id = v_ik
     and ingetrokken_op is null;
  return found;
end;
$$;


-- ---------------------------------------------------------------------
-- En wat er in die agenda hoort
--
-- Alleen de diensten van de eigenaar van deze sleutel, en alleen wat er
-- in een agenda thuishoort: dag, geplande tijden, welke post. Geen
-- werkelijke tijden en geen opmerkingen -- dezelfde reden als bij de
-- view `rooster`: dat gaat over geld en dat blijft tussen hem en de baas.
--
-- Vier weken terug en alles wat komt. Verder terug groeit het bestand
-- elk jaar en leest niemand het ooit.
--
-- laatst_gewijzigd komt uit `mutaties`, en dat is een mooi bijeffect van
-- het logboek: een agenda wil weten wanneer een gebeurtenis veranderde,
-- en `diensten` heeft alleen aangemaakt_op. Zonder dat blijft een
-- verzette dienst in sommige agenda's op de oude tijd staan.
--
-- Vervallen en afgemelde diensten komen er niet in. Ze verdwijnen dan
-- gewoon uit de lijst, en een agenda haalt weg wat er niet meer staat --
-- daar is geen afmelding voor nodig.
-- ---------------------------------------------------------------------
create or replace function agenda_diensten(p_sleutel text)
returns table (
  dienst_id        uuid,
  datum            date,
  gepland_begin    time,
  gepland_eind     time,
  post             text,
  laatst_gewijzigd timestamptz,
  versie           integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sleutel agenda_sleutels;
begin
  select * into v_sleutel
    from agenda_sleutels
   where sleutel_hash = encode(sha256(convert_to(p_sleutel, 'utf8')), 'hex')
     and ingetrokken_op is null;

  if not found then
    return;   -- geen rijen: de route maakt er een 404 van
  end if;

  update agenda_sleutels set laatst_gebruikt_op = now() where id = v_sleutel.id;

  return query
    select
      d.id,
      d.datum,
      d.gepland_begin,
      d.gepland_eind,
      po.naam,
      coalesce(max(m.wanneer), d.aangemaakt_op),
      count(m.id)::integer
    from diensten d
    join posten po on po.id = d.post_id
    left join mutaties m on m.dienst_id = d.id
   where d.persoon_id = v_sleutel.persoon_id
     and d.status not in ('afgemeld', 'vervallen')
     and d.datum >= current_date - interval '4 weeks'
   group by d.id, d.datum, d.gepland_begin, d.gepland_eind, po.naam, d.aangemaakt_op
   order by d.datum;
end;
$$;


-- ---------------------------------------------------------------------
-- Rechten
--
-- De tabel gaat op slot: geen policy, dus niemand komt er via de app bij.
-- Wie zijn eigen hash kan lezen heeft er niets aan, maar wie die van een
-- ander kan lezen ook niet -- en dat is precies het punt.
--
-- Het zetten mag je zelf (je bent ingelogd). Het ophalen van de agenda
-- gebeurt door een agenda-app die niet ingelogd is, dus dat gaat via de
-- server met de beheersleutel. Vandaar: geen execute voor anon.
-- ---------------------------------------------------------------------
alter table agenda_sleutels enable row level security;

grant execute on function agenda_sleutel_zetten(text)  to authenticated;
grant execute on function agenda_sleutel_intrekken()   to authenticated;

revoke all on function agenda_diensten(text) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update on agenda_sleutels to service_role';
    execute 'grant execute on function agenda_diensten(text) to service_role';
  end if;
end $$;
