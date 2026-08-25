-- =====================================================================
-- Fase 13 -- Wachtwoord vergeten, met een sms
--
-- Eén tabel. Wie zijn wachtwoord kwijt is vraagt een code aan, krijgt
-- die per sms, en zet daarmee zelf een nieuw wachtwoord.
--
-- Wat er NIET in staat is de code zelf, alleen zijn hash. Een dump van
-- deze database levert dus geen werkende codes op -- en dat is geen
-- overdrijving: met een geldige code kun je iemands wachtwoord zetten,
-- dus dit is precies zo gevoelig als een wachtwoord.
--
-- Hashen doet Postgres, met sha256() uit de kern. Geen extensie nodig,
-- en het gebeurt op één plek: zowel bij het maken als bij het narekenen.
--
-- FASE 16: je begint dit nu ook met je telefoonnummer, niet alleen met je
-- gebruikersnaam. Dat zit in herstel_wie() hieronder, en het is de reden
-- dat er twee `drop function` regels in dit bestand staan.
-- Dit bestand staat ook in schema.sql, zodat een verse installatie
-- compleet is met één bestand. Veilig om twee keer te draaien.
-- =====================================================================


-- ---------------------------------------------------------------------
-- herstelcodes
--
-- Eén rij per aanvraag. Ze blijven staan nadat ze gebruikt zijn: dat is
-- het spoor waarmee je later kunt zien dat er om drie uur 's nachts
-- veertig aanvragen langskwamen. Opruimen mag, maar dan met een
-- bewuste opruimactie en niet stilzwijgend bij elk gebruik.
--
-- sleutel_hash is het tweede geheim, en hij bestaat om één gat te
-- dichten: zonder dat zou iemand het wachtwoordscherm rechtstreeks
-- kunnen openen zonder ooit een code te hebben gehad. Hij wordt gezet
-- zodra de code klopt, en de app bewaart de bijbehorende sleutel in een
-- koekje dat tien minuten meegaat.
-- ---------------------------------------------------------------------
create table if not exists herstelcodes (
  id             uuid primary key default gen_random_uuid(),
  persoon_id     uuid not null references personen(id) on delete cascade,

  code_hash      text not null,
  sleutel_hash   text,

  vervalt_op     timestamptz not null,
  pogingen       smallint    not null default 0,
  bevestigd_op   timestamptz,
  gebruikt_op    timestamptz,
  aangemaakt_op  timestamptz not null default now()
);

-- Waarop gezocht wordt: de laatste code van een persoon, en hoeveel
-- aanvragen hij vandaag al deed.
create index if not exists herstelcodes_per_persoon
  on herstelcodes (persoon_id, aangemaakt_op desc);

create index if not exists herstelcodes_op_sleutel
  on herstelcodes (sleutel_hash)
  where sleutel_hash is not null;


-- ---------------------------------------------------------------------
-- Rechten: niemand komt hier via de app bij
--
-- Row level security aan en geen enkele policy. Dat is geen vergissing
-- maar het hele punt: `authenticated` en `anon` hebben hier niets te
-- zoeken, ook niet om te lezen. Wie zijn eigen herstelcode kan lezen,
-- kan hem ook gebruiken.
--
-- Alleen de server komt erbij, met de beheersleutel, en die gaat langs
-- RLS heen. Vandaar de grant hieronder -- want zoals bij fase 10 bleek
-- heeft die sleutel op een tabel niets tenzij je het geeft.
-- ---------------------------------------------------------------------
alter table herstelcodes enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on herstelcodes to service_role';
  end if;
end $$;


