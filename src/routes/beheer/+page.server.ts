import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { wieBenIk } from '$lib/server/wie';
import { beheerClient, verzinWachtwoord } from '$lib/server/beheersleutel';
import { isHalfUur, korteTijd, nuInNederland } from '$lib/tijd';

export const load: PageServerLoad = async ({ locals }) => {
	const nu = nuInNederland();
	const ik = await wieBenIk(locals);
	if (ik?.rol !== 'beheerder') return { nu, beheerder: false };

	const supabase = locals.supabase!;
	const [posten, dienstsoorten, personen] = await Promise.all([
		supabase.from('posten').select('*').order('volgorde'),
		supabase.from('dienstsoorten').select('*').order('begintijd'),
		supabase.from('personen').select('*').order('naam')
	]);

	// Met welk adres logt iemand in? Dat staat in Supabase Auth en niet in
	// `personen`, dus daar is de beheersleutel voor nodig. Ontbreekt die, dan
	// blijft de rest van dit scherm gewoon werken.
	const admin = beheerClient();
	const adressen: Record<string, string> = {};
	if (admin) {
		const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
		for (const u of data?.users ?? []) if (u.email) adressen[u.id] = u.email;
	}

	return {
		nu,
		beheerder: true,
		ik,
		sleutelAanwezig: admin !== null,
		adressen,
		posten: (posten.data ?? []) as { id: string; naam: string; volgorde: number; actief: boolean }[],
		dienstsoorten: ((dienstsoorten.data ?? []) as {
			id: string;
			naam: string;
			begintijd: string;
			eindtijd: string;
			actief: boolean;
		}[]).map((d) => ({ ...d, begintijd: korteTijd(d.begintijd)!, eindtijd: korteTijd(d.eindtijd)! })),
		personen: (personen.data ?? []) as {
			id: string;
			naam: string;
			rol: string;
			actief: boolean;
			auth_user_id: string | null;
		}[]
	};
};

/**
 * Foutmeldingen uit Postgres in gewone taal.
 *
 * 23503 is een foreign key: je probeert iets weg te gooien waar nog diensten
 * of sjabloonregels aan hangen. Dat is geen fout van de gebruiker maar het
 * schema dat de geschiedenis beschermt, en dat mag je zo ook zeggen.
 */
function vertaal(fout: { code?: string; message: string }, wat: string): string {
	if (fout.code === '23503') {
		return `Deze ${wat} is in gebruik — er hangen nog diensten of sjabloonregels aan. Zet hem op non-actief in plaats van weg te gooien; dan blijft de geschiedenis kloppen.`;
	}
	if (fout.code === '23505') return `Die naam bestaat al.`;
	return fout.message;
}

async function alleenBeheerder(locals: App.Locals) {
	const ik = await wieBenIk(locals);
	return ik?.rol === 'beheerder' ? ik : null;
}

const tekst = (f: FormData, naam: string) => String(f.get(naam) ?? '').trim();
const aan = (f: FormData, naam: string) => f.get(naam) !== null;

