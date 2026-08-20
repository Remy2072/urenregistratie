import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { Dienst } from '$lib/model';
import {
	dagNaam,
	datumKort,
	isHalfUur,
	korteTijd,
	korteTijden,
	maandagVan,
	minuten,
	nuInNederland,
	plusDagen
} from '$lib/tijd';
import { wieBenIk } from '$lib/server/wie';
import { stuurSms } from '$lib/server/bird';

/** Eén regel uit mijn_ruilverzoeken(). Zie docs/ruilen.sql. */
export type Ruilverzoek = {
	id: string;
	dienst_id: string;
	datum: string;
	post: string;
	gepland_begin: string;
	gepland_eind: string;
	van_naam: string;
	naar_naam: string | null;
	open_verzoek: boolean;
	van_mij: boolean;
	voor_mij: boolean;
	status: string;
	aangemaakt_op: string;
};

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

	if (!ik) return { nu, maandag, zondag, ik: null, diensten: [], posten: {}, verzoeken: [] };

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

	// Wat er aan ruilverzoeken speelt: die van mij, die aan mij, en de open
	// verzoeken van collega's. Wie wat mag zien staat in mijn_ruilverzoeken().
	const { data: verzoeken } = await supabase.rpc('mijn_ruilverzoeken');

	return {
		nu,
		maandag,
		zondag,
		ik,
		verzoeken: ((verzoeken ?? []) as Ruilverzoek[]).map((r) => ({
			...r,
			gepland_begin: korteTijd(r.gepland_begin)!,
			gepland_eind: korteTijd(r.gepland_eind)!
		})),
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
	},

	/**
	 * Wie kan die dag? Wordt pas opgehaald als iemand op "Ruilen" tikt.
	 *
	 * Niet in `load`, want dat is één vraag per dienst en je hebt hem bij hoogstens
	 * één nodig. De lijst komt uit een functie in de database, omdat een bezorger
	 * via `personen` alleen zichzelf mag zien.
	 */
	kandidaten: async ({ request, locals }) => {
		const ik = await wieBenIk(locals);
		if (!ik) return fail(403, { fout: 'Deze login hangt nog niet aan een persoon.' });

		const dienst_id = String((await request.formData()).get('dienst_id') ?? '');
		const { data, error } = await locals.supabase!.rpc('ruilkandidaten', {
			p_dienst_id: dienst_id
		});
		if (error) return fail(400, { fout: error.message });

		return { kandidaten: data as { persoon_id: string; naam: string; kan: boolean; bezet: boolean }[] };
	},

	/**
	 * Een verzoek versturen: gericht aan één collega, of open voor de groep.
	 *
	 * Bij een gericht verzoek gaat er een sms heen. Bij een open verzoek niet --
	 * dan krijg je een link die je zelf in de groepsapp zet, en dat is precies
	 * waarom dit geen acht sms'jes kost.
	 */
	ruilVragen: async ({ request, locals, url }) => {
		const ik = await wieBenIk(locals);
		if (!ik) return fail(403, { fout: 'Deze login hangt nog niet aan een persoon.' });

		const f = await request.formData();
		const dienst_id = String(f.get('dienst_id') ?? '');
		const naar = String(f.get('naar') ?? '');

		const { data, error } = await locals
			.supabase!.rpc('ruil_aanvragen', {
				p_dienst_id: dienst_id,
				p_naar: naar === '' ? null : naar
			})
			.maybeSingle();

		// De functie werpt zinnen op, geen codes: 'Dit is jouw dienst niet',
		// 'Die staat die dag al ergens ingeroosterd'. Die mogen zo op het scherm.
		if (error) return fail(400, { fout: error.message });

		const rij = data as { verzoek_id: string; naar_naam: string | null; naar_telefoon: string | null };
		const link = `${url.origin}/ruil/${rij.verzoek_id}`;

		if (naar === '') {
			return { open: { link, verzoek_id: rij.verzoek_id } };
		}

		if (!rij.naar_telefoon) {
			return {
				gevraagd: rij.naar_naam,
				let_op: `${rij.naar_naam} heeft geen telefoonnummer, dus er is geen sms verstuurd. Stuur hem deze link zelf: ${link}`
			};
		}

		// De sms is bij een gericht verzoek het hele product, dus staat er in wat
		// iemand nodig heeft om ja of nee te zeggen: welke dag, welke bus, hoe laat.
		// "Daan vraagt of je een dienst overneemt" laat hem de app openen om te
		// weten waar het over gaat, en dat is precies één stap te veel.
		const { data: dienst } = await locals
			.supabase!.from('diensten')
			.select('datum, gepland_begin, gepland_eind, posten(naam)')
			.eq('id', dienst_id)
			.maybeSingle();

		const wanneer = dienst
			? `${dagNaam(dienst.datum)} ${datumKort(dienst.datum)} ${korteTijd(dienst.gepland_begin)}-${korteTijd(dienst.gepland_eind)}`
			: 'een dienst';
		// Een ingesloten tabel komt bij Supabase soms als rij en soms als lijstje
		// terug, afhankelijk van hoe de relatie gelezen wordt. Allebei opvangen is
		// twee regels; erop gokken kost je een lege sms-tekst.
		const ingesloten = dienst?.posten as { naam: string }[] | { naam: string } | null;
		const waar = Array.isArray(ingesloten) ? ingesloten[0]?.naam : ingesloten?.naam;

		const verstuurd = await stuurSms(
			rij.naar_telefoon,
			`${ik.naam} vraagt of je ${wanneer}${waar ? ` op ${waar}` : ''} overneemt. Ja of nee: ${link}`
		);

		if (!verstuurd.verstuurd) {
			return { gevraagd: rij.naar_naam, let_op: `De sms kon niet verstuurd worden. Stuur hem deze link zelf: ${link}` };
		}

		return { gevraagd: rij.naar_naam };
	},

	/** Een verzoek weer sluiten. Bij een open verzoek is dat geen luxe: die link blijft rondslingeren. */
	ruilIntrekken: async ({ request, locals }) => {
		const ik = await wieBenIk(locals);
		if (!ik) return fail(403, { fout: 'Deze login hangt nog niet aan een persoon.' });

		const id = String((await request.formData()).get('id') ?? '');
		const { error } = await locals.supabase!.rpc('ruil_intrekken', { p_verzoek_id: id });
		if (error) return fail(400, { fout: error.message });
		return { ingetrokken: 1 };
	}
};
