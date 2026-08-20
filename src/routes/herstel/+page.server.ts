import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { Actions, PageServerLoad } from './$types';
import {
	controleerCode,
	smsTekst,
	teVeelGeprobeerd,
	verzinSleutel,
	vraagCodeAan,
	zetWachtwoord
} from '$lib/server/herstel';
import { smsIngesteld, stuurSms } from '$lib/server/bird';
import { isGebruikersnaam } from '$lib/server/login';

/**
 * Wachtwoord vergeten, in drie stappen.
 *
 * Welke stap je ziet staat in de URL en niet in een sessie: `/herstel`,
 * `?stap=code`, `?stap=nieuw`. Dat is met opzet, want dit scherm is openbaar --
 * er is geen sessie om iets in te bewaren, en de link uit de sms moet
 * rechtstreeks op stap 2 uitkomen.
 *
 * Wat er níét in de URL staat is het geheim. De code komt per sms en de sleutel
 * voor stap 3 zit in een koekje dat scripts niet kunnen lezen. Zonder dat koekje
 * doet stap 3 niets, ook niet als je het adres uit je hoofd kent.
 */
const KOEKJE = 'herstel_sleutel';

export const load: PageServerLoad = async ({ url, cookies, locals }) => {
	// Al ingelogd? Dan hoort deze pagina niet bij jou. Je wachtwoord wijzig je
	// dan op /ik, met je huidige erbij.
	const { user } = await locals.veiligeSessie();
	if (user) redirect(303, '/ik');

	const stap = url.searchParams.get('stap');
	const naam = url.searchParams.get('naam') ?? '';

	// Stap 3 bestaat alleen met het koekje uit stap 2. Zonder dat begin je
	// opnieuw -- en dat is geen strafmaatregel maar de enige manier waarop dit
	// scherm weet dat je een code hebt gehad.
	if (stap === 'nieuw' && !cookies.get(KOEKJE)) {
		redirect(303, '/herstel');
	}

	return {
		stap: stap === 'code' || stap === 'nieuw' ? stap : 'naam',
		naam,
		// Zonder Bird gaat de code naar de serverlog. Dat mag het scherm zeggen,
		// maar alleen tijdens ontwikkelen -- in productie is het een storing en
		// geen mededeling.
		viaLog: dev && !smsIngesteld()
	};
};

