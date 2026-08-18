// Alles wat met datums en tijden te maken heeft staat hier, en nergens anders.
//
// Reden: er is precies één plek waar dit misgaat, en dat is de vraag "welke
// dag is het nu". Draait de server in UTC, dan is het daar zondag 23:00
// terwijl het hier al maandag is. Zolang die vraag alleen hier beantwoord
// wordt, is dat één regel om goed te zetten in plaats van tien.

import type { Datum, Dienst, Tijd } from './model';

// ── Tijden ────────────────────────────────────────────────────────────

/** '16:30' -> 990 */
export function minuten(t: Tijd): number {
	const [u, m] = t.split(':').map(Number);
	return u * 60 + m;
}

/** 990 -> '16:30' */
export function naarTijd(min: number): Tijd {
	const u = Math.floor(min / 60);
	const m = min % 60;
	return `${String(u).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Verschuif een tijd met een aantal minuten. Dit is wat de -30/+30/+60 knoppen doen. */
export function verschuif(t: Tijd, delta: number): Tijd {
	return naarTijd(minuten(t) + delta);
}

export function duurInUren(begin: Tijd, eind: Tijd): number {
	return (minuten(eind) - minuten(begin)) / 60;
}

/** '5' of '5,5' -- Nederlandse komma, want dit gaat naar de boekhouder. */
export function urenTekst(uren: number): string {
	return uren.toFixed(1).replace('.0', '').replace('.', ',');
}

// ── Afwijkingen ───────────────────────────────────────────────────────

export function afwijkend(d: Dienst): boolean {
	if (d.werkelijk_begin === null || d.werkelijk_eind === null) return false;
	return d.werkelijk_begin !== d.gepland_begin || d.werkelijk_eind !== d.gepland_eind;
}

/** Verschil in minuten tussen gedraaid en gepland. Positief = langer doorgewerkt. */
export function afwijkingInMinuten(d: Dienst): number {
	if (d.werkelijk_begin === null || d.werkelijk_eind === null) return 0;
	const gepland = minuten(d.gepland_eind) - minuten(d.gepland_begin);
	const werkelijk = minuten(d.werkelijk_eind) - minuten(d.werkelijk_begin);
	return werkelijk - gepland;
}

/** '+30 min' / '-30 min' */
export function afwijkingTekst(minutenVerschil: number): string {
	const teken = minutenVerschil > 0 ? '+' : '−';
	return `${teken}${Math.abs(minutenVerschil)} min`;
}

/**
 * Achteraf gemeld: ingevuld op een latere dag dan de dienst zelf.
 * Geen kolom in de database -- dit is precies `gemeld_op::date > datum`.
 */
export function achterafGemeld(d: Dienst): boolean {
	if (d.gemeld_op === null) return false;
	return d.gemeld_op.slice(0, 10) > d.datum;
}

// ── Datums ────────────────────────────────────────────────────────────
//
// Datums zijn strings, geen Date-objecten. Rekenen doen we in UTC en
// formatteren op 12:00 UTC, zodat er nooit een dag verschuift. Een `date`
// in Postgres heeft immers ook geen tijdzone.

export function plusDagen(datum: Datum, aantal: number): Datum {
	const d = new Date(`${datum}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + aantal);
	return d.toISOString().slice(0, 10);
}

/** De zeven datums van een week, gegeven de maandag. */
export function weekDatums(maandag: Datum): Datum[] {
	return Array.from({ length: 7 }, (_, i) => plusDagen(maandag, i));
}

function alsDate(datum: Datum): Date {
	return new Date(`${datum}T12:00:00Z`);
}

/** 'donderdag' */
export function dagNaam(datum: Datum): string {
	return alsDate(datum).toLocaleDateString('nl-NL', { weekday: 'long', timeZone: 'UTC' });
}

/** 'do' */
export function dagKort(datum: Datum): string {
	return alsDate(datum).toLocaleDateString('nl-NL', { weekday: 'short', timeZone: 'UTC' });
}

/** '20 augustus' */
export function datumLang(datum: Datum): string {
	return alsDate(datum).toLocaleDateString('nl-NL', {
		day: 'numeric',
		month: 'long',
		timeZone: 'UTC'
	});
}

/** '20 aug' */
export function datumKort(datum: Datum): string {
	return alsDate(datum).toLocaleDateString('nl-NL', {
		day: 'numeric',
		month: 'short',
		timeZone: 'UTC'
	});
}

