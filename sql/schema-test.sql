-- =====================================================================
-- Controle op het schema
--
-- Draai dit één keer, direct nadat schema.sql erin staat. Het probeert
-- expres dingen die niet mogen. Elke regel die 'goed' zegt is een fout
-- die de database tegenhoudt, en dus een fout die je later niet in een
-- urenoverzicht terugvindt.
--
-- Dit is de laatste fase waarin dat gratis is: er zit nog geen data in
-- die je kapot kunt maken en niemand werkt er nog mee.
--
-- Wat dit NIET test: de rechten (row level security). Die gelden niet
-- voor de rol waarmee de SQL-editor draait -- daar ben je superuser en
-- gaan alle policies aan je voorbij. RLS test je in fase 2, ingelogd in
-- een gewone browser. Zie het bouwplan.
--
-- Opruimen gebeurt vanzelf: alle testrijen staan op 2099 en worden aan
-- het eind verwijderd.
-- =====================================================================

create or replace function test_schema()
returns table (nr int, controle text, uitkomst text, toelichting text)
language plpgsql
as $$
declare
  v_datum  date := date '2099-01-04';   -- een maandag, ver buiten elk rooster
  v_bus2   uuid;
  v_bus3   uuid;
  v_bus4   uuid;
  v_vroeg  uuid;
  v_laat   uuid;
  v_a      uuid;   -- twee willekeurige medewerkers
  v_b      uuid;
  v_vrij   uuid;   -- iemand die op maandag niet in het sjabloon staat
  v_bezet  uuid;   -- iemand die op maandag wél in het sjabloon staat
  v_dienst uuid;
  v_aantal int;
