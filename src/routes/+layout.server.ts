import type { LayoutServerLoad } from './$types';

/** Alleen of je ingelogd bent -- genoeg om de navigatie te tekenen. */
export const load: LayoutServerLoad = async ({ locals }) => {
	const { user } = await locals.veiligeSessie();
	return { ingelogd: user !== null };
};
