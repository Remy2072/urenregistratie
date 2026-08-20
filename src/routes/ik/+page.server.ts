import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { wieBenIk } from '$lib/server/wie';
import { alsTelefoon } from '$lib/telefoon';

/**
 * Je eigen gegevens, en wat je ervan mag veranderen.
 *
 * Naam en gebruikersnaam zijn van de baas: kan iedereen zijn eigen naam
 * wijzigen, dan staat er morgen iets anders in het rooster dan gisteren en
 * klopt geen enkel oud overzicht meer. Je telefoonnummer is wel van jou, en je
 * wachtwoord ook.
 *
 * De tellingen onderaan stonden hier vanaf fase 2 en blijven staan. Ze gaan
 * allemaal door row level security heen: wat daar staat is precies wat de
 * database jou toestaat, niet wat de code besloten heeft te tonen. Dat is het
 * enige scherm waar dat te zien is, dus het is geen sierletter.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.supabase) redirect(303, '/inloggen');
	const { user } = await locals.veiligeSessie();
	if (!user) redirect(303, '/inloggen');
	const supabase = locals.supabase;

	const ik = await wieBenIk(locals);

	async function tel(tabel: string) {
		const { count } = await supabase.from(tabel).select('*', { count: 'exact', head: true });
		return count ?? 0;
	}

	// Welke passkeys heeft dit account? Staat de schakelaar in Supabase uit, dan
	// geeft dit een fout en blijft het scherm gewoon werken -- vandaar de lege
	// lijst en geen throw.
	const { data: passkeys, error: passkeyFout } = await supabase.auth.passkey.list();

	return {
		email: user.email ?? '',
		persoon: ik,
		passkeys: passkeys ?? [],
		passkeysKan: !passkeyFout,
		zichtbaar: {
			personen: await tel('personen'),
			diensten: await tel('diensten'),
			sjabloon: await tel('sjabloon_regels'),
			posten: await tel('posten')
		}
	};
};

export const actions: Actions = {
	/**
	 * Je eigen telefoonnummer.
	 *
	 * De update gaat op `auth_user_id` en niet op een id uit het formulier: dan
	 * kan er geen ander id in dat formulier staan. De policy
	 * `personen_eigen_gegevens` houdt het ook tegen, en de trigger
	 * `persoon_wijziging_bewaken()` laat van je eigen rij alleen dit veld door --
	 * drie sloten, en dat is hier niet te veel: dit is de eerste plek waar
	 * iemand aan `personen` mag komen die geen beheerder is.
	 */
	telefoon: async ({ request, locals }) => {
		const { user } = await locals.veiligeSessie();
		if (!user) return fail(403, { fout: 'Je bent niet ingelogd.' });

		const ingevoerd = String((await request.formData()).get('telefoon') ?? '').trim();
		const nummer = ingevoerd === '' ? null : alsTelefoon(ingevoerd);

		if (ingevoerd !== '' && nummer === null) {
			return fail(400, { fout: 'Een Nederlands nummer heeft tien cijfers: 06 12345678. Uit een ander land met landnummer erbij, zoals +32470123456.' });
		}

		const { data, error } = await locals
			.supabase!.from('personen')
			.update({ telefoon: nummer })
			.eq('auth_user_id', user.id)
			.select('id');

		if (error) return fail(400, { fout: error.message });

		// Geen fout maar ook geen rij: dan hield row level security het tegen. Zolang
		// profiel.sql niet gedraaid is bestaat de policy op je eigen rij nog niet, en
		// dan is dit precies wat je ziet.
		if (!data?.length) {
			return fail(409, {
				fout: 'Je nummer kon niet worden opgeslagen — de database laat je (nog) niet aan je eigen rij. Staat docs/profiel.sql er al op?'
			});
		}
		return { gedaan: nummer === null ? 'Je nummer staat er niet meer in.' : 'Je nummer is opgeslagen.' };
	},

	/**
	 * Je wachtwoord wijzigen. Vraagt het huidige opnieuw.
	 *
	 * Zonder die controle is een telefoon die iemand even open laat liggen
	 * genoeg om hem buiten te sluiten -- en er is geen mail om dat mee terug te
	 * draaien, dus dan is de baas de enige uitweg.
	 *
	 * Dit gaat met je eigen sessie en dus zonder beheersleutel.
	 *
	 * En daarna moet je opnieuw inloggen. Dat doet de app zelf: uitloggen en door
	 * naar het inlogscherm. Anders hangt het ervan af wat Supabase met je bestaande
	 * sessie doet -- soms werkt hij nog, soms niet -- en dan staat er "gewijzigd" op
	 * een scherm dat bij de volgende klik alsnog wegvalt. Eén keer duidelijk
	 * opnieuw inloggen is minder verwarrend dan dat.
	 */
	wachtwoord: async ({ request, locals }) => {
		const { user } = await locals.veiligeSessie();
		if (!user?.email) return fail(403, { fout: 'Je bent niet ingelogd.' });

		const f = await request.formData();
		const huidig = String(f.get('huidig') ?? '');
		const nieuw = String(f.get('nieuw') ?? '');

		if (!huidig || !nieuw) return fail(400, { fout: 'Vul allebei de velden in.' });
		if (nieuw.length < 8) {
			return fail(400, { fout: 'Neem er minstens acht tekens voor — het hoeft maar één keer.' });
		}

		const { error: klopt } = await locals.supabase!.auth.signInWithPassword({
			email: user.email,
			password: huidig
		});
		if (klopt) return fail(400, { fout: 'Je huidige wachtwoord klopt niet.' });

		const { error } = await locals.supabase!.auth.updateUser({ password: nieuw });
		if (error) return fail(400, { fout: error.message });

		await locals.supabase!.auth.signOut();
		redirect(303, '/inloggen?nieuw=1');
	},

	/**
	 * Stap 1 van een passkey aanmelden: de opdracht ophalen.
	 *
	 * Dit vraagt een sessie, en die zit hier -- in een cookie die de browser niet
	 * kan lezen. Daarom doet de server deze stap en niet de telefoon.
	 */
	passkeyStart: async ({ locals }) => {
		const { user } = await locals.veiligeSessie();
		if (!user) return fail(403, { fout: 'Je bent niet ingelogd.' });

		const { data, error } = await locals.supabase!.auth.passkey.startRegistration();
		if (error || !data) {
			return fail(400, {
				fout: /disabled|experimental|not enabled|404|not found/i.test(error?.message ?? '')
					? 'Passkeys staan nog uit in Supabase (Authentication → Passkeys).'
					: (error?.message ?? 'Het is niet gelukt.')
			});
		}

		return { opdracht: { challengeId: data.challenge_id, opties: data.options } };
	},

	/** Stap 2: het antwoord van de telefoon laten controleren en vastleggen. */
	passkeyKlaar: async ({ request, locals }) => {
		const { user } = await locals.veiligeSessie();
		if (!user) return fail(403, { fout: 'Je bent niet ingelogd.' });

		const f = await request.formData();
		const challengeId = String(f.get('challengeId') ?? '');
		const antwoord = String(f.get('antwoord') ?? '');
		const naam = String(f.get('naam') ?? '').trim();
		if (!challengeId || !antwoord) return fail(400, { fout: 'Er ging iets mis met de passkey.' });

		const { data, error } = await locals.supabase!.auth.passkey.verifyRegistration({
			challengeId,
			credential: JSON.parse(antwoord)
		});
		if (error) return fail(400, { fout: error.message });

		// Een naam is prettig zodra er twee staan: "iPhone" en "laptop" zeggen
		// meer dan twee datums. Lukt het niet, dan is de passkey er nog steeds --
		// dus dit mag geen fout worden.
		if (naam && data?.id) {
			await locals.supabase!.auth.passkey.update({ passkeyId: data.id, friendlyName: naam });
		}

		return { gedaan: 'Je kunt nu inloggen met je gezicht of vinger.' };
	},

	/** Een passkey weghalen. Van een toestel dat je niet meer hebt, bijvoorbeeld. */
	passkeyWeg: async ({ request, locals }) => {
		const { user } = await locals.veiligeSessie();
		if (!user) return fail(403, { fout: 'Je bent niet ingelogd.' });

		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { fout: 'Welke passkey?' });

		const { error } = await locals.supabase!.auth.passkey.delete({ passkeyId: id });
		if (error) return fail(400, { fout: error.message });

		return { gedaan: 'Die passkey is weg. Je wachtwoord werkt nog gewoon.' };
	},

	uitloggen: async ({ locals }) => {
		await locals.supabase?.auth.signOut();
		redirect(303, '/inloggen');
	}
};
