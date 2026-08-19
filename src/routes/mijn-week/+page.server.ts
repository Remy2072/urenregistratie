import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { Dienst } from '$lib/model';
import { isHalfUur, korteTijd, korteTijden, maandagVan, minuten, nuInNederland, plusDagen } from '$lib/tijd';
import { wieBenIk } from '$lib/server/wie';

export const load: PageServerLoad = async ({ locals }) => {
	const ik = await wieBenIk(locals);
	const supabase = locals.supabase!;

	// De klok wordt hier gelezen en niet in het scherm. Zo kijkt iedereen naar
	// dezelfde week, ook wie zijn telefoon op een andere tijdzone heeft staan.
	const nu = nuInNederland();
	const maandag = maandagVan(nu.datum);
	const zondag = plusDagen(maandag, 6);

	// Een week extra terug. "Gisteren kan gewoon nog" moet ook op maandag
	// gelden, en dan ligt gisteren in de week ervoor. Alleen wat daar nog
	// openstaat komt op het scherm; de rest van die week is geschiedenis.
	const vanaf = plusDagen(maandag, -7);

	if (!ik) return { nu, maandag, zondag, ik: null, diensten: [], posten: {} };

	const { data: posten } = await supabase.from('posten').select('id, naam');

	// persoon_id staat er expliciet bij. Row level security laat een beheerder
	// alle diensten zien, en dit scherm is nadrukkelijk alleen van jou -- ook
	// als jij toevallig de baas bent.
	const { data: diensten, error } = await supabase
		.from('diensten')
		.select('*')
		.eq('persoon_id', ik.id)
		.gte('datum', vanaf)
		.lte('datum', zondag)
		.order('datum');

	return {
		nu,
		maandag,
		zondag,
		ik,
		// Tijden hier één keer inkorten, zodat geen enkel scherm '16:00:00'
		// hoeft te kennen. Zie korteTijd().
		diensten: ((diensten ?? []) as Dienst[]).map(korteTijden),
		posten: Object.fromEntries((posten ?? []).map((p) => [p.id, p.naam])),
		fout: error?.message ?? null
	};
};

export const actions: Actions = {
	/**
	 * Melden. De app zet alleen de tijden en de status; gemeld_op en
	 * gemeld_door stempelt de database zelf in dienst_wijziging_bewaken().
	 * Dat is precies waarom "achteraf gemeld" niet te vervalsen is vanaf hier.
	 */
	melden: async ({ request, locals }) => {
		const ik = await wieBenIk(locals);
		if (!ik) return fail(403, { fout: 'Deze login hangt nog niet aan een persoon.' });

		const formulier = await request.formData();
		const id = String(formulier.get('id') ?? '');
		const begin = String(formulier.get('begin') ?? '');
		const eind = String(formulier.get('eind') ?? '');

		// Dezelfde regels als het schema. De database houdt het tegen, maar een
		// zin is prettiger dan een constraint-fout.
		if (!isHalfUur(begin) || !isHalfUur(eind)) {
			return fail(400, { fout: 'Tijden kunnen alleen op hele en halve uren.' });
		}
		if (minuten(eind) <= minuten(begin)) {
			return fail(400, { fout: 'De eindtijd moet na de begintijd liggen.' });
		}

		// Wijken de tijden af, dan hoort er een reden bij. Anders staat er straks
		// "+30 min" op het scherm van de baas zonder uitleg en gaat hij bellen --
		// precies het telefoontje dat deze app moet uitsparen.
		const opmerking = String(formulier.get('opmerking') ?? '').trim();
		const { data: gepland } = await locals
			.supabase!.from('diensten')
			.select('gepland_begin, gepland_eind')
			.eq('id', id)
			.maybeSingle();

		const afwijkend =
			gepland !== null &&
			(korteTijd(gepland.gepland_begin) !== begin || korteTijd(gepland.gepland_eind) !== eind);

		if (afwijkend && opmerking === '') {
			return fail(400, { fout: 'Zet er even bij wat er anders was — dan hoeft de baas niet te bellen.' });
		}

		const { data, error } = await locals
			.supabase!.from('diensten')
			.update({
				werkelijk_begin: begin,
				werkelijk_eind: eind,
				status: 'gemeld',
				opmerking: opmerking === '' ? null : opmerking
			})
			.eq('id', id)
			.eq('persoon_id', ik.id)
			.select('id');

		if (error) return fail(400, { fout: error.message });

		// Geen fout maar ook geen rij: dan hield row level security het tegen.
		// Bijvoorbeeld een dienst die de baas al bevestigd heeft.
		if (!data?.length) {
			return fail(409, { fout: 'Deze dienst kan niet (meer) gemeld worden.' });
		}

		return { gemeld: id };
	}
};
