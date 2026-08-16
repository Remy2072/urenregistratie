// Elke aanvraag krijgt hier een Supabase-verbinding die weet wie je bent.
//
// De sleutel hieronder is de publieke sleutel. Die mag iedereen zien -- hij
// zit sowieso in de JavaScript van de app. Wat jou beschermt is niet de
// sleutel maar row level security: met alleen die sleutel en zonder login
// kom je nergens bij. Daarom staan de policies in schema.sql en niet hier.

import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';

/** Zonder .env is er geen database. Zie .env.example. */
export const ingesteld = Boolean(PUBLIC_SUPABASE_URL && PUBLIC_SUPABASE_KEY);

export const handle: Handle = async ({ event, resolve }) => {
	if (!ingesteld) {
		// Niet omvallen. Het prototype draait op nepdata en heeft Supabase
		// helemaal niet nodig; alleen inloggen kan dan niet.
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
	 */
	event.locals.veiligeSessie = async () => {
		const supabase = event.locals.supabase!;
		const {
			data: { session }
		} = await supabase.auth.getSession();
		if (!session) return { session: null, user: null };

		const {
			data: { user },
			error
		} = await supabase.auth.getUser();
		if (error) return { session: null, user: null };

		return { session, user };
	};

	return resolve(event, {
		filterSerializedResponseHeaders: (naam) =>
			naam === 'content-range' || naam === 'x-supabase-api-version'
	});
};
