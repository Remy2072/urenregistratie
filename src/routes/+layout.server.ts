import { nuInNederland } from '$lib/tijd';
import type { LayoutServerLoad } from './$types';

/**
 * Of je ingelogd bent -- genoeg om de navigatie te tekenen -- en hoe laat het
 * is. Dat laatste komt van de server en niet uit de browser, zodat de kop
 * dezelfde week aanwijst als de schermen eronder.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	const { user } = await locals.veiligeSessie();
	return { ingelogd: user !== null, nu: nuInNederland() };
};
