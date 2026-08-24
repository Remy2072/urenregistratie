import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { wordtIngeroosterd, type Persoon } from '$lib/model';
import { magBeheren, wieBenIk } from '$lib/server/wie';
import { korteTijd, maandagVan, nuInNederland, plusDagen } from '$lib/tijd';

export type RoosterRegel = {
	id: string;
	datum: string;
	post_id: string;
	post: string;
	post_volgorde: number;
	persoon_id: string | null;
	persoon: string | null;
	gepland_begin: string;
	gepland_eind: string;
	status: string;
};

export const load: PageServerLoad = async ({ locals, url }) => {
	const nu = nuInNederland();
	const ik = await wieBenIk(locals);
	const supabase = locals.supabase!;

	const dezeWeek = maandagVan(nu.datum);
	const week = maandagVan(url.searchParams.get('week') ?? nu.datum);
	const zondag = plusDagen(week, 6);
	const beheerder = magBeheren(ik);

	// De view `rooster` en niet `diensten`: die laat een bezorger alleen zijn
	// eigen rijen zien. Zie de uitleg bij de view in schema.sql.
	const { data: regels } = await supabase
		.from('rooster')
		.select('*')
		.gte('datum', week)
		.lte('datum', zondag)
		.order('datum')
		.order('post_volgorde');

	// Wie kan er die week? Alleen de baas heeft daar iets aan bij het indelen;
	// een bezorger krijgt via de policies toch alleen zichzelf terug.
	const beschikbaar = beheerder
		? (await supabase.rpc('beschikbaarheid', { maandag: week })).data
		: null;

	// Alleen de baas deelt in, dus alleen hij heeft de bouwstenen nodig: wie er
	// is, welke posten er zijn en welke standaarddiensten erop kunnen.
	const [personen, posten, dienstsoorten] = beheerder
		? await Promise.all([
				// Een eigenaar wordt niet ingeroosterd: hij bevestigt en exporteert,
				// en dat verhoudt zich slecht tot zijn eigen uren goedkeuren. Een
				// superadmin al helemaal niet -- RLS verbergt hem toch al voor
				// iedereen, en dit is de regel voor het enige oog dat hem wél ziet:
				// dat van hemzelf.
				supabase
					.from('personen')
					.select('id, naam, rol, actief')
					.not('rol', 'in', '("eigenaar","superadmin")')
					.order('naam'),
				supabase.from('posten').select('id, naam, volgorde').eq('actief', true).order('volgorde'),
				supabase
					.from('dienstsoorten')
					.select('id, naam, begintijd, eindtijd')
					.eq('actief', true)
					.order('begintijd')
			])
		: [{ data: [] }, { data: [] }, { data: [] }];

	// Welke diensten worden aangeboden? Dit is het scherm waar iedereen naar de
	// week kijkt, dus hier hoort een dienst die iemand niet meer wil op te vallen
	// -- en aan te tikken. Een gericht verzoek zie je alleen als het jou aangaat;
	// dat regelt mijn_ruilverzoeken() zelf.
	const { data: verzoeken } = await supabase.rpc('mijn_ruilverzoeken');
	const aangeboden = Object.fromEntries(
		((verzoeken ?? []) as { id: string; dienst_id: string; status: string; open_verzoek: boolean }[])
			.filter((r) => r.status === 'open')
			.map((r) => [r.dienst_id, { id: r.id, open: r.open_verzoek }])
	) as Record<string, { id: string; open: boolean }>;

	return {
		nu,
		ik,
		beheerder,
		aangeboden,
		week,
		zondag,
		dezeWeek,
		vorige: plusDagen(week, -7),
		volgende: plusDagen(week, 7),
		regels: ((regels ?? []) as RoosterRegel[]).map((r) => ({
			...r,
			gepland_begin: korteTijd(r.gepland_begin)!,
			gepland_eind: korteTijd(r.gepland_eind)!
		})),
		beschikbaar: (beschikbaar ?? []) as {
			persoon_id: string;
			naam: string;
			weekdag: number;
			kan: boolean;
			afwijking: boolean;
		}[],
		personen: (personen.data ?? []) as Persoon[],
		posten: (posten.data ?? []) as { id: string; naam: string; volgorde: number }[],
		dienstsoorten: ((dienstsoorten.data ?? []) as {
			id: string;
			naam: string;
			begintijd: string;
			eindtijd: string;
		}[]).map((d) => ({
			...d,
			begintijd: korteTijd(d.begintijd)!,
			eindtijd: korteTijd(d.eindtijd)!
		}))
	};
};

