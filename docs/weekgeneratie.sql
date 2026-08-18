-- =====================================================================
-- Fase 3 — Weekgeneratie
--
-- Het sjabloon is het vaste weekrooster; diensten zijn wat er die week
-- daadwerkelijk staat. Dit bestand rolt het eerste uit naar het tweede.
--
-- Twee functies, bewust gescheiden:
--
--   sjabloon_slots(maandag)  -- wat hoort er die week te staan?
--   rol_week_uit(datum)      -- zet het neer, en vertel wat je deed
--
-- Die scheiding is er omdat je de eerste kan draaien zonder iets te
-- veranderen. Voor je een week uitrolt kan je hem dus eerst bekijken,
-- en dat is precies wat je in fase 3 doet: eerst met de hand, een paar
-- weken, en pas als het saai wordt zet je er cron op.
-- =====================================================================


-- ---------------------------------------------------------------------
-- sjabloon_slots -- wat hoort er die week te staan?
--
-- Zeven dagen vanaf de meegegeven maandag, en per dag de sjabloonregels
-- die op die datum geldig zijn. Verandert het rooster halverwege een
-- week, dan valt de knip dus op de dag en niet op de week -- dat is de
-- reden dat geldig_vanaf/geldig_tot datums zijn en geen weeknummers.
--
-- Verandert niets in de database. stable, dus je mag hem los aanroepen:
--   select * from sjabloon_slots(date '2026-08-17');
--
-- inzetbaar staat er apart in in plaats van als filter. Een persoon die
-- op non-actief staat maar nog in het sjabloon zit is namelijk geen lege
-- regel maar een openstaand gat, en dat wil je zien in plaats van
-- stilzwijgend overslaan.
-- ---------------------------------------------------------------------
create or replace function sjabloon_slots(week_maandag date)
returns table (
  datum          date,
  post_id        uuid,
  persoon_id     uuid,
  dienstsoort_id uuid,
  gepland_begin  time,
  gepland_eind   time,
  inzetbaar      boolean
)
language sql
stable
set search_path = public
as $$
  select
    d.datum,
    sr.post_id,
    sr.persoon_id,
    sr.dienstsoort_id,
    ds.begintijd,          -- kopie, geen verwijzing: zie diensten in schema.sql
    ds.eindtijd,
    (pe.actief and po.actief and ds.actief)
  from (
    select (week_maandag + i)::date                        as datum,
           extract(isodow from week_maandag + i)::smallint as weekdag
      from generate_series(0, 6) as i
  ) d
  join sjabloon_regels sr
    on sr.weekdag      = d.weekdag
   and sr.geldig_vanaf <= d.datum
   and (sr.geldig_tot is null or sr.geldig_tot >= d.datum)
  join dienstsoorten ds on ds.id = sr.dienstsoort_id
  join personen      pe on pe.id = sr.persoon_id
  join posten        po on po.id = sr.post_id;
$$;


-- ---------------------------------------------------------------------
-- rol_week_uit -- zet de week neer
--
-- Geef een datum mee, wat voor datum dan ook: hij pakt de maandag van
-- die week. Geef je niets mee, dan is het de week van vandaag *in
-- Nederland* -- zie de opmerking over cron helemaal onderaan, want daar
-- zit de enige plek waar de tijdzone echt pijn kan doen.
--
-- Geeft een regel terug per slot dat er die week hoort te staan, met wat
-- ermee gebeurd is. Draai je hem twee keer, dan zegt de tweede keer
-- overal 'stond er al' en zijn er nul diensten bijgekomen.
--
-- WAT HIJ NOOIT DOET: een bestaande dienst aanraken. Niet overschrijven,
-- niet bijwerken, niet weggooien. Een dienst is vanaf het moment dat hij
-- bestaat van de mensen -- de bezorger meldt erop, de baas bevestigt hem
-- -- en een script dat 's nachts draait hoort daar niet meer bij te
-- kunnen. Alles hieronder is dus insert, en verder niets.
-- ---------------------------------------------------------------------
create or replace function rol_week_uit(week_van date default null)
returns table (
  datum      date,
  post       text,
  persoon    text,
  begintijd  time,
  eindtijd   time,
  resultaat  text
)
language plpgsql
set search_path = public, auth
as $$
-- De kolommen die deze functie teruggeeft heten datum, post, begintijd --
-- en dat zijn ook kolomnamen in diensten. In de on conflict-clausule
-- hieronder weet PostgreSQL dan niet welke van de twee je bedoelt en
-- weigert hij de functie te maken. Deze regel zegt: binnen de queries
-- is een naam altijd de kolom. De teruggegeven rijen worden alleen via
-- return query gevuld, dus daar raakt niets van in de war.
#variable_conflict use_column
declare
  -- date_trunc('week') is in PostgreSQL de ISO-week, dus maandag. Precies
  -- de 1 uit sjabloon_regels.weekdag.
  maandag date := date_trunc('week',
                    coalesce(week_van,
                             (now() at time zone 'Europe/Amsterdam')::date))::date;
  nieuw uuid[];
