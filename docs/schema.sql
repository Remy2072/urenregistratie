-- =====================================================================
-- Urenregistratie bezorgers / horeca
-- PostgreSQL (Supabase). Generiek opgezet: niets bedrijfsspecifiek
-- in de structuur, alleen in de data.
-- =====================================================================

-- btree_gist: nodig om in één exclusion constraint op zowel een
-- gewone kolom (=) als een periode (&&) te kunnen toetsen. Zie
-- sjabloon_regels.
create extension if not exists btree_gist;


-- ---------------------------------------------------------------------
-- Hulpfunctie: tijden mogen alleen op :00 of :30 vallen
--
-- Let op: hiermee ligt de afrondregel in de database, niet meer in een
-- ongeschreven gewoonte. Klaar om 21:20 kán simpelweg niet bestaan.
-- Wat er open blijft is alleen de richting (21:00 of 21:30) en die zit
-- in de knoppen van het meldscherm, niet hier. Vraag de baas wat hij
-- wil vóór je dat scherm bouwt -- daarna is het een regel.
-- ---------------------------------------------------------------------
create or replace function is_half_uur(t time)
returns boolean
language sql
immutable
set search_path = public
as $$
  select t is null
      or (extract(minute from t) in (0, 30)
          and extract(second from t) = 0);
$$;


-- ---------------------------------------------------------------------
-- personen
-- Nooit verwijderen: op non-actief zetten, anders verdwijnen ze
-- uit oude weken en kloppen historische overzichten niet meer.
--
-- auth_user_id koppelt een persoon aan een Supabase-login. Blijft null
-- tot je stap 6 (login) bouwt; het hele rechtenmodel onderaan dit
-- bestand hangt eraan, dus de kolom staat er nu al in.
-- ---------------------------------------------------------------------
create table personen (
  id             uuid primary key default gen_random_uuid(),
  naam           text        not null,
  rol            text        not null default 'medewerker'
                             check (rol in ('medewerker', 'beheerder')),
  actief         boolean     not null default true,
  auth_user_id   uuid        unique references auth.users(id) on delete set null,
  aangemaakt_op  timestamptz not null default now()
);

create index on personen (actief);


-- ---------------------------------------------------------------------
-- posten
-- De plek waar iemand staat. Bij Tjon: Bus 2, Bus 3, Bus 4.
-- Later gewoon 'Keuken' of 'Balie' toevoegen, geen codewijziging.
-- ---------------------------------------------------------------------
create table posten (
  id        uuid    primary key default gen_random_uuid(),
  naam      text    not null unique,
  volgorde  integer not null default 0,   -- weergavevolgorde in schermen
  actief    boolean not null default true
);


-- ---------------------------------------------------------------------
-- dienstsoorten
-- De standaarddiensten. Bij Tjon: vroeg 15:00-20:00, laat 16:00-21:00.
-- ---------------------------------------------------------------------
create table dienstsoorten (
  id          uuid    primary key default gen_random_uuid(),
  naam        text    not null unique,
  begintijd   time    not null,
  eindtijd    time    not null,
  actief      boolean not null default true,

  constraint dienstsoort_tijden_kloppen check (eindtijd > begintijd),
  constraint dienstsoort_halve_uren     check (is_half_uur(begintijd)
                                          and is_half_uur(eindtijd))
);


