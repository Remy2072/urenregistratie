import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { wieBenIk } from '$lib/server/wie';
import { maandagVan, nuInNederland, plusDagen } from '$lib/tijd';

type WeekRij = { weekdag: number; kan: boolean };

export const load: PageServerLoad = async ({ locals, url }) => {
	const nu = nuInNederland();
	const ik = await wieBenIk(locals);
	if (!ik) return { nu, ik: null };

	// Standaard volgende week: dat is waar deze pagina over gaat. Deze week kan
	// ook nog, want een bruiloft van overmorgen is geen reden om te bellen.
	const dezeWeek = maandagVan(nu.datum);
	const week = maandagVan(url.searchParams.get('week') ?? plusDagen(dezeWeek, 7));

	const supabase = locals.supabase!;
	const [{ data: standaard }, { data: afwijkingen }] = await Promise.all([
		supabase.from('beschikbaarheid_standaard').select('weekdag, kan').eq('persoon_id', ik.id),
		supabase
			.from('beschikbaarheid_week')
			.select('weekdag, kan')
			.eq('persoon_id', ik.id)
			.eq('week_maandag', week)
	]);

	return {
		nu,
		ik,
		week,
		dezeWeek,
		volgendeWeek: plusDagen(dezeWeek, 7),
		weekErna: plusDagen(dezeWeek, 14),
		// Een week die al loopt ligt vast. De baas heeft hem ingedeeld en zit er
		// misschien al middenin; je beschikbaarheid achteraf omzetten verandert
		// niets meer aan het rooster en zaait alleen twijfel over wat er is
		// afgesproken. Kun je een dienst toch niet draaien, dan is dat een appje
		// naar de baas en geen vinkje hier.
		vergrendeld: week <= dezeWeek,
		standaard: (standaard ?? []) as WeekRij[],
		afwijkingen: (afwijkingen ?? []) as WeekRij[]
	};
};

/** Formulieren kennen geen booleans. */
const alsJaNee = (w: FormDataEntryValue | null) => String(w) === 'ja';

/**
 * Ligt die week al vast?
 *
 * Het scherm laat de knoppen weg, maar dat is geen slot -- een formulier is
 * zo nagemaakt. Daarom staat dezelfde grens hier nog een keer.
 */
function alGelopen(week: string): boolean {
	return week <= maandagVan(nuInNederland().datum);
}

export const actions: Actions = {
	/** Zo kan ik normaal. Geldt voor elke week die er niet van afwijkt. */
	standaard: async ({ request, locals }) => {
		const ik = await wieBenIk(locals);
		if (!ik) return fail(403, { fout: 'Deze login hangt nog niet aan een persoon.' });

		const formulier = await request.formData();
		const weekdag = Number(formulier.get('weekdag'));
		if (!(weekdag >= 1 && weekdag <= 7)) return fail(400, { fout: 'Onbekende dag.' });

		const { error } = await locals.supabase!.from('beschikbaarheid_standaard').upsert(
			{ persoon_id: ik.id, weekdag, kan: alsJaNee(formulier.get('kan')) },
			{ onConflict: 'persoon_id,weekdag' }
		);
		if (error) return fail(400, { fout: error.message });
		return { gezet: true };
	},

	/** Alleen deze ene week anders dan normaal. */
	week: async ({ request, locals }) => {
		const ik = await wieBenIk(locals);
		if (!ik) return fail(403, { fout: 'Deze login hangt nog niet aan een persoon.' });

		const formulier = await request.formData();
		const weekdag = Number(formulier.get('weekdag'));
		if (!(weekdag >= 1 && weekdag <= 7)) return fail(400, { fout: 'Onbekende dag.' });

		const week = maandagVan(String(formulier.get('week') ?? ''));
		if (alGelopen(week)) {
			return fail(409, { fout: 'Die week is al begonnen. Bel of app de baas.' });
		}

		const { error } = await locals.supabase!.from('beschikbaarheid_week').upsert(
			{
				persoon_id: ik.id,
				week_maandag: week,
				weekdag,
				kan: alsJaNee(formulier.get('kan'))
			},
			{ onConflict: 'persoon_id,week_maandag,weekdag' }
		);
		if (error) return fail(400, { fout: error.message });
		return { gezet: true };
	},

	/**
	 * "Voortaan ook zo." Zet je standaard op wat je voor deze week gekozen hebt
	 * en haalt de afwijking weg -- die is dan namelijk geen afwijking meer.
	 *
	 * Dit is de knop voor "ik kan sinds dit blok geen woensdag meer", tegenover
	 * de knop erboven die voor één week geldt. Twee knoppen, omdat het twee
	 * verschillende dingen zijn.
	 */
	voortaan: async ({ request, locals }) => {
		const ik = await wieBenIk(locals);
		if (!ik) return fail(403, { fout: 'Deze login hangt nog niet aan een persoon.' });

		const formulier = await request.formData();
		const weekdag = Number(formulier.get('weekdag'));
		if (!(weekdag >= 1 && weekdag <= 7)) return fail(400, { fout: 'Onbekende dag.' });
		const kan = alsJaNee(formulier.get('kan'));

		const { error } = await locals.supabase!.from('beschikbaarheid_standaard').upsert(
			{ persoon_id: ik.id, weekdag, kan },
			{ onConflict: 'persoon_id,weekdag' }
		);
		if (error) return fail(400, { fout: error.message });

		// De afwijking mag weg: hij zegt nu hetzelfde als de standaard.
		await locals
			.supabase!.from('beschikbaarheid_week')
			.delete()
			.eq('persoon_id', ik.id)
			.eq('week_maandag', maandagVan(String(formulier.get('week') ?? '')))
			.eq('weekdag', weekdag);

		return { gezet: true };
	},

	/**
	 * Terug naar normaal. De afwijking wordt weggehaald en niet omgezet -- dan
	 * volgt die dag weer vanzelf je standaard, ook als je die later wijzigt.
	 */
	normaal: async ({ request, locals }) => {
		const ik = await wieBenIk(locals);
		if (!ik) return fail(403, { fout: 'Deze login hangt nog niet aan een persoon.' });

		const formulier = await request.formData();
		const week = maandagVan(String(formulier.get('week') ?? ''));
		if (alGelopen(week)) {
			return fail(409, { fout: 'Die week is al begonnen. Bel of app de baas.' });
		}

		const { error } = await locals
			.supabase!.from('beschikbaarheid_week')
			.delete()
			.eq('persoon_id', ik.id)
			.eq('week_maandag', week)
			.eq('weekdag', Number(formulier.get('weekdag')));

		if (error) return fail(400, { fout: error.message });
		return { gezet: true };
	}
};
