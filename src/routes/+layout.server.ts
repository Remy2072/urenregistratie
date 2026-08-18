import { nuInNederland } from '$lib/tijd';
import { wieBenIk } from '$lib/server/wie';
import type { LayoutServerLoad } from './$types';

/**
 * Wie je bent, hoe laat het is, en welke tabbladen jou aangaan.
 *
 * De tabbladen zijn geen beveiliging -- dat doen de policies en de schermen
 * zelf -- maar wel opruiming. Een bezorger heeft niets te zoeken op het
 * bazenscherm en andersom, en een tabblad dat je nooit gebruikt is een tabblad
 * waar je een keer per ongeluk op drukt.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	const nu = nuInNederland();
	const { user } = await locals.veiligeSessie();
	if (!user || !locals.supabase) return { ingelogd: false, ik: null, bezorger: false, nu };

	const ik = await wieBenIk(locals);
	if (!ik) return { ingelogd: true, ik: null, bezorger: false, nu };

	// Wie krijgt "Mijn week" en "Wanneer ik kan"? Iedereen die kan rijden.
	//
	// Een manager rijdt soms mee, dus die houdt ze altijd -- anders moet hij
	// eerst ingeroosterd worden voordat hij kan zeggen wanneer hij kan, en dat
	// is de verkeerde volgorde. Een eigenaar wordt nergens ingeroosterd (zie de
	// controle in het roosterscherm), dus voor hem zijn het lege schermen.
	const bezorger = ik.rol !== 'eigenaar';

	return { ingelogd: true, ik, bezorger, nu };
};
