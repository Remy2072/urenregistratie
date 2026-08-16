// Nepdata voor het prototype. Verdwijnt in fase 4.
//
// De id's zijn hier leesbaar ('p-remy'); in Supabase worden het uuid's. Het
// type is in beide gevallen string, dus de schermen merken daar niets van.
//
// De namen zijn verzonnen. Echte namen van collega's zijn persoonsgegevens
// en die horen niet in een prototype dat op je laptop en in git staat --
// zie fase 1 van het bouwplan.

import type { Datum, Dienst, Dienstsoort, Persoon, Post, Status, Tijd } from './model';
import { plusDagen } from './tijd';

// ── Het moment waarop we doen alsof we kijken ─────────────────────────
//
// Donderdagavond, kwart over tien. Bewust midden in de week gekozen: dan
// staat er van alles op één scherm -- bevestigde diensten, een melding die
// nog nagekeken moet worden, een dienst die iemand vergeten is, en een
// avond die net afgelopen is en dus gemeld moet worden.
//
// In fase 4 wordt dit vandaagInNederland().
export const NU = {
	datum: '2026-08-20' as Datum,
	tijd: '22:15' as Tijd
};

export const NU_TIJDSTIP = `${NU.datum}T${NU.tijd}:00+02:00`;

// ── Vaste gegevens ────────────────────────────────────────────────────

export const personen: Persoon[] = [
	{ id: 'p-baas', naam: 'Kwan', rol: 'beheerder', actief: true },
	{ id: 'p-remy', naam: 'Remy', rol: 'medewerker', actief: true },
	{ id: 'p-daan', naam: 'Daan', rol: 'medewerker', actief: true },
	{ id: 'p-samir', naam: 'Samir', rol: 'medewerker', actief: true },
	{ id: 'p-joost', naam: 'Joost', rol: 'medewerker', actief: true },
	{ id: 'p-ilias', naam: 'Ilias', rol: 'medewerker', actief: true },
	{ id: 'p-bram', naam: 'Bram', rol: 'medewerker', actief: true },
	{ id: 'p-teun', naam: 'Teun', rol: 'medewerker', actief: true },
	{ id: 'p-omar', naam: 'Omar', rol: 'medewerker', actief: true },
	{ id: 'p-lars', naam: 'Lars', rol: 'medewerker', actief: true }
];

export const posten: Post[] = [
	{ id: 'post-bus2', naam: 'Bus 2', volgorde: 1, actief: true },
	{ id: 'post-bus3', naam: 'Bus 3', volgorde: 2, actief: true },
	{ id: 'post-bus4', naam: 'Bus 4', volgorde: 3, actief: true }
];

export const dienstsoorten: Dienstsoort[] = [
	{ id: 'ds-vroeg', naam: 'vroeg', begintijd: '15:00', eindtijd: '20:00' },
	{ id: 'ds-laat', naam: 'laat', begintijd: '16:00', eindtijd: '21:00' }
];

export function persoon(id: string | null): Persoon | undefined {
	return personen.find((p) => p.id === id);
}

export function post(id: string): Post | undefined {
	return posten.find((p) => p.id === id);
}

export function naamVan(id: string | null): string {
	return persoon(id)?.naam ?? '—';
}

export function postNaam(id: string): string {
	return post(id)?.naam ?? '—';
}

// ── Het sjabloon ──────────────────────────────────────────────────────
//
// Dit is `sjabloon_regels`. Weekdag 1 = maandag, net als in het schema.
// Doordeweeks twee bussen, in het weekend drie.

type SjabloonRegel = {
	weekdag: number;
	post_id: string;
	persoon_id: string;
	dienstsoort_id: string;
};

