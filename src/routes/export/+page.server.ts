import type { PageServerLoad } from './$types';
import { wieBenIk } from '$lib/server/wie';
import { haalUren } from '$lib/server/uren';
import {
	eersteVanDeMaand,
	laatsteVanDeMaand,
	maandTerug,
	maandagVan,
	nuInNederland,
	plusDagen
} from '$lib/tijd';

export const load: PageServerLoad = async ({ locals, url }) => {
	const nu = nuInNederland();
	const ik = await wieBenIk(locals);

	if (ik?.rol !== 'beheerder') return { nu, beheerder: false };

	// Standaard deze maand. De baas bevestigt per week, de boekhouder rekent af
	// per maand -- dus is de maand de periode waarin dit scherm gebruikt wordt.
	const van = url.searchParams.get('van') || eersteVanDeMaand(nu.datum);
	const tot = url.searchParams.get('tot') || laatsteVanDeMaand(nu.datum);

	const vorigeMaand = maandTerug(nu.datum);
	const maandag = maandagVan(nu.datum);

	return {
		nu,
		beheerder: true,
		van,
		tot,
		regels: await haalUren(locals.supabase!, van, tot),
		snelkeuzes: [
			{ naam: 'Deze week', van: maandag, tot: plusDagen(maandag, 6) },
			{ naam: 'Vorige week', van: plusDagen(maandag, -7), tot: plusDagen(maandag, -1) },
			{ naam: 'Deze maand', van: eersteVanDeMaand(nu.datum), tot: laatsteVanDeMaand(nu.datum) },
			{
				naam: 'Vorige maand',
				van: eersteVanDeMaand(vorigeMaand),
				tot: laatsteVanDeMaand(vorigeMaand)
			}
		]
	};
};