-- ---------------------------------------------------------------------
-- sjabloon_regels
-- Het vaste weekrooster. geldig_vanaf/geldig_tot maken het mogelijk
-- het rooster te wijzigen zonder oude weken te herschrijven.
-- ---------------------------------------------------------------------
create table sjabloon_regels (
  id              uuid primary key default gen_random_uuid(),
  weekdag         smallint not null check (weekdag between 1 and 7), -- 1 = maandag
  post_id         uuid not null references posten(id),
  persoon_id      uuid not null references personen(id),
  dienstsoort_id  uuid not null references dienstsoorten(id),
  geldig_vanaf    date not null default current_date,
  geldig_tot      date,                                  -- null = loopt door

  constraint sjabloon_periode_klopt check (geldig_tot is null
                                        or geldig_tot >= geldig_vanaf),

  -- Dezelfde post, dezelfde weekdag, dezelfde dienstsoort, in een periode
  -- die overlapt: dat is één slot dat twee keer bestaat. De uitrol maakt
  -- er dan twee diensten van en je merkt het pas als de bus dubbel bezet
  -- lijkt. Dienstsoort staat er bewust in -- vroeg én laat op dezelfde
  -- bus is legitiem, en straks in de keuken helemaal.
  constraint sjabloon_geen_dubbel_slot
    exclude using gist (
      weekdag                                     with =,
      post_id                                     with =,
      dienstsoort_id                              with =,
      daterange(geldig_vanaf, geldig_tot, '[]')   with &&
    ),

  -- En niemand staat twee keer op dezelfde weekdag. Dit is de sjabloon-
  -- kant van diensten_persoon_bezet: vang je het hier niet, dan loopt de
  -- uitrol elke maandag stuk op die index. Aanname: één dienst per
  -- persoon per dag. Komen er later gebroken diensten, dan moet deze
  -- constraint mee veranderen -- samen met die index.
  constraint sjabloon_geen_dubbele_persoon
    exclude using gist (
      weekdag                                     with =,
      persoon_id                                  with =,
      daterange(geldig_vanaf, geldig_tot, '[]')   with &&
    )
);

create index on sjabloon_regels (weekdag, geldig_vanaf, geldig_tot);


-- ---------------------------------------------------------------------
-- diensten
-- De kern. Eén rij = één dag, één post, één persoon.
--
-- Belangrijk: de geplande tijden staan hier als kopie, niet als verwijzing
-- naar de dienstsoort. Een dienst is een momentopname; als het sjabloon
-- later wijzigt mag de geschiedenis niet meeveranderen.
--
-- werkelijk_begin/eind is wat uitbetaald wordt. Bij 'gedraaid zoals
-- gepland' kopieer je gepland -> werkelijk, zodat elke betaalde dienst
-- altijd werkelijke tijden heeft en de export nooit hoeft te kiezen.
-- ---------------------------------------------------------------------
create table diensten (
  id               uuid primary key default gen_random_uuid(),
  datum            date not null,
  post_id          uuid not null references posten(id),
  persoon_id       uuid          references personen(id),  -- null = nog niemand ingedeeld

  gepland_begin    time not null,
  gepland_eind     time not null,
  werkelijk_begin  time,
  werkelijk_eind   time,

  status           text not null default 'verwacht'
                   check (status in ('verwacht',   -- uitgerold uit sjabloon
                                     'gemeld',     -- medewerker heeft ingevuld
                                     'bevestigd',  -- beheerder akkoord -> telt mee
                                     'afgemeld',   -- niet gewerkt
                                     'vervallen')),-- dienst ging niet door

  gemeld_op        timestamptz,
  gemeld_door      uuid references personen(id),
  bevestigd_op     timestamptz,
  bevestigd_door   uuid references personen(id),

  opmerking        text,
  bron             text not null default 'sjabloon'
                   check (bron in ('sjabloon', 'handmatig')),

  aangemaakt_op    timestamptz not null default now(),

  constraint dienst_gepland_klopt   check (gepland_eind > gepland_begin),
  constraint dienst_werkelijk_klopt check (werkelijk_begin is null
                                        or werkelijk_eind  is null
                                        or werkelijk_eind > werkelijk_begin),
  constraint dienst_halve_uren      check (is_half_uur(gepland_begin)
                                       and is_half_uur(gepland_eind)
                                       and is_half_uur(werkelijk_begin)
                                       and is_half_uur(werkelijk_eind)),

  -- een gemelde of bevestigde dienst moet werkelijke tijden hebben
  constraint dienst_gemeld_heeft_tijden check (
    status not in ('gemeld', 'bevestigd')
    or (werkelijk_begin is not null and werkelijk_eind is not null)
  ),

  -- en andersom: niet gewerkt is niet gewerkt. Een afgemelde dienst met
  -- tijden erin telt niet mee in de export, maar leest bij discussie
  -- wel als bewijs dat er gewerkt is. Die dubbelzinnigheid wil je niet.
  constraint dienst_niet_gewerkt_geen_tijden check (
    status not in ('afgemeld', 'vervallen')
    or (werkelijk_begin is null and werkelijk_eind is null)
  )
);

create index on diensten (datum);
create index on diensten (persoon_id, datum);
create index on diensten (status);