-- ---------------------------------------------------------------------
-- Wie is dit? (fase 16)
--
-- Eén plek waar een gebruikersnaam óf een telefoonnummer een persoon
-- wordt. Het nummer kwam er in fase 16 bij om een simpele reden: wie
-- zijn wachtwoord vergeet, vergeet ook zijn gebruikersnaam -- en zijn
-- telefoon heeft hij in zijn hand. Bovendien is dat nummer het enige
-- van de twee dat hij niet van iemand anders hoeft te horen.
--
-- Hoe we de twee uit elkaar houden: een gebruikersnaam kan nooit met een
-- plus beginnen, want `personen_gebruikersnaam_vorm` staat als eerste
-- teken alleen a-z en 0-9 toe. De app zet 06-12345678 om naar
-- +31612345678 vóór het hier aankomt (zie `telefoon.ts`), dus staat er
-- geen plus, dan is het een gebruikersnaam. Eén teken, en geen gokwerk.
--
-- Twee mensen met hetzelfde nummer -- het huisnummer thuis, een broer in
-- dezelfde ploeg -- levert niets op. Dan weet niemand naar wie er
-- hersteld moet worden en is kiezen precies de fout die je niet wil
-- maken: je zet dan het wachtwoord van iemand anders. Die twee gebruiken
-- hun gebruikersnaam, en dat is één sms minder waard maar geen risico.
-- ---------------------------------------------------------------------
create or replace function herstel_wie(p_wie text)
returns personen
language plpgsql
security definer
set search_path = public
as $$
declare
  v_persoon personen;
  v_aantal  integer;
begin
  if p_wie like '+%' then
    select count(*) into v_aantal
      from personen
     where telefoon = p_wie
       and actief;

    if v_aantal <> 1 then
      return null;
    end if;

    select * into v_persoon
      from personen
     where telefoon = p_wie
       and actief;
  else
    select * into v_persoon
      from personen
     where gebruikersnaam = lower(p_wie)
       and actief;
  end if;

  -- Niets gevonden? Dan zijn alle velden leeg en is .id null. Dat toetsen
  -- de aanroepers, en niet `found` -- die staat na een select into ook op
  -- true als er nul rijen waren.
  return v_persoon;
end;
$$;


-- ---------------------------------------------------------------------
-- Een code aanvragen
--
-- Alles in één functie, en met opzet: de limieten en het hashen horen
-- bij elkaar en niet in een scherm. Hij draait als eigenaar en wordt
-- alleen door de server aangeroepen.
--
-- Wat hij teruggeeft is wat de app moet weten en niet meer: is er iemand
-- met dit kenmerk, is er een nummer, en zo ja -- naar welk nummer en met
-- welke code. Die code komt hier één keer naar buiten en staat daarna
-- alleen nog als hash in de tabel.
--
-- p_wie is een gebruikersnaam of een telefoonnummer; herstel_wie() maakt
-- daar een persoon van. Dat argument heette tot fase 16 p_gebruikersnaam,
-- en daarom staat er een drop boven: een parameternaam wijzigen kan niet
-- met `create or replace` alleen. De drop haalt ook de rechten weg -- die
-- worden onderaan dit bestand opnieuw gegeven.
-- ---------------------------------------------------------------------
drop function if exists herstel_aanvragen(text, text);

