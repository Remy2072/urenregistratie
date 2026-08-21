import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { beheerClient } from '$lib/server/beheersleutel';
import { maakAgenda, type AgendaDienst } from '$lib/server/agenda';
import { korteTijd } from '$lib/tijd';

/**
 * Het agenda-abonnement: `/agenda/<sleutel>.ics`
 *
 * Geen pagina maar een bestand, want de bezoeker is hier geen mens maar een
 * agenda-app. Die kan niet inloggen, en daarom is de sleutel in dit adres het
 * enige bewijs -- de hele reden dat er in de database alleen een hash van staat
 * en dat je op `/ik` een nieuwe kunt maken.
 *
 * Het opzoeken gaat met de beheersleutel. Dat is de kern van de keuze: zou de
 * functie voor `anon` open staan, dan kan iedereen met de publieke sleutel
 * sleutels afvuren op de database. Nu komt er niemand langs deze route heen.
 */
export const GET: RequestHandler = async ({ params, setHeaders }) => {
	// De agenda vraagt om `<sleutel>.ics`, want een agenda-app wil een bestand
	// zien. Dat achtervoegsel hoort niet bij het geheim.
	const sleutel = params.sleutel.replace(/\.ics$/i, '');

	const admin = beheerClient();
	if (!admin) {
		error(503, 'De agenda staat hier niet aan: de beheersleutel ontbreekt.');
	}

	const { data, error: fout } = await admin.rpc('agenda_diensten', { p_sleutel: sleutel });

	if (fout) {
		console.error(`agenda ophalen mislukte: ${fout.message}`);
		error(500, 'De agenda kon niet worden opgehaald.');
	}

	// Geen rijen betekent: deze sleutel bestaat niet, is ingetrokken, of hij
	// hoort bij iemand zonder diensten. Alle drie hetzelfde antwoord -- zie
	// "Eén antwoord voor alles wat je niet mag zien" in ideeen.md. Een agenda-app
	// leest geen foutmeldingen, dus er valt hier ook niets uit te leggen.
	if (!data || data.length === 0) {
		error(404, 'Niet gevonden.');
	}

	const diensten = (data as AgendaDienst[]).map((d) => ({
		...d,
		gepland_begin: korteTijd(d.gepland_begin)!,
		gepland_eind: korteTijd(d.gepland_eind)!
	}));

	setHeaders({
		'content-type': 'text/calendar; charset=utf-8',
		// Een agenda mag dit best even bewaren, maar niet lang: een ruil van
		// vanmiddag moet er bij de volgende ronde in staan. En niet in een
		// tussenliggende cache, want dit bestand is persoonlijk.
		'cache-control': 'private, max-age=300',
		'content-disposition': 'inline; filename="werk.ics"'
	});

	return new Response(maakAgenda(diensten, new Date()));
};