export const sjabloon: SjabloonRegel[] = [
	{ weekdag: 1, post_id: 'post-bus2', persoon_id: 'p-remy', dienstsoort_id: 'ds-vroeg' },
	{ weekdag: 1, post_id: 'post-bus3', persoon_id: 'p-daan', dienstsoort_id: 'ds-laat' },

	{ weekdag: 2, post_id: 'post-bus2', persoon_id: 'p-samir', dienstsoort_id: 'ds-vroeg' },
	{ weekdag: 2, post_id: 'post-bus3', persoon_id: 'p-joost', dienstsoort_id: 'ds-laat' },

	{ weekdag: 3, post_id: 'post-bus2', persoon_id: 'p-ilias', dienstsoort_id: 'ds-vroeg' },
	{ weekdag: 3, post_id: 'post-bus3', persoon_id: 'p-bram', dienstsoort_id: 'ds-laat' },

	{ weekdag: 4, post_id: 'post-bus2', persoon_id: 'p-remy', dienstsoort_id: 'ds-vroeg' },
	{ weekdag: 4, post_id: 'post-bus3', persoon_id: 'p-teun', dienstsoort_id: 'ds-laat' },

	{ weekdag: 5, post_id: 'post-bus2', persoon_id: 'p-omar', dienstsoort_id: 'ds-vroeg' },
	{ weekdag: 5, post_id: 'post-bus3', persoon_id: 'p-lars', dienstsoort_id: 'ds-laat' },
	{ weekdag: 5, post_id: 'post-bus4', persoon_id: 'p-daan', dienstsoort_id: 'ds-laat' },

	{ weekdag: 6, post_id: 'post-bus2', persoon_id: 'p-remy', dienstsoort_id: 'ds-vroeg' },
	{ weekdag: 6, post_id: 'post-bus3', persoon_id: 'p-samir', dienstsoort_id: 'ds-laat' },
	{ weekdag: 6, post_id: 'post-bus4', persoon_id: 'p-joost', dienstsoort_id: 'ds-laat' },

	{ weekdag: 7, post_id: 'post-bus2', persoon_id: 'p-ilias', dienstsoort_id: 'ds-vroeg' },
	{ weekdag: 7, post_id: 'post-bus3', persoon_id: 'p-bram', dienstsoort_id: 'ds-laat' },
	{ weekdag: 7, post_id: 'post-bus4', persoon_id: 'p-teun', dienstsoort_id: 'ds-laat' }
];

// ── Uitrollen ─────────────────────────────────────────────────────────
//
// Dezelfde bewerking als de weekgeneratie van fase 3, maar dan in
// TypeScript in plaats van SQL. De geplande tijden gaan als kopie mee, niet
// als verwijzing naar de dienstsoort -- dat is de reden dat die kolommen zo
// in het schema staan.

function rolUit(maandag: Datum): Dienst[] {
	return sjabloon.map((regel) => {
		const soort = dienstsoorten.find((d) => d.id === regel.dienstsoort_id)!;
		const datum = plusDagen(maandag, regel.weekdag - 1);
		return {
			id: `d-${datum}-${regel.post_id}`,
			datum,
			post_id: regel.post_id,
			persoon_id: regel.persoon_id,
			gepland_begin: soort.begintijd,
			gepland_eind: soort.eindtijd,
			werkelijk_begin: null,
			werkelijk_eind: null,
			status: 'verwacht' as Status,
			gemeld_op: null,
			gemeld_door: null,
			bevestigd_op: null,
			bevestigd_door: null,
			opmerking: null,
			bron: 'sjabloon' as const
		};
	});
}

/** Melden en bevestigen in één keer -- voor weken die al afgerond zijn. */
function afgerond(d: Dienst, eind?: Tijd, opmerking?: string): Dienst {
	return {
		...d,
		werkelijk_begin: d.gepland_begin,
		werkelijk_eind: eind ?? d.gepland_eind,
		status: 'bevestigd',
		gemeld_op: `${d.datum}T${eind ?? d.gepland_eind}:00+02:00`,
		gemeld_door: d.persoon_id,
		bevestigd_op: `${plusDagen(d.datum, 1)}T11:00:00+02:00`,
		bevestigd_door: 'p-baas',
		opmerking: opmerking ?? null
	};
}

