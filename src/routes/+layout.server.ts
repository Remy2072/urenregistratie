import { nuInNederland } from '$lib/tijd';
import type { LayoutServerLoad } from './$types';

/**
 * Wie je bent en hoe laat het is. Dat laatste komt van de server en niet uit
 * de browser, zodat de kop dezelfde week aanwijst als de schermen eronder.
 *
 * De naam staat in `personen`, niet in Supabase Auth: auth weet alleen wie je
 * bent, `auth_user_id` legt de verbinding. Is die verbinding er nog niet, dan
 * blijft `ik` leeg en zegt /ik er iets over.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	const nu = nuInNederland();
	const { user } = await locals.veiligeSessie();
	if (!user || !locals.supabase) return { ingelogd: false, ik: null, nu };

	const { data } = await locals.supabase
		.from('personen')
		.select('naam')
		.eq('auth_user_id', user.id)
		.maybeSingle();

	return { ingelogd: true, ik: data as { naam: string } | null, nu };
};
