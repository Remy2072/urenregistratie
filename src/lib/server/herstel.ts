// Wachtwoord vergeten: wie je bent, de code, de limieten en het narekenen.
//
// De echte regels staan in de database (`docs/herstel.sql`): hoe lang een code
// geldig is, hoeveel pogingen je hebt, hoeveel aanvragen per dag. Hier staat wat
// daar niet kan: een code verzinnen, en de vraag wie er te vaak namen aan het
// intikken is.
//
// Alles hier gaat via de beheersleutel. Dat moet ook: er is op dit moment geen
// sessie -- de bezorger staat buiten -- en zonder sessie geven de policies niets.
// Daarom is dit een `.server.`-bestand en staat er geen enkele functie in die
// een scherm rechtstreeks mag aanroepen zonder eerst zelf te controleren.

import { alsTelefoon } from '$lib/telefoon';
import { beheerClient } from './beheersleutel';
import { isGebruikersnaam } from './login';

/**
 * Wat iemand intikt, omgezet naar het kenmerk dat de database begrijpt.
 *
 * Twee dingen mogen: een gebruikersnaam en een telefoonnummer. Dat tweede kwam
 * er in fase 16 bij, omdat wie zijn wachtwoord vergeet ook zijn gebruikersnaam
 * vergeet -- en zijn telefoon in zijn hand heeft.
 *
 * Een nummer wordt hier meteen E.164 (`+31612345678`), en dat is niet alleen
 * netheid: `herstel_wie()` in de database ziet aan die plus dat het geen
 * gebruikersnaam is. 06-12345678, 06 12345678 en +31 6 12345678 komen dus alle
 * drie bij dezelfde persoon uit.
 *
 * Null betekent: dit kan geen van beide zijn. Het scherm laat dat niet zien --
 * het gaat door naar hetzelfde codescherm als al het andere -- maar er hoeft
 * dan niets opgezocht te worden.
 */
export function alsWie(ingevoerd: string): string | null {
	const kaal = ingevoerd.trim();
	if (!kaal) return null;

	// Eerst het nummer proberen: dat is de strengere van de twee, en een
	// gebruikersnaam kan nooit met een plus beginnen of uit tien cijfers
	// bestaan die als nummer kloppen.
	const nummer = alsTelefoon(kaal);
	if (nummer) return nummer;

	const naam = kaal.toLowerCase();
	return isGebruikersnaam(naam) ? naam : null;
}

/**
 * Zes cijfers, en niet meer.
 *
 * Kort genoeg om over te typen van een telefoon die je in je andere hand hebt.
 * Dat het te raden is, wordt niet opgelost door meer cijfers maar door de drie
 * pogingen in de database -- zie herstel_code_controleren().
 */
export function verzinCode(): string {
	// Verwerp de laatste, onvolledige reeks; anders komen lage cijfers iets vaker
	// voor dan hoge. Dat maakt hier weinig uit, maar het is één regel.
	const grens = Math.floor(0xffffffff / 1_000_000) * 1_000_000;
	let n = grens;
	while (n >= grens) n = crypto.getRandomValues(new Uint32Array(1))[0];
	return String(n % 1_000_000).padStart(6, '0');
}

