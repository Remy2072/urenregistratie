import { redirect } from '@sveltejs/kit';
import type { Rol } from '$lib/model';

export type Ik = { id: string; naam: string; rol: Rol };

/** Mag deze persoon beheren? Manager en eigenaar allebei. */
export const magBeheren = (ik: Ik | null) => ik?.rol === 'manager' || ik?.rol === 'eigenaar';

/** De boekhouding is van de eigenaar. Zie de uitleg in rollen.sql. */
export const isEigenaar = (ik: Ik | null) => ik?.rol === 'eigenaar';

/**
 * Wie ben ik volgens `personen`?
 *
 * Auth weet alleen wélke login je bent; `auth_user_id` legt de verbinding met
 * een persoon in het rooster. Is die verbinding er nog niet, dan is dit null en
 * zegt het scherm er iets over -- de database laat je dan namelijk nergens bij
 * en dat zie je anders als een leeg scherm zonder uitleg.
 *
 * De rol staat hier en niet in Supabase Auth. Dat is met opzet: rollen zijn iets
 * van dit rooster, niet van het inlogsysteem.
 */
export async function wieBenIk(locals: App.Locals): Promise<Ik | null> {
	const { user } = await locals.veiligeSessie();
	if (!locals.supabase || !user) redirect(303, '/inloggen');

	const { data } = await locals.supabase
		.from('personen')
		.select('id, naam, rol')
		.eq('auth_user_id', user.id)
		.maybeSingle();

	return (data as Ik | null) ?? null;
}
