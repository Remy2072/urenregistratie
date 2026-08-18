-- =====================================================================
-- Controle op de weekgeneratie
--
-- Draai dit nadat weekgeneratie.sql erin staat. Zelfde vorm als
-- schema-test.sql: elke regel hoort 'goed' te zeggen.
--
-- Waar schema-test.sql de constraints kapot probeerde te maken, gaat dit
-- over de vraag die daarna komt: wat gebeurt er als je de uitrol een
-- tweede keer draait terwijl er intussen mensen mee gewerkt hebben? Een
-- dienst die al gemeld is, een dienst die de baas geannuleerd heeft, een
-- ruil -- dat zijn precies de gevallen waarin "even opnieuw draaien"
-- stilletjes iets kan terugzetten.
--
-- Alles speelt zich af in januari 2099, vier weken lang, en wordt aan
-- het eind weer weggehaald. Het sjabloon wordt onderweg gewijzigd en
-- daarna netjes hersteld.
-- =====================================================================

create or replace function test_weekgeneratie()
returns table (nr int, controle text, uitkomst text, toelichting text)
language plpgsql
as $$
declare
  wk_a     date := date_trunc('week', date '2099-01-04')::date;  -- maandag
  wk_b     date;
  wk_c     date;
  wk_d     date;
  v_aantal int;
  v_aantal2 int;
  v_tekst  text;
  v_dienst uuid;
  v_regel  uuid;
  v_post   uuid;
  v_persoon uuid;
  v_ander  uuid;
  v_dag    date;
  v_verdeling text;
