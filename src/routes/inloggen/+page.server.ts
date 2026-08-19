import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { adresBijGebruikersnaam, kanMetGebruikersnaam } from '$lib/server/login';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.supabase) return { ingesteld: false, gebruikersnaam: false };
	const { user } = await locals.veiligeSessie();
	if (user) redirect(303, '/mijn-week');

	// Zonder beheersleutel kan de app een gebruikersnaam niet omzetten naar het
	// adres waarmee Supabase iemand kent. Dan is inloggen met je adres de enige
	// weg, en dat hoort het scherm te zeggen in plaats van "klopt niet".
	return { ingesteld: true, gebruikersnaam: kanMetGebruikersnaam() };
};

/**
 * Eén zin voor drie gevallen: onbekende gebruikersnaam, onbekend adres,
 * verkeerd wachtwoord.
 *
 * Bewust geen onderscheid. Dat verschil vertelt een vreemde welke namen en
 * adressen bestaan, en dat zijn hier die van je collega's.
 */
const KLOPT_NIET = 'Gebruikersnaam of wachtwoord klopt niet.';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.supabase) {
			return fail(503, { wie: '', fout: 'De database is nog niet ingesteld — zie .env.example.' });
		}

		const formulier = await request.formData();
		const wie = String(formulier.get('wie') ?? '')
			.trim()
			.toLowerCase();
		const wachtwoord = String(formulier.get('wachtwoord') ?? '');

		if (!wie || !wachtwoord) {
			return fail(400, { wie, fout: 'Vul allebei de velden in.' });
		}

		// Een gebruikersnaam of een adres? Het apenstaartje is het verschil, en
		// daarom mag dat teken niet in een gebruikersnaam voorkomen. Zie
		// personen_gebruikersnaam_vorm in schema.sql.
		//
		// Het adres blijft werken naast de gebruikersnaam. Niet als nette extra
		// maar omdat de accounts die er al zijn nog geen gebruikersnaam hebben:
		// haal je dit weg, dan staat de hele ploeg buiten tot de baas ze één voor
		// één heeft ingevuld.
		let email = wie;
		if (!wie.includes('@')) {
			if (!kanMetGebruikersnaam()) {
				return fail(503, {
					wie,
					fout: 'Inloggen met een gebruikersnaam kan hier niet: de beheersleutel (SUPABASE_SECRET_KEY) staat niet in .env. Gebruik je e-mailadres.'
				});
			}

			const gevonden = await adresBijGebruikersnaam(wie);
			if (!gevonden) return fail(400, { wie, fout: KLOPT_NIET });
			email = gevonden;
		}

		const { error } = await locals.supabase.auth.signInWithPassword({
			email,
			password: wachtwoord
		});

		if (error) return fail(400, { wie, fout: KLOPT_NIET });

		redirect(303, '/mijn-week');
	}
};
