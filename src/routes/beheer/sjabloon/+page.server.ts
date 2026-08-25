import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { magBeheren, wieBenIk } from '$lib/server/wie';
import { korteTijd, maandagVan, nuInNederland, plusDagen } from '$lib/tijd';

/** Eén regel uit het rapport van rol_week_uit(). */
export type UitrolRegel = {
	datum: string;
	post: string;
	persoon: string;
	begintijd: string;
	eindtijd: string;
	resultaat: string;
};

export type SjabloonRegel = {
	id: string;
	weekdag: number;
	post_id: string;
	persoon_id: string;
	dienstsoort_id: string;
	geldig_vanaf: string;
	geldig_tot: string | null;
	posten: { naam: string } | null;
	personen: { naam: string } | null;
	dienstsoorten: { naam: string; begintijd: string; eindtijd: string } | null;
};

export const load: PageServerLoad = async ({ locals }) => {
	const nu = nuInNederland();
	const ik = await wieBenIk(locals);
	if (!magBeheren(ik)) return { nu, beheerder: false };

	const supabase = locals.supabase!;

	// Wat staat er al? Zonder dit is "uitrollen" een knop waarvan je de
	// uitkomst niet kunt zien zonder naar een ander scherm te gaan.
	const dezeMaandag = maandagVan(nu.datum);
	const volgende = plusDagen(dezeMaandag, 7);
	const telWeek = (maandag: string) =>
		supabase
			.from('diensten')
			.select('id', { count: 'exact', head: true })
			.gte('datum', maandag)
			.lte('datum', plusDagen(maandag, 6));

	const [regels, posten, personen, dienstsoorten, dezeWeek, volgendeWeek] = await Promise.all([
		supabase
			.from('sjabloon_regels')
			.select(
				'*, posten(naam), personen(naam), dienstsoorten(naam, begintijd, eindtijd)'
			)
			.order('weekdag')
			.order('geldig_vanaf'),
		supabase.from('posten').select('id, naam').eq('actief', true).order('volgorde'),
		// Zonder eigenaren: die worden nergens ingeroosterd.
		supabase
			.from('personen')
			.select('id, naam')
			.eq('actief', true)
			.neq('rol', 'eigenaar')
			.order('naam'),
		supabase.from('dienstsoorten').select('id, naam, begintijd, eindtijd').eq('actief', true).order('begintijd'),
		telWeek(dezeMaandag),
		telWeek(volgende)
	]);

	return {
		nu,
		beheerder: true,
		dezeMaandag,
		// Wijzigingen gaan in vanaf een maandag, want dat is wanneer de uitrol
		// draait. Deze week staat er al, dus volgende week is de eerste die je
		// nog kunt sturen.
		volgendeMaandag: volgende,
		dienstenDezeWeek: dezeWeek.count ?? 0,
		dienstenVolgendeWeek: volgendeWeek.count ?? 0,
		regels: ((regels.data ?? []) as SjabloonRegel[]).map((r) => ({
			...r,
			dienstsoorten: r.dienstsoorten
				? {
						...r.dienstsoorten,
						begintijd: korteTijd(r.dienstsoorten.begintijd)!,
						eindtijd: korteTijd(r.dienstsoorten.eindtijd)!
					}
				: null
		})),
		posten: (posten.data ?? []) as { id: string; naam: string }[],
		personen: (personen.data ?? []) as { id: string; naam: string }[],
		dienstsoorten: ((dienstsoorten.data ?? []) as {
			id: string;
			naam: string;
			begintijd: string;
			eindtijd: string;
		}[]).map((d) => ({ ...d, begintijd: korteTijd(d.begintijd)!, eindtijd: korteTijd(d.eindtijd)! }))
	};
};

/**
 * De twee uitsluitingen op sjabloon_regels, in gewone taal.
 *
 * Ze zijn allebei het gevolg van iets wat je niet wil: twee regels voor
 * hetzelfde slot maken elke week twee diensten, en iemand twee keer op dezelfde
 * weekdag laat de uitrol stuklopen op diensten_persoon_bezet.
 */
function vertaal(bericht: string): string {
	if (bericht.includes('sjabloon_geen_dubbel_slot')) {
		return 'Op die bus staat op die weekdag al dezelfde dienst. Stop die regel eerst, of laat de nieuwe later ingaan.';
	}
	if (bericht.includes('sjabloon_geen_dubbele_persoon')) {
		return 'Die staat op die weekdag al ingeroosterd. Iemand kan maar één dienst per dag draaien.';
	}
	if (bericht.includes('sjabloon_periode_klopt')) {
		return 'De einddatum ligt vóór de begindatum.';
	}
	return bericht;
}

const tekst = (f: FormData, naam: string) => String(f.get(naam) ?? '').trim();

async function alleenBeheerder(locals: App.Locals) {
	const ik = await wieBenIk(locals);
	return magBeheren(ik);
}

