import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

/**
 * De beheersleutel van Supabase.
 *
 * Deze sleutel gaat langs row level security heen: wie hem heeft mag alles,
 * in elke tabel, namens iedereen. Daarom staat hij hier en nergens anders, en
 * daarom is dit bestand `.server.` -- SvelteKit weigert het naar de browser te
 * sturen, ook als iemand het per ongeluk importeert in een component.
 *
 * Er is precies één ding waarvoor hij nodig is: een account aanmaken voor een
 * nieuwe medewerker. Dat kan niet met de publieke sleutel, want dan zou
 * iedereen accounts kunnen aanmaken.
 *
 * `$env/dynamic/private` en niet `static`: zonder deze sleutel moet de app
 * gewoon starten. Dan werkt alleen die ene knop niet, en zegt hij dat ook.
 */
export function beheerClient(): SupabaseClient | null {
	const sleutel = env.SUPABASE_SECRET_KEY;
	if (!sleutel || !PUBLIC_SUPABASE_URL) return null;

	return createClient(PUBLIC_SUPABASE_URL, sleutel, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
}

// Geen l, I, 1, O of 0: dit wordt op een telefoon overgetypt van een briefje.
const TEKENS = 'abcdefghijkmnpqrstuvwxyz23456789';

/**
 * Een wachtwoord dat je één keer voorleest en dat daarna in de telefoon blijft.
 *
 * Vijftien tekens uit een alfabet van 32 is ruim tachtig bits; in stukjes van
 * vier omdat niemand een muur van letters foutloos overtypt.
 */
export function verzinWachtwoord(): string {
	const getallen = crypto.getRandomValues(new Uint32Array(15));
	const woord = [...getallen].map((n) => TEKENS[n % TEKENS.length]).join('');
	return woord.replace(/(.{5})(?=.)/g, '$1-');
}
