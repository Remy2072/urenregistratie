import { isEigenaarRol, magBeherenRol, type Rol } from '$lib/model';

export type Ik = {
	id: string;
	naam: string;
	rol: Rol;
	actief: boolean;
	/** Waarmee je inlogt. Alleen jij ziet hem, en de baas in het beheerscherm. */
	gebruikersnaam: string | null;
	/** Het enige veld dat je van jezelf mag wijzigen. Zie profiel.sql. */
	telefoon: string | null;
};

/** Mag deze persoon beheren? Manager, eigenaar en superadmin. */
export const magBeheren = (ik: Ik | null) => magBeherenRol(ik?.rol);

/** De boekhouding is van de eigenaar. Zie de uitleg in rollen.sql. */
export const isEigenaar = (ik: Ik | null) => isEigenaarRol(ik?.rol);

/**
 * Wie ben ik volgens `personen`?
 *
 * Het opzoeken zelf gebeurt in `hooks.server.ts` en wordt per verzoek
 * onthouden -- anders vraagt één pagina het drie keer op: de deurcontrole, de
 * layout en het scherm zelf.
 *
 * Null als de login nog niet aan een persoon hangt. Dan laat de database je
 * nergens bij en zegt het scherm er iets over; zonder die uitleg zie je een
 * leeg scherm zonder reden.
 */
export async function wieBenIk(locals: App.Locals): Promise<Ik | null> {
	return locals.ik();
}