/**
 * Mag deze persoon ingeroosterd worden?
 *
 * De keuzelijsten laten een eigenaar niet zien, maar een formulier is zo
 * nagemaakt -- en dit is precies het soort regel waar iemand omheen zou
 * kunnen werken.
 *
 * Hier stond `data?.rol !== 'eigenaar'`, en dat was een gat: een rij die je
 * niet mag lezen komt als null terug, en dan was het antwoord ja. Sinds er een
 * onzichtbare rol bestaat (fase 17) is dat geen theorie meer. wordtIngeroosterd
 * zegt nee bij onbekend, en dat is hier de juiste kant om op te vallen.
 */
async function magRijden(locals: App.Locals, persoon_id: string) {
	if (!persoon_id) return true;
	const { data } = await locals
		.supabase!.from('personen')
		.select('naam, rol')
		.eq('id', persoon_id)
		.maybeSingle();
	return wordtIngeroosterd(data?.rol);
}

/** diensten_post_bezet en diensten_persoon_bezet, in gewone taal. */
function vertaal(bericht: string): string {
	if (bericht.includes('diensten_persoon_bezet')) {
		return 'Die staat die dag al ergens anders ingeroosterd.';
	}
	if (bericht.includes('diensten_post_bezet')) {
		return 'Op die bus staat om die tijd al iemand.';
	}
	return bericht;
}

