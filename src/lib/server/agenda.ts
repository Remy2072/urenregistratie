// Het ics-bestand in elkaar zetten. Eén functie, en verder niets.
//
// Waarom dit met de hand gaat en niet met een bibliotheek: het formaat is
// nauwelijks meer dan tekst met vaste regels, en de twee dingen die er echt
// misgaan -- de tijdzone en het UID -- zou een bibliotheek ook niet voor je
// oplossen. Wat je wél overhoudt is dat je kunt zien wat er verstuurd wordt.
//
// De regels van RFC 5545 die hier uitmaken:
//   * regeleindes zijn CRLF, niet LF. Sommige agenda's weigeren het anders.
//   * elke gebeurtenis heeft een UID dat vast ligt, anders komt dezelfde
//     avond bij elke verversing opnieuw in de agenda te staan.
//   * komma's, puntkomma's en backslashes in tekst moeten ontsnapt worden.

import type { Datum, Tijd } from '$lib/model';

export type AgendaDienst = {
	dienst_id: string;
	datum: Datum;
	gepland_begin: Tijd;
	gepland_eind: Tijd;
	post: string;
	laatst_gewijzigd: string;
	versie: number;
};

/**
 * De tijdzone, uitgeschreven.
 *
 * Dit blok is de reden dat er nergens in deze app zomertijd gerekend wordt: we
 * zeggen tegen de agenda "deze tijd is Amsterdamse tijd" en geven de regels mee
 * waarmee hij dat zelf omzet. Reken je het zelf naar UTC om, dan staat één
 * weekend per jaar de hele ploeg een uur verkeerd in zijn agenda.
 *
 * De regels zelf zijn Europees en veranderen alleen als de EU de zomertijd
 * afschaft: laatste zondag van maart erin, laatste zondag van oktober eruit.
 */
const TIJDZONE = [
	'BEGIN:VTIMEZONE',
	'TZID:Europe/Amsterdam',
	'X-LIC-LOCATION:Europe/Amsterdam',
	'BEGIN:DAYLIGHT',
	'TZOFFSETFROM:+0100',
	'TZOFFSETTO:+0200',
	'TZNAME:CEST',
	'DTSTART:19700329T020000',
	'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
	'END:DAYLIGHT',
	'BEGIN:STANDARD',
	'TZOFFSETFROM:+0200',
	'TZOFFSETTO:+0100',
	'TZNAME:CET',
	'DTSTART:19701025T030000',
	'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
	'END:STANDARD',
	'END:VTIMEZONE'
];

/** Komma, puntkomma en backslash hebben betekenis in dit formaat. */
function ontsnap(tekst: string): string {
	return tekst.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** '2026-08-22' + '16:00' -> '20260822T160000' */
function stempel(datum: Datum, tijd: Tijd): string {
	return `${datum.replace(/-/g, '')}T${tijd.replace(':', '')}00`;
}

/** Een tijdstip in UTC, zoals DTSTAMP en LAST-MODIFIED het willen. */
function utcStempel(iso: string): string {
	return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Het hele bestand.
 *
 * `nu` komt van buiten mee zodat deze functie zelf niet naar de klok kijkt --
 * dan is hij te testen, en dan staat er precies één plek in deze app waar de
 * echte tijd vandaan komt (zie tijd.ts).
 */
export function maakAgenda(diensten: AgendaDienst[], nu: Date): string {
	const regels = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Urenregistratie//Diensten//NL',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'X-WR-CALNAME:Werk',
		'X-WR-TIMEZONE:Europe/Amsterdam',
		// Een verzoek en geen regel: agenda's bepalen zelf hoe vaak ze kijken.
		// Google doet er soms een dag over. Daarom blijft de app de plek waar het
		// rooster écht staat.
		'REFRESH-INTERVAL;VALUE=DURATION:PT30M',
		'X-PUBLISHED-TTL:PT30M',
		...TIJDZONE
	];

	for (const d of diensten) {
		regels.push(
			'BEGIN:VEVENT',
			// Het id van de dienst, en dus vast. Ruilt de dienst van persoon, dan
			// verdwijnt hij uit de ene agenda en verschijnt hij in de andere -- met
			// hetzelfde UID, wat precies goed is: het is dezelfde avond.
			`UID:${d.dienst_id}@urenregistratie`,
			`DTSTAMP:${utcStempel(nu.toISOString())}`,
			`LAST-MODIFIED:${utcStempel(d.laatst_gewijzigd)}`,
			// Sommige agenda's werken een gebeurtenis alleen bij als dit getal
			// omhoog gaat. Het is het aantal wijzigingen uit `mutaties`.
			`SEQUENCE:${d.versie}`,
			`DTSTART;TZID=Europe/Amsterdam:${stempel(d.datum, d.gepland_begin)}`,
			`DTEND;TZID=Europe/Amsterdam:${stempel(d.datum, d.gepland_eind)}`,
			`SUMMARY:Werk — ${ontsnap(d.post)}`,
			`LOCATION:${ontsnap(d.post)}`,
			'TRANSP:OPAQUE',
			'END:VEVENT'
		);
	}

	regels.push('END:VCALENDAR');

	// CRLF, en een lege regel aan het eind. Beide staan in de RFC en beide zijn
	// een keer de reden dat een agenda "ongeldig bestand" zei.
	return regels.join('\r\n') + '\r\n';
}
