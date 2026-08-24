// De vorm van de gegevens, één op één met schema.sql.
//
// snake_case en niet camelCase: zo komt het uit Supabase, en dan hoeft er
// onderweg niets omgezet te worden.
//
// Dit bestand was het scharnier van fase 0. De nepdata had precies deze vorm,
// en daardoor hoefde er in fase 4 alleen een bron te veranderen -- de schermen
// bleven staan. Dat is precies zo gelopen.

/** 'YYYY-MM-DD', zoals `date` in Postgres. Geen tijdzone, geen Date-object. */
export type Datum = string;

/** 'HH:MM', zoals `time`. Altijd op :00 of :30 -- zie is_half_uur(). */
export type Tijd = string;

/** ISO-tijdstempel, zoals `timestamptz`. */
export type Tijdstip = string;

/**
 * Een rangorde, geen lijstje. De eigenaar staat boven de manager: die kan
 * alles behalve de export, en kan geen eigenaar aanraken.
 *
 * En daarboven staat de superadmin, voor de bouwer. Die staat hier omdat het
 * type moet kloppen -- niet omdat de app hem ergens aanbiedt. Hij ontstaat
 * alleen in de sql-editor en is voor iedereen behalve zichzelf onzichtbaar; zie
 * `superadmin.sql`.
 */
export type Rol = 'medewerker' | 'manager' | 'eigenaar' | 'superadmin';

/**
 * De vragen die de app over een rol stelt, op één plek.
 *
 * Ze staan hier en niet in `server/wie.ts`, omdat de layout ze ook in de
 * browser nodig heeft. En ze staan naast elkaar zodat je bij een nieuwe rol
 * één keer hoeft na te denken in plaats van vier keer te zoeken.
 *
 * Elk heeft een tegenhanger in de database -- is_beheerder(), is_eigenaar(),
 * is_superadmin() en de check in ruilkandidaten(). Deze kant is opruiming; die
 * kant is de beveiliging.
 */
export const magBeherenRol = (rol: Rol | undefined) =>
	rol === 'manager' || rol === 'eigenaar' || rol === 'superadmin';

/** De boekhouding is van de eigenaar, en van wie boven hem staat. */
export const isEigenaarRol = (rol: Rol | undefined) =>
	rol === 'eigenaar' || rol === 'superadmin';

/**
 * Wie er ingeroosterd wordt.
 *
 * Een eigenaar niet: hij bevestigt en exporteert, en dat verhoudt zich slecht
 * tot zijn eigen uren goedkeuren. Een superadmin niet: die bestaat officieel
 * niet en hoort in geen enkel rooster.
 *
 * Onbekend is ook nee. Dat is niet netjesheid maar een gat dat er echt zat: een
 * rol die je niet mag lezen komt hier als `undefined` aan, en `!== 'eigenaar'`
 * zei daar vrolijk ja tegen.
 */
export const wordtIngeroosterd = (rol: Rol | string | undefined) =>
	rol === 'medewerker' || rol === 'manager';

/**
 * De onzichtbare rol.
 *
 * Hier hangen geen rechten aan -- die lopen via de twee hierboven, precies
 * zoals in de database. Deze is er alleen om het op /ik één keer te kunnen
 * zeggen, want een rol waarvan nergens iets te zien is, is ook niet na te
 * kijken.
 */
export const isSuperadminRol = (rol: Rol | string | undefined) => rol === 'superadmin';

export type Status =
	| 'verwacht' // uitgerold uit het sjabloon
	| 'gemeld' // medewerker heeft ingevuld
	| 'bevestigd' // beheerder akkoord -> telt mee in de export
	| 'afgemeld' // niet gewerkt
	| 'vervallen'; // dienst ging niet door

export type Bron = 'sjabloon' | 'handmatig';

export type Persoon = {
	id: string;
	naam: string;
	rol: Rol;
	actief: boolean;

	/** Waarmee hij inlogt. Null zolang hij geen login heeft. */
	gebruikersnaam: string | null;

	/** Altijd als +316…; zie telefoon.ts. Null als het nummer niet bekend is. */
	telefoon: string | null;
};

export type Post = {
	id: string;
	naam: string;
	volgorde: number;
	actief: boolean;
};

export type Dienstsoort = {
	id: string;
	naam: string;
	begintijd: Tijd;
	eindtijd: Tijd;
};

export type Dienst = {
	id: string;
	datum: Datum;
	post_id: string;
	persoon_id: string | null;

	/** Kopie uit de dienstsoort, geen verwijzing: een dienst is een momentopname. */
	gepland_begin: Tijd;
	gepland_eind: Tijd;

	/** Wat uitbetaald wordt. Bij 'gedraaid zoals gepland' een kopie van gepland. */
	werkelijk_begin: Tijd | null;
	werkelijk_eind: Tijd | null;

	status: Status;

	gemeld_op: Tijdstip | null;
	gemeld_door: string | null;
	bevestigd_op: Tijdstip | null;
	bevestigd_door: string | null;

	opmerking: string | null;
	bron: Bron;
};

/** Eén regel van de export, gelijk aan de view `uren_export`. */
export type ExportRegel = {
	medewerker: string;
	datum: Datum;
	post: string;
	begin: Tijd;
	einde: Tijd;
	uren: number;
	afwijkend: boolean;
	opmerking: string | null;
};