begin
  -- auth.uid() is null bij de service role: cron en migraties. Dezelfde
  -- afweging als in dienst_wijziging_bewaken().
  if auth.uid() is not null and not is_beheerder() then
    raise exception 'Alleen een beheerder rolt een week uit';
  end if;

  with gemaakt as (
    insert into diensten (datum, post_id, persoon_id,
                          gepland_begin, gepland_eind, bron)
    select s.datum, s.post_id, s.persoon_id,
           s.gepland_begin, s.gepland_eind, 'sjabloon'
      from sjabloon_slots(maandag) s
     where s.inzetbaar

       -- Staat er al iets op deze bus, op dit tijdstip? Dan is dit slot
       -- vergeven. Let op dat hier geen filter op status staat, anders
       -- dan hieronder: een dienst die de baas op 'vervallen' heeft gezet
       -- is een besluit en geen gat. Zou de uitrol daar overheen kijken,
       -- dan zet een tweede run zijn annulering stilletjes terug.
       and not exists (
             select 1 from diensten d
              where d.datum         = s.datum
                and d.post_id       = s.post_id
                and d.gepland_begin = s.gepland_begin)

       -- En staat deze persoon die dag al ergens? Dan overslaan. Dit is
       -- de kant die diensten_persoon_bezet afdwingt maar die on conflict
       -- niet kan opvangen -- dat kan maar op een index tegelijk. Zonder
       -- deze regel loopt de hele uitrol stuk op een geruilde dienst.
       and not exists (
             select 1 from diensten d
              where d.persoon_id = s.persoon_id
                and d.datum      = s.datum
                and d.status not in ('afgemeld', 'vervallen'))

    -- De where-clausule moet mee, anders vindt PostgreSQL de partiele
    -- index niet. Staat ook als comment bij de index in schema.sql.
    -- Hij vangt hier alleen nog een race af: twee uitrollen tegelijk.
    on conflict (datum, post_id, gepland_begin)
      where status not in ('afgemeld', 'vervallen')
    do nothing
    returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into nieuw from gemaakt;

  -- Het rapport. Draait na de insert hierboven en ziet die dus wel --
  -- binnen een functie ziet elke volgende opdracht wat de vorige deed.
  return query
  select s.datum,
         po.naam,
         pe.naam,
         s.gepland_begin,
         s.gepland_eind,
         case
           when not s.inzetbaar
             then 'overgeslagen — staat op non-actief'
           when d.id = any(nieuw)
             then 'nieuw'
           when d.status in ('afgemeld', 'vervallen')
             then 'stond er al — ' || d.status
           when d.id is not null and d.persoon_id is distinct from s.persoon_id
             then 'stond er al — op naam van ' || coalesce(dp.naam, 'niemand')
           when d.id is not null
             then 'stond er al'
           when pd.id is not null
             then 'overgeslagen — die dag al een andere dienst'
           else 'niet geplaatst'
         end
    from sjabloon_slots(maandag) s
    join posten   po on po.id = s.post_id
    join personen pe on pe.id = s.persoon_id

    -- Op een slot kunnen meerdere diensten staan: een vervallen en zijn
    -- vervanger. De levende telt.
    left join lateral (
      select dd.id, dd.persoon_id, dd.status
        from diensten dd
       where dd.datum         = s.datum
         and dd.post_id       = s.post_id
         and dd.gepland_begin = s.gepland_begin
       order by (dd.status not in ('afgemeld', 'vervallen')) desc,
                dd.aangemaakt_op
       limit 1
    ) d on true
    left join personen dp on dp.id = d.persoon_id

    left join lateral (
      select dd.id
        from diensten dd
       where dd.persoon_id = s.persoon_id
         and dd.datum      = s.datum
         and dd.status not in ('afgemeld', 'vervallen')
       limit 1
    ) pd on true

   order by s.datum, po.volgorde;
end;
$$;


-- ---------------------------------------------------------------------
-- Rechten
--
-- Geen security definer. Deze functie draait dus met de rechten van wie
-- hem aanroept, en loopt daarmee gewoon tegen row level security aan --
-- net als elk scherm. De check bovenin geeft alleen een leesbaardere
-- fout dan de policy zelf zou geven.
-- ---------------------------------------------------------------------
revoke execute on function sjabloon_slots(date) from public;
revoke execute on function rol_week_uit(date)   from public;
grant  execute on function sjabloon_slots(date) to authenticated;
grant  execute on function rol_week_uit(date)   to authenticated;


-- =====================================================================
-- Draaien
--
-- Eerst met de hand. Kijken, dan pas plannen:
--
--   select * from sjabloon_slots(current_date);   -- wat zou hij doen
--   select * from rol_week_uit();                 -- deze week
--   select * from rol_week_uit(current_date + 7); -- volgende week
--
-- Als dat een paar weken saai is geweest, mag cron het overnemen:
--
--   select cron.schedule('weekuitrol', '0 1 * * 1', $c$select rol_week_uit()$c$);
--
-- Let op dat tijdstip. pg_cron rekent in de tijdzone van de database en
-- die staat op Supabase in UTC. "Maandag 00:00" wordt daar zondag 22:00
-- in de zomer en zondag 23:00 in de winter -- dus rolt hij een half jaar
-- lang de vorige week uit, en dat merk je pas als iemand zich afvraagt
-- waar zijn diensten zijn. Maandag 01:00 UTC valt in beide standen ruim
-- na middernacht hier, en de functie zelf rekent de week toch al in
-- Europe/Amsterdam uit. De diensten beginnen om 15:00, dus van drie uur
-- 's nachts heeft niemand last.
--
-- En omdat hij nooit een bestaande dienst aanraakt, is een keer te veel
-- draaien niet erg. Een keer te weinig wel -- dus mag hij ook gewoon
-- elke dag, als je daar rustiger van slaapt:
--
--   select cron.schedule('weekuitrol', '0 1 * * *', $c$select rol_week_uit()$c$);
-- =====================================================================