-- Niet twee keer dezelfde bus op dezelfde dag met dezelfde starttijd.
--
-- Partieel, geen gewone unique constraint: gaat Bus 3 van 16:00 niet door
-- en zet je hem op vervallen, dan moet je er wél een nieuwe naast kunnen
-- zetten. Een harde unique blokkeert precies de correctie waar je hem
-- voor nodig hebt.
-- Bij de wekelijkse uitrol moet je de where-clause meegeven om deze
-- index te raken, anders vindt Postgres hem niet:
--   on conflict (datum, post_id, gepland_begin)
--     where status not in ('afgemeld','vervallen') do nothing
create unique index diensten_post_bezet
  on diensten (datum, post_id, gepland_begin)
  where status not in ('afgemeld', 'vervallen');

-- Niemand staat op twee plekken tegelijk.
--
-- De index hierboven vangt dubbele bezetting van één bus, maar niet dat
-- iemand na een half doorgevoerde ruil op Bus 2 én Bus 3 staat -- en dat
-- is precies de fout die je pas in de export terugziet.
create unique index diensten_persoon_bezet
  on diensten (persoon_id, datum)
  where status not in ('afgemeld', 'vervallen');

-- Vlaggetje "achteraf gemeld": geen kolom, maar afleidbaar.
-- gemeld_op::date > datum  =>  na de dienst ingevuld.


-- ---------------------------------------------------------------------
-- mutaties
-- Logboek van elke wijziging op een dienst. Zonder papieren bonnetje
-- is dit het enige bewijs bij discussie. Alleen toevoegen, nooit wijzigen.
-- ---------------------------------------------------------------------
create table mutaties (
  id             bigserial primary key,
  dienst_id      uuid not null references diensten(id) on delete cascade,
  wie            uuid          references personen(id),
  wanneer        timestamptz not null default now(),
  veld           text not null,          -- 'werkelijk_eind', 'persoon_id', 'status'
  oude_waarde    text,
  nieuwe_waarde  text
);

create index on mutaties (dienst_id, wanneer);


-- ---------------------------------------------------------------------
-- Weergave voor de export naar de boekhouder.
-- Alleen uren, nooit euro's. Loon is de boekhouder zijn werk.
--
-- security_invoker: zonder dit draait een view met de rechten van de
-- eigenaar en omzeilt hij de row level security hieronder -- dan leest
-- elke medewerker via deze view alsnog de uren van de hele ploeg.
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
order by p.naam, d.datum;


-- =====================================================================
-- Rechten
--
-- Op Supabase is de anon key publiek: die zit gewoon in de JavaScript
-- van je app. Zonder row level security kan iedereen die de key uit de
-- broncode plukt alle namen en uren van het personeel lezen. Dit hoort
-- dus bij het schema, niet bij stap 6 (login).
--
-- Het model is dezelfde rolscheiding als de statusflow: medewerker
-- meldt, beheerder bevestigt. Alleen nu afgedwongen door de database
-- in plaats van door het scherm.
--
-- De service role key (server-side, bijv. de wekelijkse uitrol van het
-- sjabloon) omzeilt dit alles. Die hoort nooit in browsercode.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Wie ben ik, en mag ik beheren?
--
-- security definer omdat deze functies zelf in de policies op personen
-- gebruikt worden -- zonder dat draait de policy in zichzelf rond.
-- ---------------------------------------------------------------------
create or replace function huidige_persoon_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select id from personen where auth_user_id = auth.uid();
$$;

create or replace function is_beheerder()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select rol = 'beheerder' and actief
       from personen
      where auth_user_id = auth.uid()),
    false);
$$;


