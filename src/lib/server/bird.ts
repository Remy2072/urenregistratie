// Sms'jes versturen. De enige plek in deze app die iets naar buiten stuurt.
//
// Waarom dit één bestand is: welke partij het verstuurt is een keuze die per
// bedrijf kan verschillen, en het is de enige koppeling met een rekening eraan.
// Wil je morgen een andere partij, dan verandert er hier iets en nergens anders.
//
// Zonder sleutels in `.env` werkt de app gewoon door en komt het bericht in de
// serverlog te staan. Dat is niet alleen voor het gemak: zo is de hele
// herstelflow te bouwen en te testen voordat er een sms-account bestaat, en is
// aansluiten later drie waarden in `.env`. Zelfde opzet als de beheersleutel.

import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';

export type SmsUitkomst =
	| { verstuurd: true; viaLog: boolean }
	| { verstuurd: false; fout: string };

/** Staat Bird ingesteld, of gaat alles naar de serverlog? */
export function smsIngesteld(): boolean {
	return Boolean(env.BIRD_API_KEY && env.BIRD_WORKSPACE_ID && env.BIRD_CHANNEL_ID);
}

/**
 * Eén sms versturen.
 *
 * `nummer` moet de internationale vorm hebben (+316…); dat is precies wat
 * `telefoon.ts` van een ingetypt nummer maakt en wat er in de database staat.
 *
 * De vorm van dit verzoek is de Channels-API van Bird: één kanaal (sms) waar je
 * berichten in stopt. Kijk het na tegen hun documentatie zodra het account
 * bestaat -- dit is het enige stuk van deze app dat we niet zelf kunnen
 * uitproberen zonder rekening.
 */
export async function stuurSms(nummer: string, tekst: string): Promise<SmsUitkomst> {
	if (!smsIngesteld()) {
		// Geen sleutels: dan is de serverlog het kanaal. In productie is dat een
		// waarschuwing waard, want daar hoort dit niet te gebeuren.
		console[dev ? 'log' : 'warn'](`[sms → ${nummer}] ${tekst}`);
		return { verstuurd: true, viaLog: true };
	}

	const url = `https://api.bird.com/workspaces/${env.BIRD_WORKSPACE_ID}/channels/${env.BIRD_CHANNEL_ID}/messages`;

	try {
		const antwoord = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `AccessKey ${env.BIRD_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				receiver: { contacts: [{ identifierValue: nummer, identifierKey: 'phonenumber' }] },
				body: { type: 'text', text: { text: tekst } }
			})
		});

		if (!antwoord.ok) {
			// De tekst van hun fout in de log, niet op het scherm: daar staat wat
			// er mis is met ónze sleutels of ons account, en dat is niets voor de
			// bezorger die zijn wachtwoord kwijt is.
			const uitleg = await antwoord.text();
			console.error(`sms versturen mislukte (${antwoord.status}): ${uitleg.slice(0, 300)}`);
			return { verstuurd: false, fout: `Bird gaf ${antwoord.status} terug.` };
		}

		return { verstuurd: true, viaLog: false };
	} catch (fout) {
		console.error('sms versturen mislukte:', fout);
		return { verstuurd: false, fout: 'De sms-dienst was niet te bereiken.' };
	}
}