create or replace function herstel_aanvragen(p_wie text, p_code text)
returns table (
  uitkomst    text,   -- 'onbekend' | 'geen_nummer' | 'te_vaak' | 'verstuur'
  persoon_id  uuid,
  naam        text,
  telefoon    text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_persoon personen;
  v_vandaag integer;
begin
  v_persoon := herstel_wie(p_wie);

  if v_persoon.id is null then
    return query select 'onbekend'::text, null::uuid, null::text, null::text;
    return;
  end if;

  -- Zonder login is er niets te herstellen: dan bestaat er geen wachtwoord.
  -- Dat leest voor de bezorger als hetzelfde geval als "geen nummer" -- in
  -- beide gevallen moet hij bij de baas zijn.
  if v_persoon.telefoon is null or v_persoon.auth_user_id is null then
    return query select 'geen_nummer'::text, v_persoon.id, v_persoon.naam, null::text;
    return;
  end if;

  select count(*) into v_vandaag
    from herstelcodes
   where herstelcodes.persoon_id = v_persoon.id
     and aangemaakt_op > now() - interval '1 day';

  if v_vandaag >= 3 then
    return query select 'te_vaak'::text, v_persoon.id, v_persoon.naam, null::text;
    return;
  end if;

  -- Een nieuwe aanvraag maakt de vorige ongeldig. Anders liggen er drie
  -- codes klaar die allemaal werken.
  update herstelcodes
     set vervalt_op = now()
   where herstelcodes.persoon_id = v_persoon.id
     and gebruikt_op is null
     and vervalt_op > now();

  insert into herstelcodes (persoon_id, code_hash, vervalt_op)
  values (
    v_persoon.id,
    encode(sha256(convert_to(p_code, 'utf8')), 'hex'),
    now() + interval '10 minutes'
  );

  return query select 'verstuur'::text, v_persoon.id, v_persoon.naam, v_persoon.telefoon;
end;
$$;


-- ---------------------------------------------------------------------
-- Een code narekenen
--
-- Klopt hij, dan komt er een tweede geheim terug: de sleutel voor het
-- wachtwoordscherm. Die zet de app in een koekje, en zonder dat koekje
-- gaat stap 3 niet door.
--
-- De pogingen worden geteld vóórdat er iets anders gebeurt. Drie keer
-- mis en de code is dood -- anders zijn zes cijfers te raden.
-- ---------------------------------------------------------------------
drop function if exists herstel_code_controleren(text, text, text);

create or replace function herstel_code_controleren(
  p_wie     text,
  p_code    text,
  p_sleutel text
)
returns text   -- 'ok' | 'fout' | 'verlopen' | 'onbekend'
language plpgsql
security definer
set search_path = public
as $$
declare
  v_persoon personen;
  v_rij     herstelcodes;
begin
  -- Hetzelfde kenmerk als bij de aanvraag, en dus dezelfde opzoeking. De
  -- app stuurt in stap 2 terug wat er in stap 1 is ingetikt; hier wordt
  -- niets van het een naar het ander omgerekend.
  v_persoon := herstel_wie(p_wie);

  if v_persoon.id is null then
    return 'onbekend';
  end if;

  select * into v_rij
    from herstelcodes
   where persoon_id = v_persoon.id
     and gebruikt_op is null
   order by aangemaakt_op desc
   limit 1;

  if not found or v_rij.vervalt_op <= now() then
    return 'verlopen';
  end if;

  if v_rij.pogingen >= 3 then
    return 'verlopen';
  end if;

  update herstelcodes set pogingen = pogingen + 1 where id = v_rij.id;

  if v_rij.code_hash is distinct from encode(sha256(convert_to(p_code, 'utf8')), 'hex') then
    return 'fout';
  end if;

  update herstelcodes
     set bevestigd_op = now(),
         sleutel_hash = encode(sha256(convert_to(p_sleutel, 'utf8')), 'hex')
   where id = v_rij.id;

  return 'ok';
end;
$$;


-- ---------------------------------------------------------------------
-- En de sleutel inwisselen
--
-- Geeft het auth-account terug waarvoor de app een nieuw wachtwoord mag
-- zetten, en zet de code in één keer op gebruikt. Daarna is die sleutel
-- niets meer waard -- ook niet als iemand het koekje bewaard heeft.
-- ---------------------------------------------------------------------
create or replace function herstel_sleutel_inwisselen(p_sleutel text)
returns table (auth_user_id uuid, naam text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rij herstelcodes;
begin
  select * into v_rij
    from herstelcodes
   where sleutel_hash = encode(sha256(convert_to(p_sleutel, 'utf8')), 'hex')
     and gebruikt_op is null
     and bevestigd_op is not null
     and vervalt_op > now();

  if not found then
    return;
  end if;

  update herstelcodes set gebruikt_op = now() where id = v_rij.id;

  return query
    select p.auth_user_id, p.naam from personen p where p.id = v_rij.persoon_id;
end;
$$;


-- ---------------------------------------------------------------------
-- Alleen de server mag deze drie aanroepen
--
-- Geen execute voor anon of authenticated. Zou `anon` herstel_aanvragen()
-- mogen aanroepen, dan kan iedereen met de publieke sleutel sms'jes laten
-- versturen op kosten van de baas -- en de app zit er dan niet meer
-- tussen om de limieten te bewaken.
-- ---------------------------------------------------------------------
revoke all on function herstel_wie(text)                              from public;
revoke all on function herstel_aanvragen(text, text)                  from public;
revoke all on function herstel_code_controleren(text, text, text)     from public;
revoke all on function herstel_sleutel_inwisselen(text)               from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function herstel_aanvragen(text, text) to service_role';
    execute 'grant execute on function herstel_code_controleren(text, text, text) to service_role';
    execute 'grant execute on function herstel_sleutel_inwisselen(text) to service_role';
  end if;
end $$;