-- ---------------------------------------------------------------------
-- Wat een medewerker niet zelf mag zetten
--
-- De policy hieronder houdt hem al binnen zijn eigen dienst en belet
-- dat hij zichzelf bevestigt. Wat dan nog openstaat: zijn geplande
-- eindtijd op 23:00 zetten en dat vervolgens als "gedraaid zoals
-- gepland" melden. Dat is het bonnetjesprobleem digitaal nagebouwd,
-- dus die velden zitten op slot.
-- ---------------------------------------------------------------------
create or replace function dienst_wijziging_bewaken()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- stempel het bevestigen, wie het ook doet
  if new.status = 'bevestigd' and old.status is distinct from 'bevestigd' then
    new.bevestigd_op   := coalesce(new.bevestigd_op,   now());
    new.bevestigd_door := coalesce(new.bevestigd_door, huidige_persoon_id());
  end if;

  -- service role (uitrol, migraties) en beheerder mogen alles
  if auth.uid() is null or is_beheerder() then
    return new;
  end if;

  if new.datum         is distinct from old.datum
  or new.post_id       is distinct from old.post_id
  or new.persoon_id    is distinct from old.persoon_id
  or new.gepland_begin is distinct from old.gepland_begin
  or new.gepland_eind  is distinct from old.gepland_eind
  or new.bron          is distinct from old.bron then
    raise exception 'Alleen een beheerder mag het rooster van een dienst wijzigen';
  end if;

  if new.bevestigd_op   is distinct from old.bevestigd_op
  or new.bevestigd_door is distinct from old.bevestigd_door then
    raise exception 'Alleen een beheerder mag een dienst bevestigen';
  end if;

  -- stempel de melding zelf, zodat "achteraf gemeld" klopt
  new.gemeld_op   := now();
  new.gemeld_door := huidige_persoon_id();

  return new;
end;
$$;

create trigger dienst_wijziging_bewaken
  before update on diensten
  for each row execute function dienst_wijziging_bewaken();


-- ---------------------------------------------------------------------
-- Het logboek vult zichzelf
--
-- Zonder papieren bonnetje is dit het enige bewijs bij discussie. Laat
-- je de app die regels schrijven, dan ontbreken ze precies bij de weg
-- waar niemand aan dacht -- een correctie via de Supabase-console, een
-- script, een tweede scherm. Hier komt geen wijziging langs die niet
-- gelogd wordt.
--
-- security definer, dus de trigger schrijft langs RLS heen. Daardoor
-- heeft niemand een insert-policy op mutaties nodig en kan de app dus
-- ook geen regels vervalsen.
-- ---------------------------------------------------------------------
create or replace function dienst_mutaties_loggen()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  wie_nu uuid   := huidige_persoon_id();   -- null bij service role
  oud    jsonb  := to_jsonb(old);
  nieuw  jsonb  := to_jsonb(new);
  veld   text;
  velden text[] := array[
    'datum', 'post_id', 'persoon_id',
    'gepland_begin', 'gepland_eind',
    'werkelijk_begin', 'werkelijk_eind',
    'status', 'opmerking'
  ];
begin
  if tg_op = 'INSERT' then
    insert into mutaties (dienst_id, wie, veld, oude_waarde, nieuwe_waarde)
    values (new.id, wie_nu, 'aangemaakt', null, new.status);
    return null;
  end if;

  foreach veld in array velden loop
    if oud ->> veld is distinct from nieuw ->> veld then
      insert into mutaties (dienst_id, wie, veld, oude_waarde, nieuwe_waarde)
      values (new.id, wie_nu, veld, oud ->> veld, nieuw ->> veld);
    end if;
  end loop;

  return null;
end;
$$;

create trigger dienst_mutaties_loggen
  after insert or update on diensten
  for each row execute function dienst_mutaties_loggen();


-- ---------------------------------------------------------------------
-- Policies
-- Geen policy = geen toegang. Alles staat op 'authenticated', dus de
-- anon key op zichzelf komt nergens meer bij.
-- ---------------------------------------------------------------------
alter table personen        enable row level security;
alter table posten          enable row level security;
alter table dienstsoorten   enable row level security;
alter table sjabloon_regels enable row level security;
alter table diensten        enable row level security;
alter table mutaties        enable row level security;

-- personen: je ziet jezelf, de beheerder ziet de ploeg.
-- Geen delete-policy: iemand hoort op non-actief te gaan, niet weg.
create policy personen_lezen on personen
  for select to authenticated
  using (is_beheerder() or auth_user_id = auth.uid());

create policy personen_toevoegen on personen
  for insert to authenticated with check (is_beheerder());

create policy personen_wijzigen on personen
  for update to authenticated
  using (is_beheerder()) with check (is_beheerder());

-- posten en dienstsoorten: geen persoonsgegevens, iedereen mag lezen
create policy posten_lezen on posten
  for select to authenticated using (true);

create policy posten_beheren on posten
  for all to authenticated
  using (is_beheerder()) with check (is_beheerder());

create policy dienstsoorten_lezen on dienstsoorten
  for select to authenticated using (true);

create policy dienstsoorten_beheren on dienstsoorten
  for all to authenticated
  using (is_beheerder()) with check (is_beheerder());

