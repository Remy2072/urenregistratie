-- =====================================================================
-- Fase 14 -- Diensten ruilen
--
-- Eén tabel en vijf functies. Een bezorger vraagt een dienst weg, aan
-- één collega of aan de hele groep, en wie accepteert krijgt hem.
--
-- Waarom dit functies zijn en geen policies: op `diensten` staat bewust
-- `with check (persoon_id = huidige_persoon_id())`, zodat niemand een
-- dienst op een ander kan zetten. Dat slot blijft staan. Deze functies
-- draaien als eigenaar en controleren zelf wat een policy niet kan
-- controleren -- dat het verzoek van jou is, dat de dienst nog niet
-- gemeld is, en dat je die dag vrij bent.
--
-- Wat er NIET in staat is een geheim. Accepteren kan alleen ingelogd, en
-- wie die dag vrij is mag het. De link naar een verzoek is dus een adres
-- en geen sleutel; er valt niets af te schermen wat niet al mag.
--
-- Staat ook in schema.sql. Veilig om twee keer te draaien.
-- =====================================================================


-- ---------------------------------------------------------------------
-- ruilverzoeken
--
-- naar_persoon_id leeg = een open verzoek: de link gaat in de groepsapp
-- en wie het eerst accepteert krijgt de dienst.
--
-- Ze blijven staan na afhandeling. Dat is het antwoord op "wie heeft die
-- avond eigenlijk geruild" -- samen met `mutaties`, dat de wisseling van
-- persoon_id vastlegt.
-- ---------------------------------------------------------------------
create table if not exists ruilverzoeken (
  id              uuid primary key default gen_random_uuid(),
  dienst_id       uuid not null references diensten(id) on delete cascade,
  van_persoon_id  uuid not null references personen(id),
  naar_persoon_id uuid          references personen(id),

  status          text not null default 'open'
                  check (status in ('open',          -- wacht op antwoord
                                    'geaccepteerd',  -- de dienst is verhuisd
                                    'geweigerd',     -- nee gezegd
                                    'ingetrokken')), -- vrager sluit hem zelf

  door_persoon_id uuid          references personen(id),  -- wie accepteerde
  aangemaakt_op   timestamptz not null default now(),
  beantwoord_op   timestamptz
);

-- Eén openstaand verzoek per dienst. Gericht óf open, niet beide -- anders
-- zeggen er twee langs verschillende wegen ja, en dan is de database wel
-- veilig maar de sfeer niet. Partieel, zodat een afgehandeld verzoek een
-- nieuw verzoek niet blokkeert.
create unique index if not exists ruilverzoek_een_per_dienst
  on ruilverzoeken (dienst_id)
  where status = 'open';

create index if not exists ruilverzoeken_voor_mij
  on ruilverzoeken (naar_persoon_id, status);


-- ---------------------------------------------------------------------
-- Wie kan die dag?
--
-- Deze functie bestaat omdat de rechten kloppen: een bezorger mag via
-- `personen` alleen zichzelf zien, dus zonder dit is er geen
-- keuzelijstje. Wat eruit komt is precies wat je nodig hebt om iemand te
-- kiezen -- en geen telefoonnummers.
--
-- `kan` komt uit beschikbaarheid en is een kleuring, geen slot: "ik had
-- weggezet maar ik doe het wel" moet kunnen. `bezet` is wél een slot,
-- want diensten_persoon_bezet weigert het toch.
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
    and p.rol <> 'eigenaar'          -- een eigenaar wordt niet ingeroosterd
    and p.id <> d.persoon_id         -- en jezelf vragen heeft geen zin
  order by p.naam;
$$;


