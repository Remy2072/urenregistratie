// De vorm van de gegevens, één op één met schema.sql.
//
// Dit bestand is het scharnier van fase 0. Zolang de nepdata precies deze
// vorm heeft, vervang je in fase 4 alleen de bron -- de schermen blijven
// staan. Daarom snake_case en niet camelCase: zo komt het straks uit
// Supabase en hoeft er onderweg niets omgezet te worden.

/** 'YYYY-MM-DD', zoals `date` in Postgres. Geen tijdzone, geen Date-object. */
export type Datum = string;

/** 'HH:MM', zoals `time`. Altijd op :00 of :30 -- zie is_half_uur(). */
export type Tijd = string;

/** ISO-tijdstempel, zoals `timestamptz`. */
export type Tijdstip = string;

export type Rol = 'medewerker' | 'beheerder';

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
