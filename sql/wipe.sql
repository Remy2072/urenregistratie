-- =====================================================================
-- Alles leeg, structuur intact
--
-- Dit gooit de data weg en laat het schema staan: tabellen, policies,
-- functies en triggers blijven. Bedoeld voor het dev-project en voor
-- het opnieuw opzetten van de showcase (fase 18), niet voor een
-- installatie waar mensen op uitbetaald worden.
--
-- LEES DIT VOORDAT JE HEM DRAAIT. Er zit geen bevestiging in en er is
-- geen ongedaan maken. Draai je dit op de verkeerde database, dan zijn
-- de uren van een maand weg en is het logboek dat het zou bewijzen als
-- eerste verdwenen.
--
-- Wat er NIET mee weggaat: de logins in `auth.users`. Die staan in het
-- schema van Supabase Auth en niet in het onze. Zie onderaan.
-- =====================================================================


-- ---------------------------------------------------------------------
-- De volgorde
--
-- truncate ... cascade zou het in één regel doen, maar dan zie je niet
-- wat er meegaat en dat is precies het verkeerde gevoel bij een
-- opdracht die alles wist. Dus met de hand, van blad naar wortel:
-- eerst wat naar iets anders wijst, dan waar het naar wees.
-- ---------------------------------------------------------------------
begin;

-- Losse bladeren: hangen aan personen of diensten, niets hangt aan hen.
delete from mutaties;
delete from ruilverzoeken;
delete from herstelcodes;
delete from agenda_sleutels;
delete from beschikbaarheid_week;
delete from beschikbaarheid_standaard;

-- De kern.
delete from diensten;
delete from sjabloon_regels;

-- En de stamgegevens.
delete from personen;
delete from posten;
delete from dienstsoorten;

commit;


-- ---------------------------------------------------------------------
-- Controle
--
-- Elke regel hoort 0 te zeggen. Staat er iets anders, dan is er een
-- tabel bijgekomen sinds dit bestand geschreven is -- kijk dan of hij
-- hierboven ook thuishoort.
-- ---------------------------------------------------------------------
select 'personen'                as tabel, count(*) from personen
union all select 'posten',                  count(*) from posten
union all select 'dienstsoorten',           count(*) from dienstsoorten
union all select 'sjabloon_regels',         count(*) from sjabloon_regels
union all select 'diensten',                count(*) from diensten
union all select 'mutaties',                count(*) from mutaties
union all select 'beschikbaarheid_standaard', count(*) from beschikbaarheid_standaard
union all select 'beschikbaarheid_week',     count(*) from beschikbaarheid_week
union all select 'herstelcodes',            count(*) from herstelcodes
union all select 'ruilverzoeken',           count(*) from ruilverzoeken
union all select 'agenda_sleutels',         count(*) from agenda_sleutels;


-- ---------------------------------------------------------------------
-- En dan de logins
--
-- `personen` is leeg, maar de accounts waarmee die mensen inlogden
-- staan nog in `auth.users`. Dat is een ander schema, van Supabase
-- Auth, en daar komt dit bestand met opzet niet aan: één verkeerd
-- gerichte delete daar en je sloopt de authenticatie van het project.
--
-- Laat je ze staan, dan kan iemand nog inloggen en komt hij binnen als
-- niemand -- `huidige_persoon_id()` vindt geen rij en de policies geven
-- niets. Dat is niet gevaarlijk maar het ziet eruit als een stuk app.
--
-- Opruimen doe je daarom met de hand, in het dashboard:
--
--   Authentication -> Users -> selecteren -> Delete user
--
-- Dat is bewust omslachtig. Bij een handvol testaccounts is het een
-- minuut werk, en bij een echte installatie wil je precies dit niet
-- per ongeluk in een script hebben staan.
--
-- Passkeys gaan mee met de gebruiker: die zitten ook in het
-- auth-schema en niet in het onze.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- Daarna
--
--   1. startdata.sql   -- posten, dienstsoorten, mensen, het sjabloon
--   2. select rol_week_uit();   -- deze week neerzetten
--   3. Logins aanmaken op /beheer, één per persoon
--
-- Voor de showcase komt daar demodata.sql bij, met weken geschiedenis
-- erin. Die bestaat nog niet -- zie fase 18 in bouwplan.md.
-- ---------------------------------------------------------------------
