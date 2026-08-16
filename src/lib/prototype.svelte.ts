// Alles wat alleen in het prototype bestaat.
//
// De diensten staan hier in het geheugen. Een melding is dus meteen zichtbaar
// op het bazenscherm -- dat is precies wat je wil laten zien -- maar bij het
// verversen van de pagina is alles weer zoals het was. Dat is bewust: fase 0
// slaat niets op, anders ben je aan fase 4 begonnen.
//
// In fase 4 worden `meld` en `bevestig` twee Supabase-aanroepen en verdwijnt
// dit bestand. De schermen roepen ze nu al zo aan.
//
// Let op: dit is toestand op moduleniveau en die wordt op een server gedeeld
// door iedereen die de pagina opvraagt. Voor een prototype op je eigen laptop
// maakt dat niets uit, maar zet dit dus niet online met echte namen erin.

import { alleDiensten, NU_TIJDSTIP } from './nepdata';
import type { Dienst, Tijd } from './model';

export const staat = $state({
	/** Wie ben je op dit moment. In fase 2 komt dit uit de sessie. */
	ikId: 'p-remy',
	diensten: alleDiensten.map((d) => ({ ...d }))
});

/**
 * Melden. Begin en eind allebei, want je kunt net zo goed later begonnen zijn
 * als langer doorgegaan -- en dan is alleen de eindtijd verzetten een leugen
 * die niemand meer terugvindt.
 */
export function meld(dienst: Dienst, begin: Tijd, eind: Tijd) {
	dienst.werkelijk_begin = begin;
	dienst.werkelijk_eind = eind;
	dienst.status = 'gemeld';
	dienst.gemeld_op = NU_TIJDSTIP;
	dienst.gemeld_door = staat.ikId;
}

/** Bevestigen: alleen de beheerder, en pas dan telt de dienst mee in de export. */
export function bevestig(dienst: Dienst) {
	if (dienst.status !== 'gemeld') return;
	dienst.status = 'bevestigd';
	dienst.bevestigd_op = NU_TIJDSTIP;
	dienst.bevestigd_door = 'p-baas';
}

export function draaiTerug(dienst: Dienst) {
	dienst.status = 'verwacht';
	dienst.werkelijk_begin = null;
	dienst.werkelijk_eind = null;
	dienst.gemeld_op = null;
	dienst.gemeld_door = null;
	dienst.bevestigd_op = null;
	dienst.bevestigd_door = null;
}
