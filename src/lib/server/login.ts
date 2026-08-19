// Van een gebruikersnaam naar het adres waarmee Supabase iemand kent.
//
// Supabase Auth kent alleen adressen en telefoonnummers, geen gebruikersnamen.
// Er moet dus ergens een omzetting zitten, en de vraag is waar.
//
// Het staat hier, op de server, achter de beheersleutel: `personen` mag je
// zonder login niet lezen en in `auth.users` komt de publieke sleutel al helemaal
// niet. En dat is precies goed. Zou dit een databasefunctie zijn die voor
// iedereen open staat, dan heb je een lijstje van je collega's dat je zonder in
// te loggen kunt aflopen -- terwijl het inlogscherm met opzet niet verklapt of
// een account bestaat.
//
// Zonder beheersleutel werkt dit niet. Dan log je in met je adres, en dat zegt
// het inlogscherm er ook bij. Zie fase 10 in bouwplan.md.

import { env } from '$env/dynamic/private';
import { beheerClient } from './beheersleutel';

/** Kan er met een gebruikersnaam ingelogd worden, of alleen met een adres? */
export function kanMetGebruikersnaam(): boolean {
	return beheerClient() !== null;
}

/**
 * Het adres dat bij deze gebruikersnaam hoort, of null.
 *
 * Null betekent hier drie dingen tegelijk -- geen sleutel, geen persoon met die
 * gebruikersnaam, of een persoon zonder login -- en dat is met opzet. De
 * aanroeper mag dat verschil niet aan de bezoeker doorvertellen: welke namen
 * bestaan is de eerste helft van een inbraak.
 */
export async function adresBijGebruikersnaam(gebruikersnaam: string): Promise<string | null> {
	const admin = beheerClient();
	if (!admin) {
		waarom(gebruikersnaam, 'de beheersleutel staat niet in .env');
		return null;
	}

	const { data: persoon, error } = await admin
		.from('personen')
		.select('auth_user_id, actief')
		.eq('gebruikersnaam', gebruikersnaam)
		.maybeSingle();

	if (error) {
		waarom(gebruikersnaam, `de vraag aan personen mislukte: ${error.message}`);
		return null;
	}
	if (!persoon) {
		waarom(gebruikersnaam, 'niemand heeft die gebruikersnaam (let op hoofdletters en spaties)');
		return null;
	}

	// Niet-actief hier ook weigeren. De deurcontrole in hooks.server.ts stuurt
	// hem alsnog weg en de policies geven hem niets, maar dan is hij wel even
	// ingelogd geweest -- en dat hoeft niet.
	if (!persoon.actief) {
		waarom(gebruikersnaam, 'die persoon staat op non-actief');
		return null;
	}
	if (!persoon.auth_user_id) {
		waarom(gebruikersnaam, 'die persoon heeft nog geen login (auth_user_id is leeg)');
		return null;
	}

	const { data, error: authFout } = await admin.auth.admin.getUserById(persoon.auth_user_id);
	if (authFout || !data?.user?.email) {
		waarom(gebruikersnaam, `bij dat account hoort geen adres: ${authFout?.message ?? 'leeg'}`);
		return null;
	}

	return data.user.email;
}

/**
 * Waarom een inlogpoging op een gebruikersnaam strandde -- in de serverlog en
 * nergens anders.
 *
 * Het scherm zegt bij alle gevallen hetzelfde, want het verschil vertelt een
 * vreemde welke namen bestaan. Maar jij moet het wel kunnen zien, anders is
 * "het werkt niet" het enige dat je hebt.
 */
function waarom(gebruikersnaam: string, reden: string): void {
	console.warn(`inloggen als '${gebruikersnaam}' kon niet: ${reden}`);
}

/**
 * Het adres dat de app voorstelt bij een nieuwe login.
 *
 * Dit adres bestaat niet en er gaat nooit post heen; het is alleen wat Supabase
 * intern nodig heeft. Het staat in `.env` zodat je er per bedrijf een domein van
 * de baas van kunt maken -- weigert Supabase een verzonnen domein, dan is dat de
 * uitweg. Inloggen met de gebruikersnaam verandert er niet van, want de app
 * zoekt het adres toch op.
 */
export function verzinAdres(gebruikersnaam: string): string {
	const domein = env.LOGIN_DOMEIN?.trim() || 'uren.local';
	return `${gebruikersnaam}@${domein}`;
}

/** Dezelfde regel als `personen_gebruikersnaam_vorm` in schema.sql. */
export function isGebruikersnaam(waarde: string): boolean {
	return /^[a-z0-9][a-z0-9._-]{1,31}$/.test(waarde);
}
