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

/**
 * Welke dag is het nu, hier?
 *
 * Dit is de enige functie in de app die de echte klok gebruikt, en daarom de
 * enige plek waar de tijdzone uitmaakt. 'en-CA' geeft toevallig precies
 * YYYY-MM-DD. In het prototype wordt hij niet gebruikt -- daar staat NU vast
 * in nepdata.ts -- maar hij hoort hier zodat er in fase 4 geen tweede plek
 * ontstaat.
 */
export function vandaagInNederland(): Datum {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());
}