begin
  select id into v_bus2  from posten where naam = 'Bus 2';
  select id into v_bus3  from posten where naam = 'Bus 3';
  select id into v_bus4  from posten where naam = 'Bus 4';
  select id into v_vroeg from dienstsoorten where naam = 'vroeg';
  select id into v_laat  from dienstsoorten where naam = 'laat';

  select id into v_a from personen where rol = 'medewerker' order by naam limit 1;
  select id into v_b from personen where rol = 'medewerker' order by naam offset 1 limit 1;

  select p.id into v_vrij
    from personen p
   where p.rol = 'medewerker'
     and not exists (select 1 from sjabloon_regels s
                      where s.persoon_id = p.id and s.weekdag = 1)
   limit 1;

  select s.persoon_id into v_bezet from sjabloon_regels s where s.weekdag = 1 limit 1;

  -- Een geldige dienst als basis. Gaat dit al mis, dan klopt er iets
  -- fundamenteels niet en stopt de hele functie hier.
  insert into diensten (datum, post_id, persoon_id, gepland_begin, gepland_eind)
  values (v_datum, v_bus2, v_a, time '15:00', time '20:00')
  returning id into v_dienst;

  -- 1 ------------------------------------------------------------------
  nr := 1; controle := 'Kwartier of kwartaal wordt geweigerd (21:23)';
  begin
    insert into diensten (datum, post_id, persoon_id, gepland_begin, gepland_eind)
    values (v_datum, v_bus3, v_b, time '16:00', time '21:23');
    uitkomst := 'FOUT — dit ging door';
    toelichting := 'is_half_uur() houdt niets tegen';
  exception when others then
    uitkomst := 'goed'; toelichting := sqlerrm;
  end;
  return next;

  -- 2 ------------------------------------------------------------------
  nr := 2; controle := 'Niemand staat op twee bussen op dezelfde dag';
  begin
    insert into diensten (datum, post_id, persoon_id, gepland_begin, gepland_eind)
    values (v_datum, v_bus3, v_a, time '16:00', time '21:00');
    uitkomst := 'FOUT — dit ging door';
    toelichting := 'diensten_persoon_bezet ontbreekt of dekt dit niet';
  exception when others then
    uitkomst := 'goed'; toelichting := sqlerrm;
  end;
  return next;

  -- 3 ------------------------------------------------------------------
  nr := 3; controle := 'Afgemeld kan geen werkelijke tijden hebben';
  begin
    insert into diensten (datum, post_id, persoon_id, gepland_begin, gepland_eind,
                          werkelijk_begin, werkelijk_eind, status)
    values (v_datum, v_bus3, v_b, time '16:00', time '21:00',
            time '16:00', time '21:00', 'afgemeld');
    uitkomst := 'FOUT — dit ging door';
    toelichting := 'een niet-gewerkte dienst leest straks als bewijs dat er gewerkt is';
  exception when others then
    uitkomst := 'goed'; toelichting := sqlerrm;
  end;
  return next;

  -- 4 ------------------------------------------------------------------
  nr := 4; controle := 'Gemeld kan niet zonder werkelijke tijden';
  begin
    insert into diensten (datum, post_id, persoon_id, gepland_begin, gepland_eind, status)
    values (v_datum, v_bus3, v_b, time '16:00', time '21:00', 'gemeld');
    uitkomst := 'FOUT — dit ging door';
    toelichting := 'dan komt er een dienst zonder uren in de export';
  exception when others then
    uitkomst := 'goed'; toelichting := sqlerrm;
  end;
  return next;

  -- 5 ------------------------------------------------------------------
  nr := 5; controle := 'Eén bus is per starttijd maar één keer bezet';
  begin
    insert into diensten (datum, post_id, persoon_id, gepland_begin, gepland_eind)
    values (v_datum, v_bus2, v_b, time '15:00', time '20:00');
    uitkomst := 'FOUT — dit ging door';
    toelichting := 'de maandaguitrol maakt hier dubbele diensten van';
  exception when others then
    uitkomst := 'goed'; toelichting := sqlerrm;
  end;
  return next;

  -- 6 --------------------------------------------------------------
  -- Hier is slagen het goede antwoord. Dit is precies waarom de index
  -- partieel is: een vervallen dienst mag de vervanger niet blokkeren.
  update diensten set status = 'vervallen' where id = v_dienst;
  nr := 6; controle := 'Een vervallen dienst blokkeert de vervanger niet';
  begin
    insert into diensten (datum, post_id, persoon_id, gepland_begin, gepland_eind)
    values (v_datum, v_bus2, v_b, time '15:00', time '20:00');
    uitkomst := 'goed'; toelichting := 'opnieuw inplannen kan';
  exception when others then
    uitkomst := 'FOUT — geblokkeerd';
    toelichting := sqlerrm || ' (staat de where-clausule wel op de index?)';
  end;
  return next;

  -- 7 ------------------------------------------------------------------
  select count(*) into v_aantal from mutaties where dienst_id = v_dienst;
  nr := 7; controle := 'Elke wijziging komt vanzelf in het logboek';
  if v_aantal >= 2 then
    uitkomst := 'goed';
  else
    uitkomst := 'FOUT — te weinig regels';
  end if;
  toelichting := v_aantal || ' regels in mutaties (verwacht: aangemaakt + status)';
  return next;

  -- 8 ------------------------------------------------------------------
  nr := 8; controle := 'Sjabloon: geen tweede regel voor hetzelfde slot';
  begin
    insert into sjabloon_regels (weekdag, post_id, persoon_id, dienstsoort_id)
    values (1, v_bus2, v_vrij, v_vroeg);
    uitkomst := 'FOUT — dit ging door';
    toelichting := 'de uitrol maakt hier stilletjes twee diensten van';
  exception when others then
    uitkomst := 'goed'; toelichting := sqlerrm;
  end;
  return next;

  -- 9 ------------------------------------------------------------------
  nr := 9; controle := 'Sjabloon: niemand twee keer op dezelfde weekdag';
  begin
    insert into sjabloon_regels (weekdag, post_id, persoon_id, dienstsoort_id)
    values (1, v_bus4, v_bezet, v_laat);
    uitkomst := 'FOUT — dit ging door';
    toelichting := 'de uitrol loopt elke maandag stuk op diensten_persoon_bezet';
  exception when others then
    uitkomst := 'goed'; toelichting := sqlerrm;
  end;
  return next;

  -- Opruimen. mutaties gaat mee, die cascadeert op dienst_id.
  delete from diensten where datum = v_datum;
end;
$$;

select * from test_schema() order by nr;

-- Klaar? Dan mag de functie weg:
--   drop function test_schema();
