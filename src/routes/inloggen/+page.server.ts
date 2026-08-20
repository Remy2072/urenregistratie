import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { adresBijGebruikersnaam, kanMetGebruikersnaam } from '$lib/server/login';

/**
 * Waar iemand heen wilde voordat de deur hem hierheen stuurde.
 *
 * Alleen een pad binnen deze app. Zonder die controle is dit een open
 * omleiding: dan zet iemand `?verder=https://ergensanders` in een link, en na
 * het inloggen sta je op een nagemaakt inlogscherm dat om je wachtwoord vraagt.
 * Twee slashes zijn daarom ook verboden -- `//ergens.nl` is voor een browser een
 * volledig adres.
 */
function veiligeBestemming(waarde: string | null): string {
	if (!waarde || !waarde.startsWith('/') || waarde.startsWith('//')) return '/mijn-week';
	return waarde;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.supabase) {
		return { ingesteld: false, gebruikersnaam: false, verder: '/mijn-week' };
	}
	const { user } = await locals.veiligeSessie();
	if (user) redirect(303, '/mijn-week');

	// Zonder beheersleutel kan de app een gebruikersnaam niet omzetten naar het
	// adres waarmee Supabase iemand kent. Dan is inloggen met je adres de enige
	// weg, en dat hoort het scherm te zeggen in plaats van "klopt niet".
	return {
		ingesteld: true,
		gebruikersnaam: kanMetGebruikersnaam(),
		verder: veiligeBestemming(url.searchParams.get('verder'))
	};
};

/**
 * Eén zin voor drie gevallen: onbekende gebruikersnaam, onbekend adres,
 * verkeerd wachtwoord.
 *
 * Bewust geen onderscheid. Dat verschil vertelt een vreemde welke namen en
 * adressen bestaan, en dat zijn hier die van je collega's.
 */
const KLOPT_NIET = 'Gebruikersnaam of wachtwoord klopt niet.';

/**
 * Foutmeldingen van Supabase over passkeys in gewone taal.
 *
 * De eerste is de belangrijkste: staat de schakelaar in het dashboard uit, dan
 * krijg je een fout die niets zegt over de oorzaak. Dat is precies het soort
 * bericht waar je een half uur naar kijkt.
 */
function passkeyUit(fout: { message?: string; status?: number } | null): string {
	const bericht = fout?.message ?? 'Onbekende fout.';
	// "Passkeys are disabled" is wat Supabase zelf terugstuurt als de schakelaar
	// in het dashboard uit staat. Getoetst, niet gegokt.
	if (/disabled|experimental|not enabled|404|not found/i.test(bericht)) {
		return 'Passkeys staan nog uit in Supabase (Authentication → Passkeys). Log in met je gebruikersnaam.';
	}
	if (/no passkey|not registered|no credentials/i.test(bericht)) {
		return 'Er staat nog geen passkey voor dit toestel. Log in met je gebruikersnaam en zet hem aan op "Mijn gegevens".';
	}
	return bericht;
}

export const actions: Actions = {
	/**
	 * Stap 1 van het inloggen met een passkey: de opdracht ophalen.
	 *
	 * Supabase geeft een uitdaging en een lijstje van wat er mag; die gaan als
	 * gewone JSON naar de browser, want daar zit `navigator.credentials` en
	 * nergens anders. Er gaat geen sleutel en geen sessie mee.
	 */
	passkeyStart: async ({ locals }) => {
		if (!locals.supabase) return fail(503, { fout: 'De database is nog niet ingesteld.' });

		const { data, error } = await locals.supabase.auth.passkey.startAuthentication();
		if (error || !data) return fail(400, { fout: passkeyUit(error) });

		return { opdracht: { challengeId: data.challenge_id, opties: data.options } };
	},

	/**
	 * Stap 2: het antwoord van de telefoon laten controleren.
	 *
	 * Lukt dat, dan ontstaat de sessie hier op de server en schrijft
	 * `hooks.server.ts` hem in de cookie -- dezelfde weg als bij een wachtwoord.
	 * Daarom hoeft er in de browser niets bewaard te worden.
	 */
	passkeyKlaar: async ({ request, locals }) => {
		if (!locals.supabase) return fail(503, { fout: 'De database is nog niet ingesteld.' });

		const formulier = await request.formData();
		const challengeId = String(formulier.get('challengeId') ?? '');
		const antwoord = String(formulier.get('antwoord') ?? '');
		if (!challengeId || !antwoord) return fail(400, { fout: 'Er ging iets mis met de passkey.' });

		const { error } = await locals.supabase.auth.passkey.verifyAuthentication({
			challengeId,
			credential: JSON.parse(antwoord)
		});
		if (error) return fail(400, { fout: passkeyUit(error) });

		redirect(303, veiligeBestemming(String(formulier.get('verder') ?? '')));
	},

	/**
	 * Inloggen met een gebruikersnaam en een wachtwoord. Heette `default`, en
	 * heeft nu een naam omdat SvelteKit een naamloze actie niet naast benoemde
	 * acties toestaat -- en de passkey heeft er twee nodig.
	 */
	wachtwoord: async ({ request, locals }) => {
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

		redirect(303, veiligeBestemming(String(formulier.get('verder') ?? '')));
	}
};