-- ---------------------------------------------------------------------
-- Een verzoek aanmaken
--
-- p_naar leeg = open verzoek. Geeft het id terug plus, bij een gericht
-- verzoek, de naam en het nummer van degene die de sms krijgt -- dat
-- nummer komt dus nooit in een browser, alleen op de server.
--
-- Alles wat hier gecontroleerd wordt kan een policy niet: is deze dienst
-- van mij, moet hij nog komen, staat hij nog op 'verwacht'.
-- ---------------------------------------------------------------------
create or replace function ruil_aanvragen(p_dienst_id uuid, p_naar uuid default null)
returns table (verzoek_id uuid, naar_naam text, naar_telefoon text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ik      uuid := huidige_persoon_id();
  v_dienst  diensten;
  v_naar    personen;
  v_id      uuid;
begin
  if v_ik is null then
    raise exception 'Je bent niet ingelogd';
  end if;

  select * into v_dienst from diensten where id = p_dienst_id;
  if not found then
    raise exception 'Die dienst bestaat niet';
  end if;
  if v_dienst.persoon_id is distinct from v_ik then
    raise exception 'Dit is jouw dienst niet';
  end if;
  if v_dienst.status <> 'verwacht' then
    raise exception 'Deze dienst is al gemeld of afgehandeld. Vraag de baas om hem te verzetten';
  end if;
  if (v_dienst.datum + v_dienst.gepland_begin) <= now() then
    raise exception 'Deze dienst is al begonnen';
  end if;

  if p_naar is not null then
    select * into v_naar from personen where id = p_naar and actief;
    if not found then
      raise exception 'Die collega bestaat niet of werkt hier niet meer';
    end if;
    if v_naar.rol = 'eigenaar' then
      raise exception 'Een eigenaar wordt niet ingeroosterd';
    end if;
    if exists (select 1 from diensten x
                where x.persoon_id = p_naar
                  and x.datum = v_dienst.datum
                  and x.status not in ('afgemeld', 'vervallen')) then
      raise exception 'Die staat die dag al ergens ingeroosterd';
    end if;
  end if;

  insert into ruilverzoeken (dienst_id, van_persoon_id, naar_persoon_id)
  values (p_dienst_id, v_ik, p_naar)
  returning id into v_id;

  return query
    select v_id, v_naar.naam, v_naar.telefoon;
exception
  when unique_violation then
    raise exception 'Voor deze dienst staat al een verzoek open';
end;
$$;


-- ---------------------------------------------------------------------
-- Accepteren
--
-- Hier zit de wedloop: twee mensen die tegelijk op de link tikken. Het
-- wordt beslist door één update met een where-clause op de dienst zoals
-- hij nu is -- wie als tweede komt, raakt geen rij en krijgt 'te_laat'.
--
-- Geen foutmeldingen maar codes. De app maakt er een zin van, want
-- "diensten_persoon_bezet" is geen taal.
-- ---------------------------------------------------------------------
create or replace function ruil_accepteren(p_verzoek_id uuid)
returns text  -- 'ok' | 'te_laat' | 'niet_voor_jou' | 'bezet' | 'onbekend' | 'verlopen'
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ik      uuid := huidige_persoon_id();
  v_verzoek ruilverzoeken;
  v_dienst  diensten;
  v_raak    integer;
begin
  if v_ik is null then
    return 'onbekend';
  end if;

  select * into v_verzoek from ruilverzoeken where id = p_verzoek_id;
  if not found then
    return 'onbekend';
  end if;
  if v_verzoek.status <> 'open' then
    return 'te_laat';
  end if;

  -- Een gericht verzoek is van één persoon. Een open verzoek is van
  -- iedereen die die dag vrij is -- dat is bewust zo besloten.
  if v_verzoek.naar_persoon_id is not null and v_verzoek.naar_persoon_id <> v_ik then
    return 'niet_voor_jou';
  end if;
  if v_verzoek.van_persoon_id = v_ik then
    return 'niet_voor_jou';
  end if;

  select * into v_dienst from diensten where id = v_verzoek.dienst_id;
  if v_dienst.status <> 'verwacht' or v_dienst.persoon_id is distinct from v_verzoek.van_persoon_id then
    return 'te_laat';
  end if;
  if (v_dienst.datum + v_dienst.gepland_begin) <= now() then
    return 'verlopen';
  end if;

  -- Sta ik die dag al ergens? Dan weigert de index het toch, maar dan met
  -- een fout in plaats van met een antwoord.
  if exists (select 1 from diensten x
              where x.persoon_id = v_ik
                and x.datum = v_dienst.datum
                and x.status not in ('afgemeld', 'vervallen')) then
    return 'bezet';
  end if;

  -- De vlag waarmee dienst_wijziging_bewaken() deze ene wijziging doorlaat.
  -- Zie de uitleg bij die trigger onderaan dit bestand. `true` betekent: alleen
  -- binnen deze transactie, dus na deze functie is hij weer weg.
  perform set_config('app.ruil', 'aan', true);

  -- Dit is de beslissende regel. De where-clause herhaalt wat we net
  -- gelezen hebben; wie als tweede komt raakt geen rij.
  update diensten
     set persoon_id = v_ik
   where id = v_dienst.id
     and persoon_id = v_verzoek.van_persoon_id
     and status = 'verwacht';

  get diagnostics v_raak = row_count;
  if v_raak = 0 then
    return 'te_laat';
  end if;

  update ruilverzoeken
     set status = 'geaccepteerd', door_persoon_id = v_ik, beantwoord_op = now()
   where id = v_verzoek.id;

  return 'ok';
end;
$$;


-- ---------------------------------------------------------------------
-- Weigeren en intrekken
--
-- Weigeren is voor degene aan wie het gevraagd is: dan weet de vrager dat
-- hij verder moet zoeken. Intrekken is voor de vrager zelf, en dat is
-- geen luxe -- de link van een open verzoek blijft in de groepsapp staan,
-- dus je moet hem kunnen sluiten als je iemand in het echt hebt gevonden.
-- ---------------------------------------------------------------------
create or replace function ruil_weigeren(p_verzoek_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ik uuid := huidige_persoon_id();
begin
  update ruilverzoeken
     set status = 'geweigerd', door_persoon_id = v_ik, beantwoord_op = now()
   where id = p_verzoek_id
     and status = 'open'
     and naar_persoon_id = v_ik;   -- een open verzoek weiger je niet, dat negeer je
  return found;
end;
$$;

create or replace function ruil_intrekken(p_verzoek_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ik uuid := huidige_persoon_id();
begin
  update ruilverzoeken
     set status = 'ingetrokken', beantwoord_op = now()
   where id = p_verzoek_id
     and status = 'open'
     and van_persoon_id = v_ik;
  return found;
end;
$$;


-- ---------------------------------------------------------------------
-- Wat er voor mij openstaat
--
-- Eén functie voor drie schermen: de vrager ziet zijn eigen verzoeken,
-- de gevraagde het zijne, en een open verzoek ziet iedereen die het kan
-- overnemen. De baas ziet alles -- hij hoeft niets te doen, maar hij
-- moet het wel kunnen zien.
--
-- security definer omdat de namen van collega's erin staan, en die mag
-- een bezorger via `personen` niet lezen.
-- ---------------------------------------------------------------------
create or replace function mijn_ruilverzoeken()
returns table (
  id            uuid,
  dienst_id     uuid,
  datum         date,
  post          text,
  gepland_begin time,
  gepland_eind  time,
  van_naam      text,
  naar_naam     text,
  open_verzoek  boolean,
  van_mij       boolean,
  voor_mij      boolean,
  status        text,
  aangemaakt_op timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.dienst_id,
    d.datum,
    po.naam,
    d.gepland_begin,
    d.gepland_eind,
    pv.naam,
    pn.naam,
    r.naar_persoon_id is null,
    r.van_persoon_id = huidige_persoon_id(),
    r.naar_persoon_id = huidige_persoon_id(),
    r.status,
    r.aangemaakt_op
  from ruilverzoeken r
  join diensten d  on d.id = r.dienst_id
  join posten   po on po.id = d.post_id
  join personen pv on pv.id = r.van_persoon_id
  left join personen pn on pn.id = r.naar_persoon_id
  where huidige_persoon_id() is not null
    and (
      is_beheerder()
      or r.van_persoon_id  = huidige_persoon_id()
      or r.naar_persoon_id = huidige_persoon_id()
      -- een open verzoek is voor iedereen die het kan overnemen
      or (r.naar_persoon_id is null and r.status = 'open')
    )
  order by d.datum;
$$;


-- ---------------------------------------------------------------------
-- En de trigger moet één deur openzetten
--
-- Dit kostte de eerste ruil: `security definer` gaat langs de policies
-- heen, maar niet langs een trigger. En dienst_wijziging_bewaken() zegt
-- "alleen een beheerder mag het rooster van een dienst wijzigen" zodra
-- persoon_id verandert -- precies wat ruil_accepteren() doet.
--
-- Dat slot moet blijven staan: het is wat verhindert dat een bezorger
-- via de API een dienst op een ander zet. De uitweg is een vlag die
-- alleen ruil_accepteren() zet, en die één transactie meegaat. Een client
-- kan hem niet zetten -- set_config() staat in pg_catalog en dat is via
-- de API niet te bereiken.
--
-- Let op wat het overslaan óók betekent: de stempel gemeld_op/gemeld_door
-- onderaan die trigger wordt niet gezet. Dat is juist goed. Een ruil is
-- geen melding, en wie hem overneemt meldt hem later zelf.
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

  -- service role (uitrol, migraties), beheerder, en de ruilfunctie
  if auth.uid() is null
     or is_beheerder()
     or coalesce(current_setting('app.ruil', true), '') = 'aan' then
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


-- ---------------------------------------------------------------------
-- Rechten
--
-- De tabel zelf gaat op slot: lezen doe je via mijn_ruilverzoeken(), en
-- schrijven alleen via de functies hierboven. Geen insert- of
-- update-policy betekent dat de app geen verzoek kan verzinnen dat de
-- controles overslaat.
--
-- En anders dan bij fase 13 komt hier geen beheersleutel aan te pas:
-- iedereen die iets doet is ingelogd, dus dit gaat met zijn eigen sessie.
-- ---------------------------------------------------------------------
alter table ruilverzoeken enable row level security;

grant select on ruilverzoeken to authenticated;

grant execute on function ruilkandidaten(uuid)       to authenticated;
grant execute on function ruil_aanvragen(uuid, uuid) to authenticated;
grant execute on function ruil_accepteren(uuid)      to authenticated;
grant execute on function ruil_weigeren(uuid)        to authenticated;
grant execute on function ruil_intrekken(uuid)       to authenticated;
grant execute on function mijn_ruilverzoeken()       to authenticated;
