import { redirect } from '@sveltejs/kit';
import { magBeheren, wieBenIk } from '$lib/server/wie';
import type { PageServerLoad } from './$types';

/**
 * De voordeur stuurt je door naar jouw scherm.
 *
 * Hier stond de uitlegpagina van het prototype, met de vaste week 34 erin. Die
 * had zin toen er nog niets werkte en je moest laten zien wat het zou worden;
 * nu is het een tussenstop op weg naar het scherm dat je toch al zocht. De
 * demo staat nog in de branch `fase-0-prototype`.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const ik = await wieBenIk(locals);
	redirect(303, magBeheren(ik) ? '/overzicht' : '/mijn-week');
};
