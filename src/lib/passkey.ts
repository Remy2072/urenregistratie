// Het enige stukje van deze app dat in de browser moet gebeuren.
//
// Een passkey aanmaken of gebruiken loopt via `navigator.credentials`, en dat
// bestaat alleen op de telefoon zelf -- de server kan het niet voor je doen.
// Alles eromheen wél: de server vraagt de opdracht op bij Supabase en stuurt
// het antwoord er weer heen. Zie de uitleg bij fase 12 in bouwplan.md.
//
// Wat hier dus NIET staat is een Supabase-client. Er komt geen sleutel en geen
// sessie in de browser; die blijft waar hij hoort, in een cookie die scripts
// niet kunnen lezen.
//
// De omzettingen hieronder zijn nodig omdat WebAuthn met ArrayBuffers werkt en
// JSON dat niet kan. Nieuwe browsers doen dat zelf -- `parseCreationOptionsFromJSON`
// en `toJSON` uit WebAuthn niveau 3 -- en voor de rest staat het handwerk eronder.

/** Kan deze telefoon of computer überhaupt passkeys? */
export function kanPasskey(): boolean {
	return (
		typeof window !== 'undefined' &&
		typeof window.PublicKeyCredential !== 'undefined' &&
		typeof navigator.credentials?.create === 'function'
	);
}

// ── base64url, voor de browsers die het zelf niet doen ────────────────

function naarBytes(tekst: string): Uint8Array {
	const base64 = tekst.replace(/-/g, '+').replace(/_/g, '/');
	const opgevuld = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
	const ruw = atob(opgevuld);
	return Uint8Array.from(ruw, (teken) => teken.charCodeAt(0));
}

function naarTekst(bytes: ArrayBuffer): string {
	const ruw = String.fromCharCode(...new Uint8Array(bytes));
	return btoa(ruw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/** De opdracht van de server omzetten naar wat navigator.credentials verwacht. */
function leesOpties(opties: Json, soort: 'maken' | 'gebruiken'): Json {
	const PKC = window.PublicKeyCredential as Json;
	const natuurlijk = soort === 'maken' ? PKC?.parseCreationOptionsFromJSON : PKC?.parseRequestOptionsFromJSON;
	if (typeof natuurlijk === 'function') return natuurlijk.call(PKC, opties);

	// Handwerk voor oudere browsers: alles wat een sleutel of een uitdaging is,
	// gaat van tekst naar bytes. De rest blijft staan.
	const uit: Json = { ...opties, challenge: naarBytes(opties.challenge).buffer };
	if (opties.user) uit.user = { ...opties.user, id: naarBytes(opties.user.id).buffer };
	for (const veld of ['excludeCredentials', 'allowCredentials'] as const) {
		if (Array.isArray(opties[veld])) {
			uit[veld] = opties[veld].map((c: Json) => ({ ...c, id: naarBytes(c.id).buffer }));
		}
	}
	return uit;
}

/** En het antwoord van de telefoon weer terug naar iets dat door JSON past. */
function schrijfAntwoord(credential: Json): Json {
	if (typeof credential.toJSON === 'function') return credential.toJSON();

	const r = credential.response;
	const antwoord: Json = {
		id: credential.id,
		rawId: naarTekst(credential.rawId),
		type: credential.type,
		clientExtensionResults: credential.getClientExtensionResults?.() ?? {},
		authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
		response: { clientDataJSON: naarTekst(r.clientDataJSON) }
	};

	// Bij aanmelden krijg je een attestatie, bij inloggen een ondertekening.
	if (r.attestationObject) {
		antwoord.response.attestationObject = naarTekst(r.attestationObject);
		antwoord.response.transports = credential.response.getTransports?.() ?? [];
	} else {
		antwoord.response.authenticatorData = naarTekst(r.authenticatorData);
		antwoord.response.signature = naarTekst(r.signature);
		if (r.userHandle) antwoord.response.userHandle = naarTekst(r.userHandle);
	}
	return antwoord;
}

// ── De twee dingen die de browser doet ────────────────────────────────

/**
 * Een nieuwe passkey aanmaken op dit toestel. Hier komt het venster van de
 * telefoon in beeld: gezicht, vinger of pincode.
 */
export async function maakPasskey(opties: Json): Promise<Json> {
	const credential = await navigator.credentials.create({ publicKey: leesOpties(opties, 'maken') });
	if (!credential) throw new Error('Er is geen passkey aangemaakt.');
	return schrijfAntwoord(credential);
}

/** En hem gebruiken om in te loggen. */
export async function gebruikPasskey(opties: Json): Promise<Json> {
	const credential = await navigator.credentials.get({
		publicKey: leesOpties(opties, 'gebruiken')
	});
	if (!credential) throw new Error('Er is geen passkey gebruikt.');
	return schrijfAntwoord(credential);
}

/**
 * Wat er misging, in gewone taal.
 *
 * WebAuthn gooit met namen als NotAllowedError, en die betekenen zelden wat ze
 * lijken te betekenen: negen van de tien keer heeft iemand het venster gewoon
 * weggeklikt. Dat is geen fout om een rode balk voor te laten zien.
 */
export function passkeyFout(fout: unknown): string | null {
	const naam = (fout as { name?: string })?.name;
	if (naam === 'NotAllowedError' || naam === 'AbortError') return null; // weggeklikt
	if (naam === 'InvalidStateError') return 'Deze telefoon heeft al een passkey voor dit account.';
	if (naam === 'SecurityError') {
		return 'Dit werkt alleen op een beveiligde verbinding (https), of op localhost.';
	}
	const bericht = (fout as { message?: string })?.message;
	return bericht ?? 'Het is niet gelukt.';
}
