import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { korteTijd } from '$lib/tijd';
import { wieBenIk } from '$lib/server/wie';
import type { Ruilverzoek } from '../../mijn-week/+page.server';

/**
 * Het scherm achter de link uit een ruilverzoek.
 *
 * Dit scherm is níét openbaar, en dat is de hele beveiliging van dit onderdeel:
 * de link is een adres en geen sleutel. Wie hem doorstuurt naar buiten geeft
 * niets weg, want een vreemde komt niet verder dan het inlogscherm. En wie kan
 * inloggen is een collega -- precies degene die deze dienst mag overnemen.
 *
 * Wat je te zien krijgt bepaalt `mijn_ruilverzoeken()`: je eigen verzoeken, die
 * aan jou, en de open verzoeken. Een gericht verzoek aan iemand anders staat er
 * niet in, dus dat leest hier als "niet gevonden".
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	const ik = await wieBenIk(locals);
	if (!ik) {
		error(403, 'Deze login hangt nog niet aan een persoon. Vraag of dat gekoppeld wordt.');
	}

	const { data } = await locals.supabase!.rpc('mijn_ruilverzoeken');
	const verzoek = ((data ?? []) as Ruilverzoek[]).find((r) => r.id === params.id);

	if (!verzoek) {
		error(404, 'Dit ruilverzoek bestaat niet, of het is niet voor jou.');
	}

	return {
		ik,
		verzoek: {
			...verzoek,
			gepland_begin: korteTijd(verzoek.gepland_begin)!,
			gepland_eind: korteTijd(verzoek.gepland_eind)!
		}
	};
};

/** De codes uit ruil_accepteren() in gewone taal. Zie sql/ruilen.sql. */
function vertaal(code: string): string {
	if (code === 'te_laat') return 'Iemand was je net voor — deze dienst is al overgenomen.';
	if (code === 'bezet') return 'Je staat die dag al ergens ingeroosterd.';
	if (code === 'niet_voor_jou') return 'Dit verzoek is niet voor jou.';
	if (code === 'verlopen') return 'Deze dienst is al begonnen.';
	return 'Dat lukte niet. Ververs de pagina en probeer het nog eens.';
}

export const actions: Actions = {
	accepteren: async ({ params, locals }) => {
		const { data, error: fout } = await locals.supabase!.rpc('ruil_accepteren', {
			p_verzoek_id: params.id
		});
		if (fout) return fail(400, { fout: fout.message });
		if (data !== 'ok') return fail(409, { fout: vertaal(String(data)) });

		// Gelukt: de dienst staat nu in jouw week, en dat is precies waar je hem
		// wil zien. Vandaar geen melding hier maar door naar dat scherm.
		redirect(303, '/mijn-week?overgenomen=1');
	},

	weigeren: async ({ params, locals }) => {
		const { error: fout } = await locals.supabase!.rpc('ruil_weigeren', {
			p_verzoek_id: params.id
		});
		if (fout) return fail(400, { fout: fout.message });
		return { geweigerd: 1 };
	}
};
