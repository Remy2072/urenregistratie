import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Al ingelogd? Dan hoef je dit scherm niet te zien.
	if (!locals.supabase) return { ingesteld: false };
	const { user } = await locals.veiligeSessie();
	if (user) redirect(303, '/ik');
	return { ingesteld: true };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.supabase) {
			return fail(503, { email: '', fout: 'De database is nog niet ingesteld — zie .env.example.' });
		}

		const formulier = await request.formData();
		const email = String(formulier.get('email') ?? '').trim();
		const wachtwoord = String(formulier.get('wachtwoord') ?? '');

		if (!email || !wachtwoord) {
			return fail(400, { email, fout: 'Vul allebei de velden in.' });
		}

		const { error } = await locals.supabase.auth.signInWithPassword({
			email,
			password: wachtwoord
		});

		if (error) {
			// Bewust geen onderscheid tussen "onbekend adres" en "verkeerd
			// wachtwoord": dat verschil vertelt een vreemde welke adressen
			// bestaan, en dat zijn hier de adressen van je collega's.
			return fail(400, { email, fout: 'E-mailadres of wachtwoord klopt niet.' });
		}

		redirect(303, '/ik');
	}
};