begin
  wk_b := wk_a + 7;
  wk_c := wk_a + 14;
  wk_d := wk_a + 21;

  -- 1 ------------------------------------------------------------------
  -- De basis: een lege week uitrollen geeft het hele sjabloon terug.
  perform rol_week_uit(wk_a);

  select count(*) into v_aantal
    from diensten where datum between wk_a and wk_a + 6;

  select string_agg(n::text, '-' order by dag)
    into v_verdeling
    from (select datum as dag, count(*) as n
            from diensten where datum between wk_a and wk_a + 6
           group by datum) x;

  nr := 1; controle := 'Een lege week uitrollen geeft het hele sjabloon';
  if v_aantal = (select count(*) from sjabloon_regels
                  where geldig_vanaf <= wk_a
                    and (geldig_tot is null or geldig_tot >= wk_a + 6)) then
    uitkomst := 'goed';
  else
    uitkomst := 'FOUT — aantal klopt niet';
  end if;
  toelichting := v_aantal || ' diensten, per dag ' || coalesce(v_verdeling, '-');
  return next;

  -- 2 ------------------------------------------------------------------
  -- De kern van de fase. Twee keer draaien mag niets toevoegen.
  select count(*) into v_aantal2
    from rol_week_uit(wk_a) where resultaat = 'nieuw';

  select count(*) into v_aantal
    from diensten where datum between wk_a and wk_a + 6;

  nr := 2; controle := 'Tweede keer uitrollen voegt niets toe';
  if v_aantal2 = 0 and v_aantal = (select count(*) from diensten
                                    where datum between wk_a and wk_a + 6) then
    uitkomst := 'goed';
  else
    uitkomst := 'FOUT — er kwam iets bij';
  end if;
  toelichting := v_aantal2 || ' nieuw bij de tweede run, totaal nog steeds ' || v_aantal;
  return next;

  -- 3 ------------------------------------------------------------------
  -- De geplande tijden horen een kopie te zijn van de dienstsoort, niet
  -- een verwijzing. Wijzigt de dienstsoort later, dan mag de dienst van
  -- vorige week niet meeveranderen.
  select count(*) into v_aantal
    from diensten d
   where d.datum between wk_a and wk_a + 6
     and not exists (
           select 1 from sjabloon_slots(wk_a) s
            where s.datum         = d.datum
              and s.post_id       = d.post_id
              and s.persoon_id    = d.persoon_id
              and s.gepland_begin = d.gepland_begin
              and s.gepland_eind  = d.gepland_eind);

  nr := 3; controle := 'Geplande tijden komen als kopie uit de dienstsoort';
  if v_aantal = 0 then uitkomst := 'goed';
  else uitkomst := 'FOUT — tijden wijken af'; end if;
  toelichting := v_aantal || ' diensten die niet bij hun sjabloonregel passen';
  return next;

  -- 4 ------------------------------------------------------------------
  select count(*) into v_aantal
    from diensten
   where datum between wk_a and wk_a + 6
     and (status <> 'verwacht' or bron <> 'sjabloon'
          or werkelijk_begin is not null or werkelijk_eind is not null);

  nr := 4; controle := 'Alles komt binnen als verwacht, uit het sjabloon, zonder uren';
  if v_aantal = 0 then uitkomst := 'goed';
  else uitkomst := 'FOUT — niet alles staat op verwacht'; end if;
  toelichting := v_aantal || ' diensten met een andere status, bron of uren';
  return next;

  -- 5 ------------------------------------------------------------------
  -- De uitrol blijft binnen zijn eigen week.
  select count(*) into v_aantal
    from diensten where datum between wk_b and wk_b + 6;

  nr := 5; controle := 'Een uitrol raakt alleen zijn eigen week';
  if v_aantal = 0 then uitkomst := 'goed';
  else uitkomst := 'FOUT — er staat al iets in de week erna'; end if;
  toelichting := v_aantal || ' diensten in de week erna (verwacht: 0)';
  return next;

  -- 6 ------------------------------------------------------------------
  -- Elke dag van de week hoort dezelfde maandag op te leveren. Anders
  -- rolt een cron die net na middernacht draait de verkeerde week uit.
  select count(*) into v_aantal2 from rol_week_uit(wk_a + 3) where resultaat = 'nieuw';
  select min(datum)::text into v_tekst from rol_week_uit(wk_a + 6);

  nr := 6; controle := 'Elke dag uit de week levert dezelfde maandag op';
  if v_aantal2 = 0 and v_tekst = wk_a::text then uitkomst := 'goed';
  else uitkomst := 'FOUT — andere week'; end if;
  toelichting := 'donderdag gaf ' || v_aantal2 || ' nieuw, zondag begint op ' || coalesce(v_tekst, 'niets');
  return next;

  -- 7 ------------------------------------------------------------------
  -- Een dienst waar iemand zich al op gemeld heeft mag de uitrol niet
  -- aanraken. Dit is het geval waarin "even opnieuw draaien" iemand zijn
  -- uren zou kunnen kosten.
  select id into v_dienst
    from diensten where datum = wk_a order by gepland_begin limit 1;

  update diensten
     set status = 'gemeld', werkelijk_begin = time '15:00', werkelijk_eind = time '21:00'
   where id = v_dienst;

  perform rol_week_uit(wk_a);

  select status || ' ' || werkelijk_begin::text || '-' || werkelijk_eind::text
    into v_tekst from diensten where id = v_dienst;

  nr := 7; controle := 'Een gemelde dienst blijft ongemoeid';
  if v_tekst = 'gemeld 15:00:00-21:00:00' then uitkomst := 'goed';
  else uitkomst := 'FOUT — de melding is aangetast'; end if;
  toelichting := 'na de uitrol: ' || v_tekst;
  return next;

  -- 8 ------------------------------------------------------------------
  -- En een dienst die de baas geannuleerd heeft mag niet terugkomen.
  -- Dit is de reden dat de uitrol op het slot kijkt zonder op status te
  -- filteren; zou hij dat wel doen, dan zet elke volgende run de
  -- annulering stilzwijgend terug.
  select id, post_id into v_dienst, v_post
    from diensten where datum = wk_a and id <> (
      select id from diensten where datum = wk_a order by gepland_begin limit 1)
   limit 1;

  update diensten set status = 'vervallen' where id = v_dienst;
  perform rol_week_uit(wk_a);

  select count(*) into v_aantal
    from diensten d
    join diensten v on v.id = v_dienst
   where d.datum = v.datum and d.post_id = v.post_id
     and d.gepland_begin = v.gepland_begin;

  nr := 8; controle := 'Een vervallen dienst wordt niet opnieuw ingepland';
  if v_aantal = 1 then uitkomst := 'goed';
  else uitkomst := 'FOUT — de annulering is teruggedraaid'; end if;
  toelichting := v_aantal || ' diensten op dat slot (verwacht: 1, de vervallene)';
  return next;

  -- 9 ------------------------------------------------------------------
  -- Een ruil: de baas zet een andere persoon op een dienst. De volgende
  -- uitrol ziet dan een sjabloonregel waarvan de persoon nergens meer
  -- staat. Zonder de persoonscontrole in rol_week_uit loopt de hele
  -- uitrol hier stuk op diensten_persoon_bezet.
  v_dag := wk_a + 1;

  select d.id, d.persoon_id into v_dienst, v_persoon
    from diensten d where d.datum = v_dag and d.status = 'verwacht' limit 1;

  select p.id into v_ander
    from personen p
   where p.actief
     and not exists (select 1 from diensten d
                      where d.persoon_id = p.id and d.datum = v_dag
                        and d.status not in ('afgemeld', 'vervallen'))
   limit 1;

  update diensten set persoon_id = v_ander where id = v_dienst;

  begin
    select count(*) into v_aantal2 from rol_week_uit(wk_a) where resultaat = 'nieuw';
    uitkomst := 'goed';
    toelichting := v_aantal2 || ' nieuw na de ruil (verwacht: 0)';
    if v_aantal2 <> 0 then uitkomst := 'FOUT — er kwam een dubbele dienst bij'; end if;
  exception when others then
    uitkomst := 'FOUT — de uitrol liep stuk';
    toelichting := sqlerrm;
  end;
  nr := 9; controle := 'Een geruilde dienst laat de uitrol niet stuklopen';
  return next;

  -- 10 -----------------------------------------------------------------
  -- Iemand op non-actief hoort niet ingeroosterd te worden, maar zijn
  -- slot hoort wel zichtbaar te blijven -- dat is een gat in de bezetting
  -- en geen regel die je mag laten verdwijnen.
  select persoon_id into v_persoon from sjabloon_slots(wk_c) limit 1;
  update personen set actief = false where id = v_persoon;

  select count(*) into v_aantal
    from rol_week_uit(wk_c) where resultaat like 'overgeslagen — staat op non-actief%';

  select count(*) into v_aantal2
    from diensten where datum between wk_c and wk_c + 6 and persoon_id = v_persoon;

  update personen set actief = true where id = v_persoon;

  nr := 10; controle := 'Non-actief wordt overgeslagen, maar wel gemeld';
  if v_aantal >= 1 and v_aantal2 = 0 then uitkomst := 'goed';
  else uitkomst := 'FOUT — non-actief werd toch ingepland of niet gemeld'; end if;
  toelichting := v_aantal || ' regels gemeld als non-actief, ' || v_aantal2 || ' diensten aangemaakt';
  return next;

  -- 11 -----------------------------------------------------------------
  -- Het sjabloon wijzigt per datum. De week erna rolt met de nieuwe
  -- persoon uit; de week ervoor blijft staan zoals hij stond.
  select sr.id, sr.post_id, sr.persoon_id into v_regel, v_post, v_persoon
    from sjabloon_regels sr
   where sr.weekdag = 3 and sr.geldig_tot is null
   limit 1;

  select p.id into v_ander
    from personen p
   where p.actief
     and not exists (select 1 from sjabloon_regels s
                      where s.persoon_id = p.id and s.weekdag = 3)
   limit 1;

  update sjabloon_regels set geldig_tot = wk_d - 1 where id = v_regel;

  insert into sjabloon_regels (weekdag, post_id, persoon_id, dienstsoort_id, geldig_vanaf)
  select 3, v_post, v_ander, sr.dienstsoort_id, wk_d
    from sjabloon_regels sr where sr.id = v_regel;

  perform rol_week_uit(wk_d);
  perform rol_week_uit(wk_a);   -- de oude week nog een keer, voor de zekerheid

  select count(*) into v_aantal
    from diensten where datum = wk_d + 2 and post_id = v_post and persoon_id = v_ander;

  select count(*) into v_aantal2
    from diensten where datum = wk_a + 2 and post_id = v_post and persoon_id = v_persoon;

  nr := 11; controle := 'Sjabloonwijziging geldt vooruit, niet achteruit';
  if v_aantal = 1 and v_aantal2 = 1 then uitkomst := 'goed';
  else uitkomst := 'FOUT — de knip valt op de verkeerde plek'; end if;
  toelichting := 'nieuwe week: ' || v_aantal || ' met de nieuwe persoon, '
              || 'oude week: ' || v_aantal2 || ' met de oude (beide verwacht: 1)';
  return next;

  -- 12 -----------------------------------------------------------------
  -- En het logboek uit schema.sql doet ook hier zijn werk: elke
  -- uitgerolde dienst heeft een regel 'aangemaakt'. Zonder dat is er van
  -- een automatische uitrol achteraf niets terug te vinden.
  select count(*) into v_aantal
    from diensten d
   where d.datum between wk_a and wk_d + 6
     and not exists (select 1 from mutaties m
                      where m.dienst_id = d.id and m.veld = 'aangemaakt');

  nr := 12; controle := 'Elke uitgerolde dienst staat in het logboek';
  if v_aantal = 0 then uitkomst := 'goed';
  else uitkomst := 'FOUT — niet alles is gelogd'; end if;
  toelichting := v_aantal || ' diensten zonder regel in mutaties';
  return next;

  -- Opruimen. Eerst de diensten, dan het sjabloon terug -- andersom
  -- botst de nieuwe regel met de oude op sjabloon_geen_dubbel_slot.
  delete from diensten where datum between wk_a and wk_d + 6;
  delete from sjabloon_regels where geldig_vanaf = wk_d and persoon_id = v_ander;
  update sjabloon_regels set geldig_tot = null where id = v_regel;
end;
$$;

select * from test_weekgeneratie() order by nr;

-- Klaar? Dan mag de functie weg:
--   drop function test_weekgeneratie();
