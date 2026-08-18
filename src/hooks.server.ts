// Elke aanvraag krijgt hier een Supabase-verbinding die weet wie je bent.
//
// De sleutel hieronder is de publieke sleutel. Die mag iedereen zien -- hij
// zit sowieso in de JavaScript van de app. Wat jou beschermt is niet de
// sleutel maar row level security: met alleen die sleutel en zonder login
// kom je nergens bij. Daarom staan de policies in schema.sql en niet hier.

import { createServerClient } from '@supabase/ssr';
import { redirect, type Handle } from '@sveltejs/kit';
import type { Session, User } from '@supabase/supabase-js';
import type { Ik } from '$lib/server/wie';
import { PUBLIC_SUPABASE_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';

/**
 * Waar je zonder login mag komen. Al het andere gaat naar /inloggen.
 *
 * Er staan namen en gewerkte uren in de database. Een uitzondering "want dat
 * scherm is toch niet gevoelig" is precies het soort uitzondering dat je later
 * vergeet, dus die is er niet.
 */
const openbaar = ['/inloggen'];

/** Zonder .env is er geen database. Zie .env.example. */
export const ingesteld = Boolean(PUBLIC_SUPABASE_URL && PUBLIC_SUPABASE_KEY);

export const handle: Handle = async ({ event, resolve }) => {
	if (!ingesteld) {
		// Niet omvallen zonder .env. Je komt dan niet verder dan /inloggen, en
		// dat scherm legt uit wat er ontbreekt. Zie .env.example.
		event.locals.supabase = null;
		event.locals.veiligeSessie = async () => ({ session: null, user: null });
		event.locals.ik = async () => null;
		return resolve(event);
	}

	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (koekjes) => {
				for (const { name, value, options } of koekjes) {
					event.cookies.set(name, value, { ...options, path: '/' });
				}
			}
		}
	});

	/**
	 * getSession() leest alleen het koekje en kijkt niet of het klopt -- daar
	 * kun je dus niets op baseren. getUser() vraagt het na bij Supabase. Deze
	 * functie doet allebei en geeft niets terug als de tweede stap faalt.
	 *
	 * De uitkomst wordt per verzoek onthouden. Zonder dat vraagt één pagina het
	 * drie keer na bij Supabase -- de deurcontrole hieronder, de layout en de
	 * pagina zelf -- en dat zijn drie netwerkverzoeken voor hetzelfde antwoord.
	 */
	let onthouden: { session: Session | null; user: User | null } | null = null;

	event.locals.veiligeSessie = async () => {
		if (onthouden) return onthouden;

		const supabase = event.locals.supabase!;
		const {
			data: { session }
		} = await supabase.auth.getSession();
		if (!session) return (onthouden = { session: null, user: null });

		const {
			data: { user },
			error
		} = await supabase.auth.getUser();
		if (error) return (onthouden = { session: null, user: null });

		return (onthouden = { session, user });
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

		const { data } = await event.locals
			.supabase!.from('personen')
			.select('id, naam, rol, actief')
			.eq('auth_user_id', user.id)
			.maybeSingle();

		persoon = { klaar: true, waarde: (data as Ik | null) ?? null };
		return persoon.waarde;
	};

	// De deur. event.route.id is null voor alles wat geen pagina is -- statische
	// bestanden, de favicon -- en dat hoeft hier niet langs.
	if (event.route.id && !openbaar.includes(event.url.pathname)) {
		const { user } = await event.locals.veiligeSessie();
		if (!user) redirect(303, '/inloggen');

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