export const actions: Actions = {
	/** Stap 1: een code aanvragen. */
	aanvragen: async ({ request, url, getClientAddress }) => {
		const gebruikersnaam = String((await request.formData()).get('naam') ?? '')
			.trim()
			.toLowerCase();

		if (!gebruikersnaam) return fail(400, { naam: '', fout: 'Vul je gebruikersnaam in.' });

		// Elke uitkomst leidt naar hetzelfde volgende scherm, dus valt er niets af
		// te lezen. Deze teller is er dan ook niet meer tegen het aflopen van
		// namen maar tegen de rekening: elke poging kan een sms zijn.
		if (teVeelGeprobeerd(getClientAddress())) {
			return fail(429, {
				naam: gebruikersnaam,
				fout: 'Te veel pogingen. Wacht een kwartier, of vraag je werkgever om een nieuw wachtwoord.'
			});
		}

		// Dezelfde vorm als in de database: een gebruikersnaam met een apenstaartje
		// erin bestaat niet, dus daar hoeft niets opgezocht te worden. Ook hier
		// geen andere afloop -- door naar hetzelfde scherm.
		if (!isGebruikersnaam(gebruikersnaam)) {
			redirect(303, `/herstel?stap=code&naam=${encodeURIComponent(gebruikersnaam)}`);
		}

		const uitkomst = await vraagCodeAan(gebruikersnaam);

		// Dit is de enige uitkomst die op het scherm mag: hij gaat niet over dit
		// account maar over onze installatie. Zeg je hier niets, dan staat iemand
		// te wachten op een sms die nooit verstuurd kan worden.
		if (uitkomst.uitkomst === 'geen_sleutel') {
			return fail(503, {
				naam: gebruikersnaam,
				fout: 'Wachtwoord herstellen kan hier niet. Vraag je werkgever om een nieuw wachtwoord.'
			});
		}

		if (uitkomst.uitkomst === 'verstuur') {
			// De link is een snelkoppeling naar stap 2 met de naam al ingevuld, geen
			// sleutel. Wie hem doorstuurt geeft niets weg -- de code staat in het
			// bericht en niet in het adres.
			const link = `${url.origin}/herstel?stap=code&naam=${encodeURIComponent(gebruikersnaam)}`;
			const verstuurd = await stuurSms(uitkomst.telefoon, smsTekst(uitkomst.code, link));

			// Ook een mislukte sms geeft geen ander scherm. Wat er mis is staat in de
			// serverlog; de bezorger leest op het codescherm dat hij bij de baas moet
			// zijn als er niets komt, en dat is precies wat hij moet doen.
			if (!verstuurd.verstuurd) {
				console.warn(`herstelcode voor '${gebruikersnaam}' kon niet verstuurd worden`);
			}
		} else {
			// Onbekende naam, geen telefoonnummer, of vandaag al drie keer gevraagd.
			// Alle drie krijgen hetzelfde vervolg als een gelukte aanvraag: geen
			// verschil om aan te zien welke van de drie het was.
			console.warn(`herstel voor '${gebruikersnaam}': ${uitkomst.uitkomst}`);
		}

		redirect(303, `/herstel?stap=code&naam=${encodeURIComponent(gebruikersnaam)}`);
	},

	/** Stap 2: de code narekenen en de sleutel voor stap 3 klaarzetten. */
	code: async ({ request, cookies, getClientAddress }) => {
		const f = await request.formData();
		const gebruikersnaam = String(f.get('naam') ?? '')
			.trim()
			.toLowerCase();
		const code = String(f.get('code') ?? '').replace(/\s/g, '');

		if (!gebruikersnaam || !code) return fail(400, { fout: 'Vul je gebruikersnaam en de code in.' });
		if (teVeelGeprobeerd(getClientAddress())) {
			return fail(429, { fout: 'Te veel pogingen. Wacht een kwartier.' });
		}

		const sleutel = verzinSleutel();
		const uitkomst = await controleerCode(gebruikersnaam, code, sleutel);

		if (uitkomst === 'ok') {
			// Tien minuten, alleen voor dit pad, en niet te lezen door scripts.
			cookies.set(KOEKJE, sleutel, {
				path: '/herstel',
				httpOnly: true,
				sameSite: 'lax',
				secure: !dev,
				maxAge: 600
			});
			redirect(303, '/herstel?stap=nieuw');
		}

		if (uitkomst === 'fout') return fail(400, { fout: 'Die code klopt niet.' });
		if (uitkomst === 'verlopen') {
			return fail(400, { fout: 'Deze code is verlopen of te vaak fout ingevuld. Vraag een nieuwe aan.' });
		}
		return fail(400, { fout: 'Dat lukte niet. Vraag een nieuwe code aan.' });
	},

	/** Stap 3: het nieuwe wachtwoord. Twee keer, zodat een typefout niet blijft staan. */
	nieuw: async ({ request, cookies }) => {
		const sleutel = cookies.get(KOEKJE);
		if (!sleutel) return fail(403, { fout: 'Begin opnieuw: deze stap is verlopen.' });

		const f = await request.formData();
		const een = String(f.get('wachtwoord') ?? '');
		const twee = String(f.get('nogmaals') ?? '');

		if (een.length < 8) {
			return fail(400, { fout: 'Neem er minstens acht tekens voor — het hoeft maar één keer.' });
		}
		if (een !== twee) return fail(400, { fout: 'De twee wachtwoorden zijn niet hetzelfde.' });

		const uitkomst = await zetWachtwoord(sleutel, een);
		if (!uitkomst.gelukt) return fail(400, { fout: uitkomst.fout });

		// Het koekje mag weg: de code is nu gebruikt en de sleutel is niets meer
		// waard. En daarna één keer echt inloggen -- dan weet je zeker dat het
		// nieuwe wachtwoord werkt. Zelfde afloop als op /ik.
		cookies.delete(KOEKJE, { path: '/herstel' });
		redirect(303, '/inloggen?nieuw=1');
	}
};