/** ISO-weeknummer. Week 1 is de week met de eerste donderdag van het jaar. */
export function isoWeek(datum: Datum): number {
	const d = new Date(`${datum}T00:00:00Z`);
	// Naar de donderdag van deze week: dan bepaalt het jaartal zichzelf.
	d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
	const eersteJanuari = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	return Math.ceil(((d.getTime() - eersteJanuari.getTime()) / 86400000 + 1) / 7);
}

/** De maandag van de week waar deze datum in valt. */
export function maandagVan(datum: Datum): Datum {
	const d = new Date(`${datum}T00:00:00Z`);
	return plusDagen(datum, 1 - (d.getUTCDay() || 7));
}

/** 'maandag' bij 1, 'zondag' bij 7 -- zonder dat je een datum nodig hebt. */
export function weekdagNaam(weekdag: number): string {
	// 5 januari 2026 was een maandag. Elke maandag voldoet; deze staat vast
	// zodat de uitkomst niet van vandaag afhangt.
	return dagNaam(plusDagen('2026-01-05', weekdag - 1));
}

/** De eerste van de maand waar deze datum in valt. */
export function eersteVanDeMaand(datum: Datum): Datum {
	return `${datum.slice(0, 7)}-01`;
}

/** De laatste van die maand. Dag 0 van de volgende maand is de laatste van deze. */
export function laatsteVanDeMaand(datum: Datum): Datum {
	const d = new Date(`${datum.slice(0, 7)}-01T00:00:00Z`);
	d.setUTCMonth(d.getUTCMonth() + 1);
	d.setUTCDate(0);
	return d.toISOString().slice(0, 10);
}

/** Een datum die in de maand ervoor valt. */
export function maandTerug(datum: Datum): Datum {
	const d = new Date(`${datum.slice(0, 7)}-01T00:00:00Z`);
	d.setUTCDate(0);
	return d.toISOString().slice(0, 10);
}

/** 'augustus 2026' */
export function maandNaam(datum: Datum): string {
	return new Date(`${datum.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString('nl-NL', {
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

/** '17-08-2026' -- zoals een Nederlandse boekhouder een datum leest. */
export function datumNL(datum: Datum): string {
	const [j, m, d] = datum.split('-');
	return `${d}-${m}-${j}`;
}

/**
 * Hoe laat is het nu, hier?
 *
 * Dit is de enige functie in de app die de echte klok gebruikt, en daarom de
 * enige plek waar de tijdzone uitmaakt. 'en-CA' geeft toevallig precies
 * YYYY-MM-DD; 'en-GB' geeft 00:00 om middernacht waar 'nl-NL' er in sommige
 * browsers 24:00 van maakt.
 *
 * Roep hem aan op de server, in een load-functie, en geef de uitkomst door aan
 * het scherm. Doe je het in een component, dan rekent de browser mee met de
 * tijdzone van de telefoon -- en dan ziet iemand op vakantie een andere week
 * dan zijn collega hier.
 */
export function nuInNederland(): { datum: Datum; tijd: Tijd } {
	const nu = new Date();
	return {
		datum: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(nu),
		tijd: new Intl.DateTimeFormat('en-GB', {
			timeZone: 'Europe/Amsterdam',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		}).format(nu)
	};
}

export function vandaagInNederland(): Datum {
	return nuInNederland().datum;
}

/**
 * Postgres geeft een `time` terug als '16:00:00'; overal in deze app is een
 * tijd 'HH:MM'. Snij dat af zodra het binnenkomt, want de rest van de app
 * vergelijkt tijden als tekst -- afwijkend() kijkt of werkelijk_begin gelijk
 * is aan gepland_begin, en '16:00' is niet gelijk aan '16:00:00'.
 */
export function korteTijd(t: Tijd | null): Tijd | null {
	return t === null ? null : t.slice(0, 5);
}

/** Alle vier de tijden van een dienst ingekort. Zie korteTijd(). */
export function korteTijden<T extends Dienst>(d: T): T {
	return {
		...d,
		gepland_begin: korteTijd(d.gepland_begin),
		gepland_eind: korteTijd(d.gepland_eind),
		werkelijk_begin: korteTijd(d.werkelijk_begin),
		werkelijk_eind: korteTijd(d.werkelijk_eind)
	} as T;
}

/**
 * Dezelfde regel als is_half_uur() in schema.sql. De database is en blijft de
 * baas -- dit is er alleen zodat de app een nette zin kan zeggen in plaats van
 * een constraint-fout door te geven.
 */
export function isHalfUur(t: Tijd): boolean {
	return /^([01]\d|2[0-3]):(00|30)$/.test(t);
}