/** Het tweede geheim: de sleutel voor het wachtwoordscherm. */
export function verzinSleutel(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(24));
	return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hoe vaak iemand hier iets mag intikken.
 *
 * Niet meer tegen het aflopen van namen -- elke uitkomst geeft hetzelfde scherm,
 * dus er valt niets af te lezen. Dit is er tegen de rekening: elke poging kan
 * een sms zijn. En sinds je ook een telefoonnummer mag invullen (fase 16) zou je
 * zonder rem kunnen aftasten welke nummers er in de ploeg zitten.
 *
 * Dit is een teller in het geheugen van deze server, en dat is met opzet zo
 * simpel: het is een rem, geen slot. Draait de app straks op meerdere
 * instanties, dan telt elke instantie zijn eigen pogingen -- en het échte slot
 * (drie sms'jes per persoon per dag) staat in de database.
 */
const pogingen = new Map<string, { tot: number; aantal: number }>();
const VENSTER = 15 * 60 * 1000;
const MAX_PER_VENSTER = 10;

export function teVeelGeprobeerd(bezoeker: string): boolean {
	const nu = Date.now();
	const staat = pogingen.get(bezoeker);

	if (!staat || staat.tot < nu) {
		pogingen.set(bezoeker, { tot: nu + VENSTER, aantal: 1 });
		// Meteen opruimen wat verlopen is, zodat deze map niet eeuwig groeit.
		if (pogingen.size > 500) {
			for (const [sleutel, waarde] of pogingen) if (waarde.tot < nu) pogingen.delete(sleutel);
		}
		return false;
	}

	staat.aantal += 1;
	return staat.aantal > MAX_PER_VENSTER;
}

// ── De drie stappen, elk één aanroep naar de database ──────────────────

export type Aanvraag =
	| { uitkomst: 'geen_sleutel' }
	| { uitkomst: 'onbekend' }
	| { uitkomst: 'geen_nummer' }
	| { uitkomst: 'te_vaak' }
	| { uitkomst: 'verstuur'; naam: string; telefoon: string; code: string };

/** Stap 1: is er iets te herstellen, en zo ja, naar welk nummer? */
export async function vraagCodeAan(wie: string): Promise<Aanvraag> {
	const admin = beheerClient();
	if (!admin) return { uitkomst: 'geen_sleutel' };

	const code = verzinCode();
	const { data, error } = await admin
		.rpc('herstel_aanvragen', { p_wie: wie, p_code: code })
		.maybeSingle();

	if (error || !data) {
		console.error('herstel_aanvragen mislukte:', error?.message ?? 'geen antwoord');
		return { uitkomst: 'geen_sleutel' };
	}

	const rij = data as { uitkomst: string; naam: string | null; telefoon: string | null };
	if (rij.uitkomst === 'verstuur' && rij.telefoon) {
		return { uitkomst: 'verstuur', naam: rij.naam ?? '', telefoon: rij.telefoon, code };
	}
	return { uitkomst: rij.uitkomst as 'onbekend' | 'geen_nummer' | 'te_vaak' };
}

/** Stap 2: klopt de code? Zo ja, dan is de sleutel geldig voor stap 3. */
export async function controleerCode(
	wie: string,
	code: string,
	sleutel: string
): Promise<'ok' | 'fout' | 'verlopen' | 'onbekend' | 'geen_sleutel'> {
	const admin = beheerClient();
	if (!admin) return 'geen_sleutel';

	const { data, error } = await admin.rpc('herstel_code_controleren', {
		p_wie: wie,
		p_code: code,
		p_sleutel: sleutel
	});

	if (error) {
		console.error('herstel_code_controleren mislukte:', error.message);
		return 'geen_sleutel';
	}
	return data as 'ok' | 'fout' | 'verlopen' | 'onbekend';
}

/**
 * Stap 3: de sleutel inwisselen en het wachtwoord zetten.
 *
 * De code gaat in dezelfde beweging op gebruikt. Daarna is die sleutel niets
 * meer waard, ook niet als iemand het koekje bewaard heeft.
 */
export async function zetWachtwoord(
	sleutel: string,
	wachtwoord: string
): Promise<{ gelukt: true; naam: string } | { gelukt: false; fout: string }> {
	const admin = beheerClient();
	if (!admin) return { gelukt: false, fout: 'De beheersleutel staat niet in .env.' };

	const { data, error } = await admin.rpc('herstel_sleutel_inwisselen', { p_sleutel: sleutel }).maybeSingle();
	if (error) {
		console.error('herstel_sleutel_inwisselen mislukte:', error.message);
		return { gelukt: false, fout: 'Er ging iets mis. Vraag een nieuwe code aan.' };
	}

	const rij = data as { auth_user_id: string | null; naam: string } | null;
	if (!rij?.auth_user_id) {
		return { gelukt: false, fout: 'Deze code is niet meer geldig. Vraag een nieuwe aan.' };
	}

	const { error: zetten } = await admin.auth.admin.updateUserById(rij.auth_user_id, {
		password: wachtwoord
	});
	if (zetten) return { gelukt: false, fout: zetten.message };

	return { gelukt: true, naam: rij.naam };
}

/** De tekst van het bericht. Kort, want een sms is 160 tekens. */
export function smsTekst(code: string, link: string): string {
	return `Je code voor Urenregistratie is ${code}. Tien minuten geldig. ${link}`;
}