// ── Week 33: afgerond en bevestigd ────────────────────────────────────
// Deze week is af. Hij staat er zodat de export iets te laten zien heeft:
// dat is het scherm waar de waarde zit.

const MAANDAG_33: Datum = '2026-08-10';

const week33 = rolUit(MAANDAG_33).map((d) => {
	// Woensdag ziek gemeld: geen tijden, telt niet mee in de export.
	if (d.datum === '2026-08-12' && d.post_id === 'post-bus3') {
		return { ...d, status: 'afgemeld' as Status, opmerking: 'ziek' };
	}
	// Vrijdag een halfuur uitgelopen.
	if (d.datum === '2026-08-14' && d.post_id === 'post-bus3') {
		return afgerond(d, '21:30');
	}
	// Zondag een late rit buiten de wijk.
	if (d.datum === '2026-08-16' && d.post_id === 'post-bus2') {
		return afgerond(d, '20:30', 'laatste rit naar Ridderkerk');
	}
	return afgerond(d);
});

// ── Week 34: de lopende week ──────────────────────────────────────────
// Het is donderdagavond. Alles hierboven is geweest, alles hieronder moet
// nog komen. Elke situatie die de schermen moeten aankunnen zit hier één
// keer in.

export const MAANDAG_34: Datum = '2026-08-17';

const week34 = rolUit(MAANDAG_34).map((d): Dienst => {
	// Maandag Bus 2 -- die van jou -- staat er nog onaangeroerd bij. Vergeten.
	// Dit is precies het geval waar het bonnetje voor bestond: zonder app
	// krijg je deze avond niet uitbetaald, tenzij je terugrijdt of iemand
	// belt. In de app kun je hem donderdag nog gewoon invullen.
	if (d.datum === '2026-08-17' && d.post_id === 'post-bus2') return d;

	// Maandag Bus 3: een halfuur uitgelopen, gemeld en bevestigd.
	if (d.datum === '2026-08-17' && d.post_id === 'post-bus3') return afgerond(d, '21:30');

	// Dinsdag: allebei gemeld, maar de baas heeft er nog niet naar gekeken.
	if (d.datum === '2026-08-18') {
		return {
			...d,
			werkelijk_begin: d.gepland_begin,
			werkelijk_eind: d.gepland_eind,
			status: 'gemeld',
			gemeld_op: `${d.datum}T${d.gepland_eind}:00+02:00`,
			gemeld_door: d.persoon_id
		};
	}

	// Woensdag Bus 2: gewoon goed gegaan.
	if (d.datum === '2026-08-19' && d.post_id === 'post-bus2') return afgerond(d);

	// Woensdag Bus 3: pas donderdagavond alsnog ingevuld -- achteraf gemeld.
	if (d.datum === '2026-08-19' && d.post_id === 'post-bus3') {
		return {
			...d,
			werkelijk_begin: '16:00',
			werkelijk_eind: '21:00',
			status: 'gemeld',
			gemeld_op: '2026-08-20T18:12:00+02:00',
			gemeld_door: d.persoon_id
		};
	}

	// Donderdag Bus 3: een halfuur uitgelopen, net gemeld.
	if (d.datum === '2026-08-20' && d.post_id === 'post-bus3') {
		return {
			...d,
			werkelijk_begin: '16:00',
			werkelijk_eind: '21:30',
			status: 'gemeld',
			gemeld_op: '2026-08-20T21:34:00+02:00',
			gemeld_door: d.persoon_id
		};
	}

	// Vrijdag Bus 4: afgemeld, bus rijdt niet.
	if (d.datum === '2026-08-21' && d.post_id === 'post-bus4') {
		return { ...d, status: 'afgemeld', opmerking: 'geen chauffeur' };
	}

	// Donderdag Bus 2 is van jou en is zojuist afgelopen: die moet je melden.
	// De rest van de week moet nog komen en blijft 'verwacht'.
	return d;
});

export const alleDiensten: Dienst[] = [...week33, ...week34];
