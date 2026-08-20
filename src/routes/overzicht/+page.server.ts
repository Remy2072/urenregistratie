import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { Dienst, Persoon } from '$lib/model';
import {
	achterafGemeld,
	afwijkend,
	korteTijd,
	korteTijden,
	maandagVan,
	nuInNederland,
	plusDagen
} from '$lib/tijd';
import { magBeheren, wieBenIk } from '$lib/server/wie';

export const load: PageServerLoad = async ({ locals, url }) => {
	const nu = nuInNederland();
	const ik = await wieBenIk(locals);

	if (!magBeheren(ik)) {
		return { nu, beheerder: false, maandag: maandagVan(nu.datum) };
	}

	const supabase = locals.supabase!;

	// Welke week kijk je? Standaard deze. De baas kijkt zondagavond naar de week
	// die net voorbij is, maar op maandagochtend naar dezelfde week -- vandaar
	// dat je terug moet kunnen bladeren.
	const maandag = maandagVan(url.searchParams.get('week') ?? nu.datum);
	const zondag = plusDagen(maandag, 6);

	const [{ data: diensten }, { data: personen }, { data: posten }] = await Promise.all([
		supabase.from('diensten').select('*').gte('datum', maandag).lte('datum', zondag).order('datum'),
		supabase.from('personen').select('id, naam, rol, actief').order('naam'),
		supabase.from('posten').select('id, naam, volgorde').order('volgorde')
	]);

	// Wat er van vóór deze week nog openstaat.
	//
	// Niemand vult dit namens de bezorger in -- dat is de afspraak -- en dus is
	// er ook niets dat zo'n dienst opruimt. Zou hij alleen in zijn eigen week
	// zichtbaar zijn, dan verdwijnt hij stilletjes zodra de week voorbij is en
	// merkt niemand ooit dat er een avond niet verantwoord is.
	const { data: ouder } = await supabase
		.from('diensten')
		.select('*')
		.eq('status', 'verwacht')
		.lt('datum', maandag)
		.order('datum', { ascending: false })
		.limit(50);

	// Ruilverzoeken die openstaan. De baas hoeft er niets mee -- dat is bewust zo
	// besloten, twee bezorgers regelen het -- maar hij moet wel kunnen zien dat er
	// een dienst op de markt ligt.
	const { data: verzoeken } = await supabase.rpc('mijn_ruilverzoeken');

	return {
		nu,
		beheerder: true,
		verzoeken: ((verzoeken ?? []) as {
			id: string;
			datum: string;
			post: string;
			gepland_begin: string;
			gepland_eind: string;
			van_naam: string;
			naar_naam: string | null;
			open_verzoek: boolean;
			status: string;
		}[])
			.filter((r) => r.status === 'open')
			.map((r) => ({
				...r,
				gepland_begin: korteTijd(r.gepland_begin)!,
				gepland_eind: korteTijd(r.gepland_eind)!
			})),
		maandag,
		zondag,
		vorige: plusDagen(maandag, -7),
		volgende: plusDagen(maandag, 7),
		diensten: ((diensten ?? []) as Dienst[]).map(korteTijden),
		ouder: ((ouder ?? []) as Dienst[]).map(korteTijden).filter((d) => d.datum < nu.datum),
		personen: (personen ?? []) as Persoon[],
		posten: Object.fromEntries((posten ?? []).map((p) => [p.id, p.naam]))
	};
};

/** Precies de diensten waar niets te beoordelen valt. Zie de bulkknop. */
function rechttoe(diensten: Dienst[]): Dienst[] {
	return diensten.filter(
		(d) => d.status === 'gemeld' && !afwijkend(d) && !achterafGemeld(d)
	);
}

export const actions: Actions = {
	bevestig: async ({ request, locals }) => {
		const ik = await wieBenIk(locals);
		if (!magBeheren(ik)) return fail(403, { fout: 'Alleen een beheerder bevestigt.' });

		const id = String((await request.formData()).get('id') ?? '');
		const { error } = await locals
			.supabase!.from('diensten')
			.update({ status: 'bevestigd' })
			.eq('id', id)
			.eq('status', 'gemeld');

		if (error) return fail(400, { fout: error.message });
		return { bevestigd: 1 };
	},

	/**
	 * De bulkknop. Welke diensten daaronder vallen bepaalt de server, niet het
	 * formulier -- anders bepaalt de browser wat "zonder afwijking" betekent.
	 */
	bevestigAlle: async ({ request, locals }) => {
		const ik = await wieBenIk(locals);
		if (!magBeheren(ik)) return fail(403, { fout: 'Alleen een beheerder bevestigt.' });

		const formulier = await request.formData();
		const maandag = maandagVan(String(formulier.get('week') ?? ''));
		const zondag = plusDagen(maandag, 6);

		const { data } = await locals
			.supabase!.from('diensten')
			.select('*')
			.gte('datum', maandag)
			.lte('datum', zondag)
			.eq('status', 'gemeld');

		const ids = rechttoe(((data ?? []) as Dienst[]).map(korteTijden)).map((d) => d.id);
		if (ids.length === 0) return { bevestigd: 0 };

		const { error } = await locals
			.supabase!.from('diensten')
			.update({ status: 'bevestigd' })
			.in('id', ids);

		if (error) return fail(400, { fout: error.message });
		return { bevestigd: ids.length };
	},

	/**
	 * Ruilen: één veld, `persoon_id` op de dienst. Het sjabloon blijft ongemoeid
	 * -- die ruil geldt voor één avond, niet voor elke dinsdag -- en `mutaties`
	 * legt vast wie er oorspronkelijk stond.
	 *
	 * Was de dienst al gemeld, dan heeft de verkeerde persoon hem ingevuld. Dan
	 * gaat hij terug naar 'verwacht' zodat de nieuwe persoon hem alsnog meldt.
	 */
	ruil: async ({ request, locals }) => {
		const ik = await wieBenIk(locals);
		if (!magBeheren(ik)) return fail(403, { fout: 'Alleen een beheerder ruilt.' });

		const formulier = await request.formData();
		const id = String(formulier.get('id') ?? '');
		const persoon_id = String(formulier.get('persoon_id') ?? '');
		if (!persoon_id) return fail(400, { fout: 'Kies iemand.' });

		const { data: dienst } = await locals
			.supabase!.from('diensten')
			.select('status, persoon_id')
			.eq('id', id)
			.maybeSingle();

		if (!dienst) return fail(404, { fout: 'Die dienst bestaat niet.' });
		if (dienst.persoon_id === persoon_id) return { geruild: 0 };

		const terug = dienst.status === 'gemeld' || dienst.status === 'bevestigd';
		const { error } = await locals
			.supabase!.from('diensten')
			.update(
				terug
					? { persoon_id, status: 'verwacht', werkelijk_begin: null, werkelijk_eind: null }
					: { persoon_id }
			)
			.eq('id', id);

		if (error) {
			// diensten_persoon_bezet: niemand staat op twee plekken tegelijk.
			const dubbel = error.message.includes('diensten_persoon_bezet');
			return fail(400, {
				fout: dubbel
					? 'Die staat die dag al ergens anders ingeroosterd.'
					: error.message
			});
		}
		return { geruild: 1, terug };
	}
};