export const actions: Actions = {
	/**
	 * Een dienst wijzigen: wie, welke bus, welke tijden.
	 *
	 * Alle drie in één actie, omdat het op het scherm ook één handeling is --
	 * "Omar gaat toch op Bus 3, en dan de late dienst". Drie losse knoppen
	 * zouden drie keer een constraint kunnen raken op weg naar iets wat wél mag.
	 *
	 * De geplande tijden komen als kopie uit de dienstsoort, net als bij de
	 * weekuitrol: wijzigt die dienstsoort later, dan verandert deze avond niet
	 * mee. Kies je geen dienstsoort, dan blijven de tijden staan.
	 *
	 * Alleen bij een andere persoon gaat de status terug naar 'verwacht' -- dan
	 * heeft de verkeerde persoon hem gemeld. Andere tijden of een andere bus
	 * maken zijn melding niet ongeldig; die wordt er hooguit een afwijking van,
	 * en dat is precies wat de baas op zijn eigen scherm te zien krijgt.
	 */
	wijzig: async ({ request, locals }) => {
		const ik = await wieBenIk(locals);
		if (!magBeheren(ik)) return fail(403, { fout: 'Alleen een beheerder deelt in.' });

		const formulier = await request.formData();
		const id = String(formulier.get('id') ?? '');
		const persoon_id = String(formulier.get('persoon_id') ?? '');
		const post_id = String(formulier.get('post_id') ?? '');
		const dienstsoort_id = String(formulier.get('dienstsoort_id') ?? '');

		if (!(await magRijden(locals, persoon_id))) {
			return fail(400, { fout: 'Een eigenaar wordt niet ingeroosterd.' });
		}

		const { data: dienst } = await locals
			.supabase!.from('diensten')
			.select('status, persoon_id, post_id')
			.eq('id', id)
			.maybeSingle();
		if (!dienst) return fail(404, { fout: 'Die dienst bestaat niet.' });

		const wijziging: Record<string, unknown> = {};
		if (persoon_id) wijziging.persoon_id = persoon_id;
		if (post_id) wijziging.post_id = post_id;

		if (dienstsoort_id) {
			const { data: soort } = await locals
				.supabase!.from('dienstsoorten')
				.select('begintijd, eindtijd')
				.eq('id', dienstsoort_id)
				.maybeSingle();
			if (!soort) return fail(404, { fout: 'Die dienstsoort bestaat niet.' });
			wijziging.gepland_begin = soort.begintijd;
			wijziging.gepland_eind = soort.eindtijd;
		}

		const anderePersoon = persoon_id && persoon_id !== dienst.persoon_id;
		if (anderePersoon && (dienst.status === 'gemeld' || dienst.status === 'bevestigd')) {
			wijziging.status = 'verwacht';
			wijziging.werkelijk_begin = null;
			wijziging.werkelijk_eind = null;
		}

		if (Object.keys(wijziging).length === 0) return { gezet: 0 };

		const { error } = await locals.supabase!.from('diensten').update(wijziging).eq('id', id);
		if (error) return fail(400, { fout: vertaal(error.message) });
		return { gezet: 1, terug: Boolean(wijziging.status) };
	},

	/**
	 * Een dienst erbij die niet uit het sjabloon komt: een derde bus op een
	 * drukke dinsdag. Vandaar `bron = 'handmatig'` -- dan zie je later terug
	 * dat dit een besluit was en geen uitrol.
	 *
	 * De geplande tijden komen als kopie uit de dienstsoort, net als bij de
	 * weekuitrol. Wijzigt die dienstsoort later, dan verandert deze avond niet
	 * mee.
	 */
	toevoegen: async ({ request, locals }) => {
		const ik = await wieBenIk(locals);
		if (!magBeheren(ik)) return fail(403, { fout: 'Alleen een beheerder deelt in.' });

		const formulier = await request.formData();
		const datum = String(formulier.get('datum') ?? '');
		const post_id = String(formulier.get('post_id') ?? '');
		const dienstsoort_id = String(formulier.get('dienstsoort_id') ?? '');
		const persoon_id = String(formulier.get('persoon_id') ?? '');
		if (!datum || !post_id || !dienstsoort_id || !persoon_id) {
			return fail(400, { fout: 'Er ontbreekt iets.' });
		}

		if (!(await magRijden(locals, persoon_id))) {
			return fail(400, { fout: 'Een eigenaar wordt niet ingeroosterd.' });
		}

		const { data: soort } = await locals
			.supabase!.from('dienstsoorten')
			.select('begintijd, eindtijd')
			.eq('id', dienstsoort_id)
			.maybeSingle();
		if (!soort) return fail(404, { fout: 'Die dienstsoort bestaat niet.' });

		const { error } = await locals.supabase!.from('diensten').insert({
			datum,
			post_id,
			persoon_id,
			gepland_begin: soort.begintijd,
			gepland_eind: soort.eindtijd,
			bron: 'handmatig'
		});

		if (error) return fail(400, { fout: vertaal(error.message) });
		return { toegevoegd: 1 };
	},

	/**
	 * Deze rit gaat niet door.
	 *
	 * Geen verwijderen: de dienst gaat op 'vervallen' en blijft staan, want
	 * `mutaties` hangt eraan en dat is bij discussie het enige wat je hebt.
	 * De werkelijke tijden moeten eraf -- zie dienst_niet_gewerkt_geen_tijden.
	 */
	vervallen: async ({ request, locals }) => {
		const ik = await wieBenIk(locals);
		if (!magBeheren(ik)) return fail(403, { fout: 'Alleen een beheerder deelt in.' });

		const id = String((await request.formData()).get('id') ?? '');
		const { error } = await locals
			.supabase!.from('diensten')
			.update({ status: 'vervallen', werkelijk_begin: null, werkelijk_eind: null })
			.eq('id', id);

		if (error) return fail(400, { fout: vertaal(error.message) });
		return { vervallen: 1 };
	}
};
