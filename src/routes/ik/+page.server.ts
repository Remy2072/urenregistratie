import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/**
 * Dit scherm bewijst dat de rechten werken. Alle tellingen hieronder gaan
 * door row level security heen: wat je hier ziet is precies wat de database
 * jou toestaat, niet wat de code besloten heeft te tonen.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.supabase) redirect(303, '/inloggen');
	const { user } = await locals.veiligeSessie();
	if (!user) redirect(303, '/inloggen');
	const supabase = locals.supabase;

	const { data: persoon } = await supabase
		.from('personen')
		.select('naam, rol')
		.eq('auth_user_id', user.id)
		.maybeSingle();

	async function tel(tabel: string) {
		const { count } = await supabase.from(tabel).select('*', { count: 'exact', head: true });
		return count ?? 0;
	}

	return {
		email: user.email ?? '',
		persoon,
		zichtbaar: {
			personen: await tel('personen'),
			diensten: await tel('diensten'),
			sjabloon: await tel('sjabloon_regels'),
			posten: await tel('posten')
		}
	};
};

export const actions: Actions = {
	uitloggen: async ({ locals }) => {
		await locals.supabase?.auth.signOut();
		redirect(303, '/inloggen');
	}
};
