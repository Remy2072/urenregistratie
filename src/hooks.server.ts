// Elke aanvraag krijgt hier een Supabase-verbinding die weet wie je bent.
//
// De sleutel hieronder is de publieke sleutel. Die mag iedereen zien -- hij
// zit sowieso in de JavaScript van de app. Wat jou beschermt is niet de
// sleutel maar row level security: met alleen die sleutel en zonder login
// kom je nergens bij. Daarom staan de policies in schema.sql en niet hier.

import { createServerClient } from '@supabase/ssr';
import { redirect, type Handle } from '@sveltejs/kit';
import type { Session, User } from '@supabase/supabase-js';
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

	// De deur. event.route.id is null voor alles wat geen pagina is -- statische
	// bestanden, de favicon -- en dat hoeft hier niet langs.
	if (event.route.id && !openbaar.includes(event.url.pathname)) {
		const { user } = await event.locals.veiligeSessie();
		if (!user) redirect(303, '/inloggen');
	}

	return resolve(event, {
		filterSerializedResponseHeaders: (naam) =>
			naam === 'content-range' || naam === 'x-supabase-api-version'
	});
};
