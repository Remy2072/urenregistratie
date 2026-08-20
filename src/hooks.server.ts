// Elke aanvraag krijgt hier een Supabase-verbinding die weet wie je bent.
//
// De sleutel hieronder is de publieke sleutel. Die mag iedereen zien -- hij
// zit sowieso in de JavaScript van de app. Wat jou beschermt is niet de
// sleutel maar row level security: met alleen die sleutel en zonder login
// kom je nergens bij. Daarom staan de policies in schema.sql en niet hier.

import { createServerClient } from '@supabase/ssr';
import { error, redirect, type Handle } from '@sveltejs/kit';
import type { Session, User } from '@supabase/supabase-js';
import type { Ik } from '$lib/server/wie';
import { PUBLIC_SUPABASE_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { dev } from '$app/environment';

/**
 * Waar je zonder login mag komen. Al het andere gaat naar /inloggen.
 *
 * Er staan namen en gewerkte uren in de database. Een uitzondering "want dat
 * scherm is toch niet gevoelig" is precies het soort uitzondering dat je later
 * vergeet, dus die is er niet.
 */
const openbaar = ['/inloggen', '/herstel'];

/**
 * Hoe de sessiecookie eruitziet. Expliciet, en niet zoals `@supabase/ssr` hem
 * standaard zet -- dit is precies het soort ding dat je niet aan een
 * bibliotheekversie wil ophangen.
 *
 * `httpOnly` is het verschil met die standaard, en het kan hier omdat deze app
 * geen browserclient heeft: alles gaat server-side, dus geen enkele regel
 * JavaScript in de browser hoeft die cookie te lezen. Daarmee is hij ook niet
 * te stelen met een stukje ingespoten script.
 *
 * `maxAge` is ruim vier honderd dagen, wat browsers maximaal aanhouden. Dat is
 * de bedoeling uit fase 2: één keer inloggen en daarna nooit meer. Let op wat
 * dit níét is -- de cookie mag lang bestaan, maar hoe lang je sessie geldig
 * blijft bepaalt Supabase (Authentication -> Sessions). Staat daar een
 * inactivity timeout, dan vliegt iedereen er alsnog uit en zie je dat hier niet.
 */
const KOEKJE = {
	path: '/',
	sameSite: 'lax',
	httpOnly: true,
	secure: !dev,
	maxAge: 400 * 24 * 60 * 60
} as const;

/** Zonder .env is er geen database. Zie .env.example. */
export const ingesteld = Boolean(PUBLIC_SUPABASE_URL && PUBLIC_SUPABASE_KEY);

export const handle: Handle = async ({ event, resolve }) => {
	if (!ingesteld) {
		// Niet omvallen zonder .env. Je komt dan niet verder dan /inloggen, en
		// dat scherm legt uit wat er ontbreekt. Zie .env.example.
		event.locals.supabase = null;
		event.locals.veiligeSessie = async () => ({ session: null, user: null, onzeker: false });
		event.locals.ik = async () => null;
		return resolve(event);
	}

	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_KEY, {
		// Passkeys zitten in Supabase achter een experimentele vlag, en zonder
		// deze regel gooit elke passkey-aanroep een fout. Zet hem ook aan in het
		// dashboard: Authentication -> Passkeys. Zie fase 12 in bouwplan.md.
		auth: { experimental: { passkey: true } },
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (koekjes) => {
				for (const { name, value, options } of koekjes) {
					event.cookies.set(name, value, { ...options, ...KOEKJE });
				}
			}
		}
	});

	/**
	 * getSession() leest alleen het koekje en kijkt niet of het klopt -- daar
	 * kun je dus niets op baseren. getUser() vraagt het na bij Supabase. Deze
	 * functie doet allebei en geeft niets terug als de tweede stap faalt.
	 *
	 * `onzeker` is het verschil tussen "je bent niet ingelogd" en "ik kon het
	 * even niet nagaan". Dat waren eerst hetzelfde antwoord, en dus betekende
	 * één hik in het netwerk dat je op het inlogscherm stond terwijl je sessie
	 * prima was -- precies de klacht dat je "steeds opnieuw moet inloggen".
	 *
	 * Wat er niet verandert: zonder geverifieerde gebruiker krijg je geen
	 * gegevens. Dat komt niet van deze functie maar van de policies, en die
	 * blijven staan waar ze staan.
	 *
	 * De uitkomst wordt per verzoek onthouden. Zonder dat vraagt één pagina het
	 * drie keer na bij Supabase -- de deurcontrole hieronder, de layout en de
	 * pagina zelf -- en dat zijn drie netwerkverzoeken voor hetzelfde antwoord.
	 */
	let onthouden: { session: Session | null; user: User | null; onzeker: boolean } | null = null;

	event.locals.veiligeSessie = async () => {
		if (onthouden) return onthouden;

		const supabase = event.locals.supabase!;
		const {
			data: { session }
		} = await supabase.auth.getSession();
		if (!session) return (onthouden = { session: null, user: null, onzeker: false });

		const {
			data: { user },
			error
		} = await supabase.auth.getUser();

		if (error) {
			// Welke fouten zijn een antwoord, en welke een storing?
			//
			// Andersom denken dan je zou verwachten. Een verlopen of al gebruikt
			// refresh token komt terug als 400, en dat is dus wél een antwoord:
			// je bent uitgelogd. Zou je alleen 401 en 403 als antwoord
			// aanmerken, dan krijgt precies die persoon eindeloos "even geen
			// verbinding" te zien in plaats van een inlogscherm.
			//
			// Een storing is dus wat Supabase zelf niet kon beantwoorden: geen
			// netwerk, te veel verzoeken, of iets aan hun kant.
			const storing =
				error.name === 'AuthRetryableFetchError' ||
				error.status === undefined ||
				error.status === 0 ||
				error.status === 429 ||
				error.status >= 500;

			if (storing) {
				console.warn(`kon de sessie niet nagaan (${error.status ?? 'geen status'}): ${error.message}`);
			}
			return (onthouden = { session: null, user: null, onzeker: storing });
		}

		return (onthouden = { session, user, onzeker: false });
	};

	/**
	 * Wie ben je volgens `personen`? Ook één keer per verzoek, om dezelfde
	 * reden: de deurcontrole hieronder, de layout en het scherm vragen het
	 * alle drie.
	 */
	let persoon: { klaar: boolean; waarde: Ik | null } = { klaar: false, waarde: null };

	event.locals.ik = async () => {
		if (persoon.klaar) return persoon.waarde;

		const { user } = await event.locals.veiligeSessie();
		if (!user) {
			persoon = { klaar: true, waarde: null };
			return null;
		}

		const { data, error } = await event.locals
			.supabase!.from('personen')
			.select('id, naam, rol, actief, gebruikersnaam, telefoon')
			.eq('auth_user_id', user.id)
			.maybeSingle();

		// Zonder deze regel wordt een kapotte query stilletjes "deze login hangt
		// nog niet aan een persoon", en dat is een heel ander probleem. De
		// verdenking staat erbij: ontbreekt er een kolom, dan is de migratie nog
		// niet gedraaid.
		if (error) {
			console.error(
				`personen ophalen mislukte: ${error.message} — staan docs/rollen.sql en docs/profiel.sql al op deze database?`
			);
		}

		persoon = { klaar: true, waarde: (data as Ik | null) ?? null };
		return persoon.waarde;
	};

	// De deur. event.route.id is null voor alles wat geen pagina is -- statische
	// bestanden, de favicon -- en dat hoeft hier niet langs.
	if (event.route.id && !openbaar.includes(event.url.pathname)) {
		const { user, onzeker } = await event.locals.veiligeSessie();

		// Kon het niet nagaan? Dan is dit een storing en geen uitlog. Wie hier
		// naar /inloggen stuurt, laat iemand zijn wachtwoord opzoeken voor een
		// probleem dat over tien seconden weg is -- en dat is precies hoe een
		// app de reputatie krijgt dat je er steeds uit ligt.
		if (!user && onzeker) {
			error(503, 'Even geen verbinding met de database. Je bent niet uitgelogd — probeer het opnieuw.');
		}
		// Onthoud waarvoor je kwam. Zonder dit belandt iemand die op een link naar
		// een ruilverzoek tikt na het inloggen op zijn eigen week, en moet hij die
		// link opnieuw zoeken in een groepsapp met honderd berichten.
		if (!user) {
			const verder = event.url.pathname + event.url.search;
			redirect(303, `/inloggen?verder=${encodeURIComponent(verder)}`);
		}

		// Wie hier niet meer werkt komt er niet meer in. Zijn login blijft
		// bestaan -- die gooien we niet weg, want dan verdwijnt de koppeling met
		// zijn oude diensten -- maar hij levert niets meer op. Vinkt de baas hem
		// weer aan, dan werkt alles weer.
		//
		// De database doet dit ook: huidige_persoon_id() kijkt naar `actief`, dus
		// zelfs met een geldige sessie geven de policies niets terug. Dit is
		// alleen de vriendelijke versie, met een zin erbij.
		const ik = await event.locals.ik();
		if (ik && !ik.actief) {
			await event.locals.supabase!.auth.signOut();
			redirect(303, '/inloggen?weg=1');
		}
	}

	return resolve(event, {
		filterSerializedResponseHeaders: (naam) =>
			naam === 'content-range' || naam === 'x-supabase-api-version'
	});
};
