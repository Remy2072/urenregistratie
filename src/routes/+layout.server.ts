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

	// Een beheerder die zelf ook rijdt houdt zijn eigen week. Bij Tjon staat de
	// baas niet in het rooster, maar dat is een keuze van dit bedrijf en geen
	// eigenschap van de app -- in een kleinere zaak staat de eigenaar gewoon
	// mee op de bus.
	let bezorger = ik.rol !== 'beheerder';
	if (!bezorger) {
		const { count } = await locals.supabase
			.from('diensten')
			.select('*', { count: 'exact', head: true })
			.eq('persoon_id', ik.id);
		bezorger = (count ?? 0) > 0;
	}

	return { ingelogd: true, ik, bezorger, nu };
};