export const actions: Actions = {
	toevoegen: async ({ request, locals }) => {
		if (!(await alleenBeheerder(locals))) return fail(403, { fout: 'Alleen een beheerder.' });

		const f = await request.formData();
		const weekdag = Number(f.get('weekdag'));
		if (!(weekdag >= 1 && weekdag <= 7)) return fail(400, { fout: 'Onbekende dag.' });

		const persoon_id = tekst(f, 'persoon_id');
		const { data: persoon } = await locals
			.supabase!.from('personen')
			.select('rol')
			.eq('id', persoon_id)
			.maybeSingle();
		if (persoon?.rol === 'eigenaar') {
			return fail(400, { fout: 'Een eigenaar wordt niet ingeroosterd.' });
		}

		const { error } = await locals.supabase!.from('sjabloon_regels').insert({
			weekdag,
			post_id: tekst(f, 'post_id'),
			persoon_id,
			dienstsoort_id: tekst(f, 'dienstsoort_id'),
			geldig_vanaf: tekst(f, 'geldig_vanaf')
		});
		if (error) return fail(400, { fout: vertaal(error.message) });
		return { gedaan: 'toegevoegd' };
	},

	/**
	 * Een regel stopzetten in plaats van weggooien.
	 *
	 * geldig_tot is de laatste dag dat de regel geldt, dus we zetten hem op de
	 * dag vóór de ingangsdatum die je kiest. Daarna blijft hij staan: zo kun je
	 * later terugzien wie er in maart op dinsdag stond, ook al rijdt hij nu niet
	 * meer.
	 */
	stoppen: async ({ request, locals }) => {
		if (!(await alleenBeheerder(locals))) return fail(403, { fout: 'Alleen een beheerder.' });

		const f = await request.formData();
		const vanaf = tekst(f, 'vanaf');
		if (!/^\d{4}-\d{2}-\d{2}$/.test(vanaf)) return fail(400, { fout: 'Geef een datum.' });

		const { error } = await locals
			.supabase!.from('sjabloon_regels')
			.update({ geldig_tot: plusDagen(vanaf, -1) })
			.eq('id', tekst(f, 'id'));
		if (error) return fail(400, { fout: vertaal(error.message) });
		return { gedaan: 'gestopt' };
	},

	/** Weer laten doorlopen: de einddatum eraf. */
	hervatten: async ({ request, locals }) => {
		if (!(await alleenBeheerder(locals))) return fail(403, { fout: 'Alleen een beheerder.' });

		const { error } = await locals
			.supabase!.from('sjabloon_regels')
			.update({ geldig_tot: null })
			.eq('id', tekst(await request.formData(), 'id'));
		if (error) return fail(400, { fout: vertaal(error.message) });
		return { gedaan: 'hervat' };
	},

	/**
	 * Echt weghalen mag alleen als de regel nog nooit gegolden heeft.
	 *
	 * Heeft hij wel gedraaid, dan is hij geschiedenis: er hebben mensen op die
	 * dagen gereden en dan wil je terug kunnen zoeken hoe het rooster eruitzag.
	 * Stopzetten is dan het antwoord.
	 */
	weg: async ({ request, locals }) => {
		if (!(await alleenBeheerder(locals))) return fail(403, { fout: 'Alleen een beheerder.' });

		const id = tekst(await request.formData(), 'id');
		const { data: regel } = await locals
			.supabase!.from('sjabloon_regels')
			.select('geldig_vanaf')
			.eq('id', id)
			.maybeSingle();
		if (!regel) return fail(404, { fout: 'Die regel bestaat niet.' });

		if (regel.geldig_vanaf <= nuInNederland().datum) {
			return fail(409, {
				fout: 'Deze regel heeft al gegolden en blijft daarom staan — zet hem stop per een datum. Zo kun je later terugzien hoe het rooster eruitzag.'
			});
		}

		const { error } = await locals.supabase!.from('sjabloon_regels').delete().eq('id', id);
		if (error) return fail(400, { fout: vertaal(error.message) });
		return { gedaan: 'verwijderd' };
	},

	/**
	 * De week uitrollen: van sjabloon naar diensten.
	 *
	 * Dit was tot nu toe het enige dat alleen in de SQL-editor kon, en dat is
	 * precies één handeling te veel -- de eigenaar hoort geen databasedashboard
	 * nodig te hebben om zijn eigen rooster neer te zetten.
	 *
	 * Er zit geen bevestiging omheen en dat is met opzet: `rol_week_uit()` doet
	 * alleen inserts, slaat over wat er al staat, en laat gemelde of geannuleerde
	 * diensten met rust. Twee keer drukken kan dus niets stukmaken. Wat hij deed
	 * geeft hij terug als rapport, en dat tonen we regel voor regel -- een uitrol
	 * die zwijgend slaagt is enger dan één die vertelt wat hij oversloeg.
	 *
	 * De rolcheck staat in de functie zelf (`is_beheerder()`), dus die hoeft
	 * hier niet nog eens -- maar de vroege uitstap geeft wel een leesbaardere
	 * fout dan de database zou doen.
	 */
	uitrollen: async ({ request, locals }) => {
		if (!(await alleenBeheerder(locals))) return fail(403, { fout: 'Alleen een beheerder.' });

		const maandag = tekst(await request.formData(), 'maandag');
		if (!/^\d{4}-\d{2}-\d{2}$/.test(maandag)) return fail(400, { fout: 'Geef een maandag.' });

		const { data, error } = await locals.supabase!.rpc('rol_week_uit', { week_van: maandag });
		if (error) return fail(400, { fout: error.message });

		const rapport = ((data ?? []) as UitrolRegel[]).map((r) => ({
			...r,
			begintijd: korteTijd(r.begintijd)!,
			eindtijd: korteTijd(r.eindtijd)!
		}));

		return {
			gedaan: 'uitgerold',
			maandag,
			nieuw: rapport.filter((r) => r.resultaat === 'nieuw').length,
			rapport
		};
	}
};
