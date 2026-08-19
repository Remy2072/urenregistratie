// Telefoonnummers, en de enige plek waar er iets over hun vorm wordt besloten.
//
// Reden om dit apart te zetten: hetzelfde nummer kan er op zeven manieren in
// komen -- 06-12345678, 06 12345678, 0612345678, +31 6 12345678 -- en zolang
// dat zo is kun je wel zien dát iemand een nummer heeft, maar niet of het
// hetzelfde nummer is. Er gaat straks een sms heen, en dan moet er één vorm in
// de database staan.
//
// De vorm die eruit komt is E.164: een plus, een landnummer, en verder alleen
// cijfers. Dat is wat elke sms-partij verwacht.

/**
 * Waar een nummer zonder landnummer vandaan komt.
 *
 * Nederland, want dit is een Nederlands bedrijf. Bij een bedrijf over de grens
 * is dit één regel -- die hoort dan in het instellingenbestand van fase 8,
 * samen met de bedrijfsnaam en de vroegste begintijd.
 */
const LANDNUMMER = '+31';

/**
 * Hoe een Nederlands nummer eruitziet: het landnummer en dan negen cijfers.
 *
 * Negen en niet acht of tien -- 0612345678 en 0101234567 zijn allebei tien
 * cijfers mét de nul vooraan, en die nul valt weg tegen het landnummer. Elk
 * Nederlands nummer is zo lang; er is geen uitzondering.
 */
const NEDERLANDS = /^\+31[1-9][0-9]{8}$/;

/**
 * En een buitenlands nummer: we weten niet hoe lang dat hoort te zijn, dus
 * hier alleen de grenzen van E.164 zelf. Iemand met een Belgisch nummer moet
 * gewoon kunnen worden gebeld.
 */
const BUITENLANDS = /^\+[1-9][0-9]{7,14}$/;

/** Klopt de vorm? Voor +31 streng, daarbuiten zo streng als we kunnen zijn. */
function klopt(nummer: string): boolean {
	return nummer.startsWith(LANDNUMMER) ? NEDERLANDS.test(nummer) : BUITENLANDS.test(nummer);
}

/**
 * Wat iemand intypt, omgezet naar één vorm. Null als het geen nummer kan zijn.
 *
 * Bewust streng: liever een nette foutmelding bij het opslaan dan een nummer
 * waar later een sms op stukloopt. Een cijfer te veel of te weinig is precies de
 * fout die je anders pas merkt als er iemand niet gebeld wordt. De check in de
 * database (`personen_telefoon_vorm`) is hetzelfde slot nog een keer.
 */
export function alsTelefoon(ingevoerd: string): string | null {
	// Alles eruit wat mensen ertussen zetten: spaties, streepjes, punten,
	// haakjes. Wat overblijft is een plus en cijfers.
	const kaal = ingevoerd.replace(/[\s.\-()]/g, '');
	if (kaal === '') return null;

	// 0031… en +31… zijn hetzelfde nummer, anders opgeschreven.
	const metPlus = kaal.startsWith('00') ? `+${kaal.slice(2)}` : kaal;

	if (metPlus.startsWith('+')) {
		return klopt(metPlus) ? metPlus : null;
	}

	// Een nummer dat met 0 begint is een binnenlands nummer: de 0 eraf en het
	// landnummer ervoor. 0612345678 -> +31612345678
	if (metPlus.startsWith('0')) {
		const zonderNul = `${LANDNUMMER}${metPlus.slice(1)}`;
		return klopt(zonderNul) ? zonderNul : null;
	}

	// Geen plus en geen nul. Dan weet je niet welk land het is, en gokken is
	// hier precies verkeerd: dat levert een nummer op dat bestaat en van iemand
	// anders is.
	return null;
}

/**
 * '+31612345678' -> '06 12345678'. Alleen om te laten zien.
 *
 * In de database staat de internationale vorm; op het scherm staat wat iemand
 * zelf zou opschrijven. Een nummer uit een ander land laten we staan zoals het
 * is -- daar kennen we de schrijfwijze niet van.
 */
export function telefoonTekst(nummer: string | null): string {
	if (!nummer) return '';
	if (!nummer.startsWith(LANDNUMMER)) return nummer;
	const binnenlands = `0${nummer.slice(LANDNUMMER.length)}`;

	// 06 en dan acht cijfers -- zo schrijft iedereen zijn mobiele nummer op.
	if (binnenlands.startsWith('06')) return `06 ${binnenlands.slice(2)}`;

	// Een vast nummer: netnummer van drie en dan de rest. Netnummers zijn twee
	// tot vier cijfers lang en dat is uit het nummer zelf niet te zien, dus dit
	// is een leesbare gok en geen regel.
	return binnenlands.length === 10
		? `${binnenlands.slice(0, 3)} ${binnenlands.slice(3)}`
		: binnenlands;
}