export const actions: Actions = {
	// ── Posten: bussen, scooters, straks een keuken ────────────────────
	postToevoegen: async ({ request, locals }) => {
		if (!(await alleenBeheerder(locals))) return fail(403, { fout: 'Alleen een beheerder.' });
		const f = await request.formData();
		const naam = tekst(f, 'naam');
		if (!naam) return fail(400, { fout: 'Geef een naam.' });

		const { error } = await locals
			.supabase!.from('posten')
			.insert({ naam, volgorde: Number(f.get('volgorde')) || 0 });
		if (error) return fail(400, { fout: vertaal(error, 'post') });
		return { gedaan: 'toegevoegd' };
	},

	postWijzig: async ({ request, locals }) => {
		if (!(await alleenBeheerder(locals))) return fail(403, { fout: 'Alleen een beheerder.' });
		const f = await request.formData();
		const { error } = await locals
			.supabase!.from('posten')
			.update({ naam: tekst(f, 'naam'), volgorde: Number(f.get('volgorde')) || 0, actief: aan(f, 'actief') })
			.eq('id', tekst(f, 'id'));
		if (error) return fail(400, { fout: vertaal(error, 'post') });
		return { gedaan: 'opgeslagen' };
	},

	postWeg: async ({ request, locals }) => {
		if (!(await alleenBeheerder(locals))) return fail(403, { fout: 'Alleen een beheerder.' });
		const f = await request.formData();
		const { error } = await locals.supabase!.from('posten').delete().eq('id', tekst(f, 'id'));
		if (error) return fail(400, { fout: vertaal(error, 'post') });
		return { gedaan: 'verwijderd' };
	},

	// ── Dienstsoorten: de standaardtijden ──────────────────────────────
	soortToevoegen: async ({ request, locals }) => {
		if (!(await alleenBeheerder(locals))) return fail(403, { fout: 'Alleen een beheerder.' });
		const f = await request.formData();
		const naam = tekst(f, 'naam');
		const begintijd = tekst(f, 'begintijd');
		const eindtijd = tekst(f, 'eindtijd');
		if (!naam) return fail(400, { fout: 'Geef een naam.' });
		if (!isHalfUur(begintijd) || !isHalfUur(eindtijd)) {
			return fail(400, { fout: 'Tijden kunnen alleen op hele en halve uren.' });
		}
		if (eindtijd <= begintijd) return fail(400, { fout: 'De eindtijd moet na de begintijd liggen.' });

		const { error } = await locals
			.supabase!.from('dienstsoorten')
			.insert({ naam, begintijd, eindtijd });
		if (error) return fail(400, { fout: vertaal(error, 'dienstsoort') });
		return { gedaan: 'toegevoegd' };
	},

	soortWijzig: async ({ request, locals }) => {
		if (!(await alleenBeheerder(locals))) return fail(403, { fout: 'Alleen een beheerder.' });
		const f = await request.formData();
		const begintijd = tekst(f, 'begintijd');
		const eindtijd = tekst(f, 'eindtijd');
		if (!isHalfUur(begintijd) || !isHalfUur(eindtijd)) {
			return fail(400, { fout: 'Tijden kunnen alleen op hele en halve uren.' });
		}
		if (eindtijd <= begintijd) return fail(400, { fout: 'De eindtijd moet na de begintijd liggen.' });

		const { error } = await locals
			.supabase!.from('dienstsoorten')
			.update({ naam: tekst(f, 'naam'), begintijd, eindtijd, actief: aan(f, 'actief') })
			.eq('id', tekst(f, 'id'));
		if (error) return fail(400, { fout: vertaal(error, 'dienstsoort') });
		return { gedaan: 'opgeslagen' };
	},

	soortWeg: async ({ request, locals }) => {
		if (!(await alleenBeheerder(locals))) return fail(403, { fout: 'Alleen een beheerder.' });
		const f = await request.formData();
		const { error } = await locals.supabase!.from('dienstsoorten').delete().eq('id', tekst(f, 'id'));
		if (error) return fail(400, { fout: vertaal(error, 'dienstsoort') });
		return { gedaan: 'verwijderd' };
	},

	// ── Mensen ─────────────────────────────────────────────────────────
	persoonToevoegen: async ({ request, locals }) => {
		if (!(await alleenBeheerder(locals))) return fail(403, { fout: 'Alleen een beheerder.' });
		const f = await request.formData();
		const naam = tekst(f, 'naam');
		if (!naam) return fail(400, { fout: 'Geef een naam.' });

		const { error } = await locals
			.supabase!.from('personen')
			.insert({ naam, rol: tekst(f, 'rol') === 'beheerder' ? 'beheerder' : 'medewerker' });
		if (error) return fail(400, { fout: vertaal(error, 'persoon') });
		return {
			gedaan: 'toegevoegd',
			let_op: `${naam} staat nu in het rooster, maar kan nog niet inloggen. Daar hoort een account bij.`
		};
	},

	/**
	 * Een account aanmaken voor iemand die al in het rooster staat.
	 *
	 * Zonder login kan hij wel ingeroosterd worden maar zijn uren nooit melden,
	 * en omdat niemand namens hem invult komt hij dan ook nooit in de export.
	 * Hij werkt dan wel en wordt niet uitbetaald -- vandaar dat deze knop erbij
	 * hoort en niet later een keer.
	 *
	 * Geen uitnodigingsmail: die stranden op de gratis tier, en ze vragen dat
	 * iemand in zijn mail komt op het moment dat hij wil inloggen. Precies de
	 * stap waar dit project vanaf wilde. Het wachtwoord komt één keer in beeld,
	 * de baas geeft het door, de telefoon onthoudt het.
	 */
	loginAanmaken: async ({ request, locals }) => {
		if (!(await alleenBeheerder(locals))) return fail(403, { fout: 'Alleen een beheerder.' });

		const f = await request.formData();
		const id = tekst(f, 'id');
		const email = tekst(f, 'email').toLowerCase();
		if (!email.includes('@')) return fail(400, { fout: 'Geef een geldig e-mailadres.' });

		const admin = beheerClient();
		if (!admin) {
			return fail(503, {
				fout: 'De beheersleutel (SUPABASE_SECRET_KEY) staat niet in .env — zie .env.example. Zonder die sleutel kan de app geen accounts aanmaken.'
			});
		}

		const { data: persoon } = await locals
			.supabase!.from('personen')
			.select('naam, auth_user_id')
			.eq('id', id)
			.maybeSingle();
		if (!persoon) return fail(404, { fout: 'Die persoon bestaat niet.' });
		if (persoon.auth_user_id) return fail(409, { fout: `${persoon.naam} heeft al een login.` });

		const wachtwoord = verzinWachtwoord();
		const { data: nieuw, error } = await admin.auth.admin.createUser({
			email,
			password: wachtwoord,
			email_confirm: true
		});
		if (error || !nieuw?.user) {
			return fail(400, { fout: error?.message ?? 'Het account kon niet worden aangemaakt.' });
		}

		const { error: koppelen } = await locals
			.supabase!.from('personen')
			.update({ auth_user_id: nieuw.user.id })
			.eq('id', id);

		if (koppelen) {
			// Anders blijft er een account achter dat aan niemand hangt, en dat
			// blokkeert een volgende poging met hetzelfde adres.
			await admin.auth.admin.deleteUser(nieuw.user.id);
			return fail(400, { fout: vertaal(koppelen, 'persoon') });
		}

		return { login: { naam: persoon.naam, email, wachtwoord, opnieuw: false } };
	},

	/**
	 * Een nieuw wachtwoord voor wie al een login heeft.
	 *
	 * Zonder deze knop is één keer verkeerd verversen genoeg om iemand
	 * definitief buiten te sluiten: het wachtwoord staat maar één keer in beeld
	 * en Supabase bewaart alleen een versleutelde versie. Er is dan geen weg
	 * terug meer binnen de app.
	 */
	nieuwWachtwoord: async ({ request, locals }) => {
		if (!(await alleenBeheerder(locals))) return fail(403, { fout: 'Alleen een beheerder.' });

		const id = tekst(await request.formData(), 'id');
		const admin = beheerClient();
		if (!admin) {
			return fail(503, {
				fout: 'De beheersleutel (SUPABASE_SECRET_KEY) staat niet in .env — zie .env.example.'
			});
		}

		const { data: persoon } = await locals
			.supabase!.from('personen')
			.select('naam, auth_user_id')
			.eq('id', id)
			.maybeSingle();
		if (!persoon?.auth_user_id) return fail(404, { fout: 'Die persoon heeft nog geen login.' });

		const wachtwoord = verzinWachtwoord();
		const { data: bijgewerkt, error } = await admin.auth.admin.updateUserById(
			persoon.auth_user_id,
			{ password: wachtwoord }
		);
		if (error) return fail(400, { fout: error.message });

		return {
			login: {
				naam: persoon.naam,
				email: bijgewerkt?.user?.email ?? '',
				wachtwoord,
				opnieuw: true
			}
		};
	},

	/**
	 * Het e-mailadres van een login wijzigen.
	 *
	 * Het adres doet verder niets -- er gaat nooit post heen -- maar het is wel
	 * wat iemand elke keer intypt. Staat er een typefout in, dan zit hij daar
	 * anders voorgoed aan vast.
	 */
	adresWijzig: async ({ request, locals }) => {
		if (!(await alleenBeheerder(locals))) return fail(403, { fout: 'Alleen een beheerder.' });

		const f = await request.formData();
		const email = tekst(f, 'email').toLowerCase();
		if (!email.includes('@')) return fail(400, { fout: 'Geef een geldig e-mailadres.' });

		const admin = beheerClient();
		if (!admin) {
			return fail(503, {
				fout: 'De beheersleutel (SUPABASE_SECRET_KEY) staat niet in .env — zie .env.example.'
			});
		}

		const { data: persoon } = await locals
			.supabase!.from('personen')
			.select('naam, auth_user_id')
			.eq('id', tekst(f, 'id'))
			.maybeSingle();
		if (!persoon?.auth_user_id) return fail(404, { fout: 'Die persoon heeft nog geen login.' });

		// email_confirm, anders zet Supabase het adres pas om zodra iemand op een
		// bevestigingsmail klikt -- en die sturen we juist niet.
		const { error } = await admin.auth.admin.updateUserById(persoon.auth_user_id, {
			email,
			email_confirm: true
		});
		if (error) {
			return fail(400, {
				fout: error.message.includes('already been registered')
					? 'Dat adres is al van iemand anders.'
					: error.message
			});
		}

		return { gedaan: `${persoon.naam} logt nu in met ${email}.` };
	},

	persoonWijzig: async ({ request, locals }) => {
		const ik = await alleenBeheerder(locals);
		if (!ik) return fail(403, { fout: 'Alleen een beheerder.' });

		const f = await request.formData();
		const id = tekst(f, 'id');
		const rol = tekst(f, 'rol') === 'beheerder' ? 'beheerder' : 'medewerker';
		const actief = aan(f, 'actief');

		// Jezelf degraderen of op non-actief zetten kan het laatste zijn wat je
		// in deze app doet. Daar is geen weg terug uit zonder de SQL-editor.
		if (id === ik.id && (rol !== 'beheerder' || !actief)) {
			return fail(400, {
				fout: 'Je eigen rol of je eigen account kun je hier niet uitzetten — laat een van de andere beheerders dat doen.'
			});
		}

		const { error } = await locals
			.supabase!.from('personen')
			.update({ naam: tekst(f, 'naam'), rol, actief })
			.eq('id', id);
		if (error) return fail(400, { fout: vertaal(error, 'persoon') });
		return { gedaan: 'opgeslagen' };
	}
};
