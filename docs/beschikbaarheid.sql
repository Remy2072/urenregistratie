-- =====================================================================
-- Fase 9 — Beschikbaarheid
--
-- Twee tabellen, om dezelfde reden als sjabloon_regels en diensten twee
-- dingen zijn: er is wat normaal geldt, en er is wat er deze week van
-- afwijkt.
--
--   beschikbaarheid_standaard  -- "ik kan op maandag, dinsdag en zondag"
--   beschikbaarheid_week       -- "deze vrijdag ben ik naar een bruiloft"
--
-- Zonder die scheiding zou je de beschikbaarheid van vorige week
-- overnemen naar deze week, en dan wordt één bruiloft stilzwijgend een
-- vaste vrije dag. Niemand die het merkt, want er staat gewoon wat er
-- stond -- tot iemand na twee maanden vraagt waarom hij nooit meer op
-- vrijdag staat.
--
-- Dit bestand staat ook in schema.sql. Het is er apart zodat je het op
-- een database die al draait kunt bijdraaien zonder de rest opnieuw uit
-- te voeren.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Wat je normaal kunt
--
-- Geen rij = beschikbaar. Dat is met opzet: iemand die dit nooit invult
-- moet gewoon ingeroosterd kunnen worden, precies zoals het nu gaat.
-- Beschikbaarheid is er om nee te zeggen, niet om ja te moeten zeggen.
-- ---------------------------------------------------------------------
create table if not exists beschikbaarheid_standaard (
  persoon_id  uuid     not null references personen(id) on delete cascade,
  weekdag     smallint not null check (weekdag between 1 and 7),  -- 1 = maandag
  kan         boolean  not null default true,
  gezet_op    timestamptz not null default now(),

  primary key (persoon_id, weekdag)
);


-- ---------------------------------------------------------------------
-- En wat er deze week van afwijkt
--
-- week_maandag is altijd een maandag, net als bij de weekuitrol. Zonder
-- die check kun je dezelfde week op zeven manieren opschrijven en vind
-- je je eigen rijen niet meer terug.
-- ---------------------------------------------------------------------
create table if not exists beschikbaarheid_week (
  persoon_id    uuid     not null references personen(id) on delete cascade,
  week_maandag  date     not null,
  weekdag       smallint not null check (weekdag between 1 and 7),
  kan           boolean  not null,
  gezet_op      timestamptz not null default now(),

  primary key (persoon_id, week_maandag, weekdag),
  constraint beschikbaarheid_week_begint_maandag
    check (extract(isodow from week_maandag) = 1)
);

create index if not exists beschikbaarheid_week_op_week
  on beschikbaarheid_week (week_maandag);


-- ---------------------------------------------------------------------
-- beschikbaarheid(maandag) -- de twee tabellen over elkaar heen
--
-- Geeft voor elke actieve persoon zeven regels terug: kan hij, en is dat
-- een afwijking van zijn standaard of niet. Dat laatste is wat het
-- scherm van de baas laat zien -- een incidentele afmelding is iets
-- anders dan iemand die er structureel niet is.
-- ---------------------------------------------------------------------
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
  order by p.naam, d.weekdag;
$$;


-- ---------------------------------------------------------------------
-- Rechten
--
-- Je eigen beschikbaarheid zet je zelf; de beheerder ziet die van
-- iedereen en mag hem ook zetten -- iemand die belt in plaats van het
-- in te vullen moet hij kunnen verwerken.
--
-- Let op het verschil met diensten: daar mag de beheerder nadrukkelijk
-- niet melden namens een ander, want dat gaat over uren. Dit gaat over
-- planning, en daar is namens iemand invullen gewoon zijn werk.
-- ---------------------------------------------------------------------
alter table beschikbaarheid_standaard enable row level security;
alter table beschikbaarheid_week      enable row level security;

drop policy if exists beschikbaarheid_standaard_lezen  on beschikbaarheid_standaard;
drop policy if exists beschikbaarheid_standaard_zetten on beschikbaarheid_standaard;
drop policy if exists beschikbaarheid_week_lezen       on beschikbaarheid_week;
drop policy if exists beschikbaarheid_week_zetten      on beschikbaarheid_week;

-- Iedereen mag zien wie wanneer kan. Dat is planning en geen
-- persoonsgegeven in de zin dat het geheim moet zijn -- het hangt nu ook
-- gewoon in de groepsapp.
create policy beschikbaarheid_standaard_lezen on beschikbaarheid_standaard
  for select to authenticated using (true);

create policy beschikbaarheid_standaard_zetten on beschikbaarheid_standaard
  for all to authenticated
  using      (is_beheerder() or persoon_id = huidige_persoon_id())
  with check (is_beheerder() or persoon_id = huidige_persoon_id());

create policy beschikbaarheid_week_lezen on beschikbaarheid_week
  for select to authenticated using (true);

create policy beschikbaarheid_week_zetten on beschikbaarheid_week
  for all to authenticated
  using      (is_beheerder() or persoon_id = huidige_persoon_id())
  with check (is_beheerder() or persoon_id = huidige_persoon_id());

grant select, insert, update, delete on beschikbaarheid_standaard to authenticated;
grant select, insert, update, delete on beschikbaarheid_week      to authenticated;

-- ---------------------------------------------------------------------
-- rooster -- wie staat er wanneer, voor iedereen zichtbaar
--
-- Dit is het scherm dat het terugscrollen in de groepsapp vervangt, en
-- dus moet elke bezorger de hele week kunnen zien. Dat kan niet via
-- `diensten`: daar laat de policy je alleen je eigen rijen zien, en dat
-- is terecht -- daar staan werkelijke tijden in en die gaan over geld.
--
-- Deze view draait daarom met de rechten van de eigenaar
-- (security_invoker = false) en laat precies zien wat er nu ook in de
-- groepsapp hangt: welke dag, welke bus, wie, en hoe laat gepland.
--
-- Wat er NIET in zit is het punt van deze view: geen werkelijk_begin,
-- geen werkelijk_eind, geen opmerking. Wie hoeveel uren heeft gedraaid
-- blijft tussen hem en de baas.
-- ---------------------------------------------------------------------
create or replace view rooster
with (security_invoker = false) as
select
  d.id,
  d.datum,
  d.post_id,
  po.naam     as post,
  po.volgorde as post_volgorde,
  d.persoon_id,
  p.naam      as persoon,
  d.gepland_begin,
  d.gepland_eind,
  d.status
from diensten d
join posten po on po.id = d.post_id
left join personen p on p.id = d.persoon_id
where d.status <> 'vervallen';

grant select on rooster to authenticated;