-- sjabloon: je eigen vaste dagen mag je zien, wijzigen niet
create policy sjabloon_lezen on sjabloon_regels
  for select to authenticated
  using (is_beheerder() or persoon_id = huidige_persoon_id());

create policy sjabloon_beheren on sjabloon_regels
  for all to authenticated
  using (is_beheerder()) with check (is_beheerder());

-- diensten: je eigen week zien en melden, meer niet
create policy diensten_lezen on diensten
  for select to authenticated
  using (is_beheerder() or persoon_id = huidige_persoon_id());

-- using = de rij zoals hij was, with check = de rij zoals hij wordt.
-- Daardoor kun je 'verwacht' of 'gemeld' naar 'gemeld' brengen, maar
-- nooit naar 'bevestigd', en de dienst nooit op een ander zetten.
create policy diensten_melden on diensten
  for update to authenticated
  using      (persoon_id = huidige_persoon_id()
              and status in ('verwacht', 'gemeld'))
  with check (persoon_id = huidige_persoon_id()
              and status = 'gemeld');

-- Geen delete-policy, ook niet voor de beheerder: een dienst gaat op
-- 'afgemeld' of 'vervallen', hij verdwijnt niet. Wissen zou namelijk
-- ook het logboek meenemen (mutaties cascadet mee) -- precies het
-- bewijs waar je bij discussie op terugvalt.
create policy diensten_invoeren on diensten
  for insert to authenticated with check (is_beheerder());

create policy diensten_beheren on diensten
  for update to authenticated
  using (is_beheerder()) with check (is_beheerder());

-- mutaties: je leest wat over jou gaat, en verder kan niemand hier iets.
-- Schrijven doet alleen de trigger hierboven; die draait als eigenaar en
-- heeft geen policy nodig. Geen insert-policy betekent dus ook dat de
-- app geen regels in het logboek kan verzinnen.
create policy mutaties_lezen on mutaties
  for select to authenticated
  using (is_beheerder()
         or exists (select 1 from diensten d
                     where d.id = mutaties.dienst_id
                       and d.persoon_id = huidige_persoon_id()));


-- ---------------------------------------------------------------------
-- Toegang tot de tabellen
--
-- Policies en rechten zijn twee verschillende sloten en je moet er allebei
-- doorheen. Een policy zegt wélke rijen je mag zien; een grant zegt of je
-- de tabel überhaupt mag aanraken. Zonder deze regels werken de policies
-- prima en krijgt de app alsnog 'permission denied'.
--
-- Ze staan hier expliciet omdat het Supabase-project is aangemaakt met
-- "automatically expose new tables" uit. Dat is de veilige stand: een
-- tabel die je later toevoegt is dan niet meteen bereikbaar, maar pas
-- wanneer je hem hier neerzet.
--
-- Wat er NIET staat is net zo belangrijk:
--   * niets voor `anon` -- niet ingelogd is geen toegang, punt.
--   * geen delete waar geen delete-policy is (personen, diensten,
--     mutaties). Dubbel op slot.
--   * geen insert of update op mutaties. Het logboek wordt alleen door
--     de trigger geschreven, en die draait als eigenaar.
-- ---------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, insert, update         on personen        to authenticated;
grant select, insert, update, delete on posten          to authenticated;
grant select, insert, update, delete on dienstsoorten   to authenticated;
grant select, insert, update, delete on sjabloon_regels to authenticated;
grant select, insert, update         on diensten        to authenticated;
grant select                         on mutaties        to authenticated;
grant select                         on uren_export     to authenticated;

-- =====================================================================
-- Beschikbaarheid (fase 9)
--
-- Staat ook als los bestand in `beschikbaarheid.sql`, zodat je het op een
-- database die al draait kunt bijdraaien. Hier staat het omdat een verse
-- installatie compleet moet zijn met één bestand.
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



-- ---------------------------------------------------------------------
-- Hier houdt het schema op.
--
-- Wat hierboven staat is voor elk bedrijf hetzelfde: tabellen, constraints,
-- rechten. Wat een bedrijf eigen maakt -- welke bussen, welke diensttijden,
-- wie er rijdt -- staat in `startdata.sql` en is data, geen code.
--
-- Draai dus eerst dit bestand en daarna dat. Zonder startdata werkt alles,
-- er staat alleen nog niets in.
-- ---------------------------------------------------------------------
