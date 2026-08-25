-- =====================================================================
-- Startdata
--
-- Dit is het enige bestand dat per bedrijf verschilt. `schema.sql` is overal
-- hetzelfde; hieronder staat wie er rijdt en wanneer.
--
-- Wat hier staat is een voorbeeld: drie bussen, een vroege en een late
-- dienst, negen verzonnen bezorgers en een weekrooster van 2-2-2-2-3-3-3.
-- Zet je dit op voor een echt bedrijf, dan gooi je alles hieronder weg en
-- typ je hun eigen posten, dienstsoorten, mensen en rooster in.
--
-- Doe dat in de SQL-editor en niet in dit bestand. Namen van personeel zijn
-- persoonsgegevens en die horen niet in een repository -- ook niet in die
-- van hun eigen werkgever.
-- =====================================================================

insert into posten (naam, volgorde) values
  ('Bus 2', 1), ('Bus 3', 2), ('Bus 4', 3);

insert into dienstsoorten (naam, begintijd, eindtijd) values
  ('vroeg', '15:00', '20:00'),
  ('laat',  '16:00', '21:00');

-- Namen zijn plaatshouders, gelijk aan die van het prototype. De echte
-- ploeg typ je pas in op het moment dat dit op het account van de baas
-- draait -- zie fase 1 van het bouwplan. Namen van personeel zijn
-- persoonsgegevens en die horen niet in een bestand dat in git staat.
insert into personen (naam, rol) values
  ('Remy',  'medewerker'), ('Daan',  'medewerker'),
  ('Samir', 'medewerker'), ('Joost', 'medewerker'),
  ('Ilias', 'medewerker'), ('Bram',  'medewerker'),
  ('Teun',  'medewerker'), ('Omar',  'medewerker'),
  ('Lars',  'medewerker');

-- Er staat nog geen eigenaar in. Zonder die rij kan niemand een dienst
-- bevestigen en blijft alles op 'gemeld' staan -- dan telt er niets mee
-- in de export. Vul de naam van de baas in:
--
-- insert into personen (naam, rol) values ('<naam baas>', 'eigenaar');
--
-- En koppel bij stap 6 elke persoon aan zijn login:
--
-- update personen set auth_user_id = '<uuid uit auth.users>'
--  where naam = '<naam>';


-- ---------------------------------------------------------------------
-- Het weekrooster
--
-- Dit is het sjabloon waar de maandaguitrol van fase 3 zijn diensten uit
-- haalt. Doordeweeks twee bussen, in het weekend drie. Weekdag 1 is
-- maandag, gelijk aan de check op de tabel.
--
-- Namen in plaats van uuid's, want die uuid's kent niemand. De joins
-- zoeken ze op, en als je een naam verkeerd typt komt die regel er
-- gewoon niet in -- controleer daarom onderaan of het er 17 zijn.
--
-- geldig_vanaf staat expliciet op de maandag van deze week, en niet op
-- de standaard current_date. Draai je dit bestand op een woensdag, dan
-- zou het sjabloon pas vanaf woensdag gelden en rolt de uitrol van fase
-- 3 die week een halve week uit -- zonder foutmelding, want die maandag
-- bestaat dan gewoon niet als sjabloonregel. Je ziet het pas als iemand
-- vraagt waar zijn maandag gebleven is.
-- ---------------------------------------------------------------------
insert into sjabloon_regels (weekdag, post_id, persoon_id, dienstsoort_id, geldig_vanaf)
select r.weekdag, po.id, pe.id, ds.id, date_trunc('week', current_date)::date
from (values
  (1, 'Bus 2', 'Remy',  'vroeg'),
  (1, 'Bus 3', 'Daan',  'laat'),

  (2, 'Bus 2', 'Samir', 'vroeg'),
  (2, 'Bus 3', 'Joost', 'laat'),

  (3, 'Bus 2', 'Ilias', 'vroeg'),
  (3, 'Bus 3', 'Bram',  'laat'),

  (4, 'Bus 2', 'Remy',  'vroeg'),
  (4, 'Bus 3', 'Teun',  'laat'),

  (5, 'Bus 2', 'Omar',  'vroeg'),
  (5, 'Bus 3', 'Lars',  'laat'),
  (5, 'Bus 4', 'Daan',  'laat'),

  (6, 'Bus 2', 'Remy',  'vroeg'),
  (6, 'Bus 3', 'Samir', 'laat'),
  (6, 'Bus 4', 'Joost', 'laat'),

  (7, 'Bus 2', 'Ilias', 'vroeg'),
  (7, 'Bus 3', 'Bram',  'laat'),
  (7, 'Bus 4', 'Teun',  'laat')
) as r(weekdag, post, persoon, dienstsoort)
join posten        po on po.naam = r.post
join personen      pe on pe.naam = r.persoon
join dienstsoorten ds on ds.naam = r.dienstsoort;


-- Controle: dit hoort 17 te zijn, en per weekdag 2, 2, 2, 2, 3, 3, 3.
-- Staat er minder, dan is er een naam verkeerd gespeld hierboven.
select weekdag, count(*) as regels
  from sjabloon_regels
 group by weekdag
 order by weekdag;
