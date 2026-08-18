<!--
	De kaart waarop je een dienst meldt.

	Eén tik voor "gedraaid zoals gepland", en anders de stappers. Begin én eind,
	niet alleen eind: later begonnen komt net zo vaak voor als langer doorgegaan.
	Kan je alleen de eindtijd verzetten, dan verwerkt iedereen het verschil daar
	en klopt er straks niets meer van de tijden zelf.

	De knop verandert van tekst zodra je iets bijstelt. Dat is met opzet: je ziet
	wat je gaat melden vóór je meldt, en niet pas op het bazenscherm.

	Dezelfde kaart doet het corrigeren van een melding die nog niet bevestigd is.
	Dat mocht altijd al -- in schema.sql staat op diensten_melden
	`using (... status in ('verwacht', 'gemeld'))` -- alleen bood het scherm het
	niet aan. Eén misklik op "Gedraaid" en je moest de baas vragen.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Dienst } from '$lib/model';
	import { afwijkingTekst, minuten, verschuif } from '$lib/tijd';
	import DienstRegel from './DienstRegel.svelte';
	import Merk from './Merk.svelte';
	import TijdStapper from './TijdStapper.svelte';

	let {
		dienst,
		post,
		achteraf = false,
		corrigeren = false,
		sluit
	}: {
		dienst: Dienst;
		post: string;
		achteraf?: boolean;
		corrigeren?: boolean;
		sluit?: () => void;
	} = $props();

	// Corrigeer je een melding, dan begin je bij wat er gemeld is. Meld je voor
	// het eerst, dan bij wat er gepland stond. Het verschil dat je te zien
	// krijgt gaat in beide gevallen over de planning -- dat is wat de baas
	// straks beoordeelt.
	let basisBegin = $derived(
		corrigeren && dienst.werkelijk_begin ? dienst.werkelijk_begin : dienst.gepland_begin
	);
	let basisEind = $derived(
		corrigeren && dienst.werkelijk_eind ? dienst.werkelijk_eind : dienst.gepland_eind
	);

	// Bijstelling in minuten ten opzichte van de planning. Niet de tijd zelf,
	// zodat "terug naar gepland" altijd gewoon de tegenovergestelde tik is.
	let bijBegin = $state(0);
	let bijEind = $state(0);
	let bezig = $state(false);

	let begin = $derived(verschuif(basisBegin, bijBegin));
	let eind = $derived(verschuif(basisEind, bijEind));
	let gewijzigd = $derived(bijBegin !== 0 || bijEind !== 0);
	let verschil = $derived(
		minuten(eind) - minuten(begin) - (minuten(dienst.gepland_eind) - minuten(dienst.gepland_begin))
	);

	/**
	 * Dezelfde grenzen als het schema: eind na begin, alles binnen één
	 * kalenderdag. Zie dienst_werkelijk_klopt en dienst_gepland_klopt.
	 * Buiten de grenzen doet de knop niets -- een foutmelding voor iets wat je
	 * met één tik terugdraait is meer in de weg dan behulpzaam.
	 */
	function stap(veld: 'begin' | 'eind', delta: number) {
		const nieuwBegin = minuten(basisBegin) + (veld === 'begin' ? bijBegin + delta : bijBegin);
		const nieuwEind = minuten(basisEind) + (veld === 'eind' ? bijEind + delta : bijEind);
		if (nieuwBegin < 0 || nieuwEind > 23 * 60 + 30) return;
		if (nieuwEind - nieuwBegin < 30) return;
		if (veld === 'begin') bijBegin += delta;
		else bijEind += delta;
	}
</script>

<div class="kaart nu">
	<DienstRegel {dienst} {post} />

	<p class="detail" style="margin:0.2rem 0 0">
		Gepland <span class="tijden">{dienst.gepland_begin} – {dienst.gepland_eind}</span>
		{#if achteraf}
			· <Merk soort="achteraf" />
		{/if}
	</p>

	<p class="uitkomst">
		<span class="tijden">{begin} – {eind}</span>
		{#if verschil !== 0}
			<Merk soort="afwijking" tekst={afwijkingTekst(verschil)} />
		{/if}
	</p>

	<TijdStapper label="Begin" stappen={[-30, 30]} stap={(d) => stap('begin', d)} />
	<TijdStapper label="Einde" stappen={[-30, 30, 60]} stap={(d) => stap('eind', d)} />

	<form
		method="post"
		action="?/melden"
		use:enhance={() => {
			bezig = true;
			return async ({ update }) => {
				await update();
				bezig = false;
				sluit?.();
			};
		}}
	>
		<input type="hidden" name="id" value={dienst.id} />
		<input type="hidden" name="begin" value={begin} />
		<input type="hidden" name="eind" value={eind} />
		<div class="knoppen">
			{#if corrigeren}
				<button type="button" onclick={() => sluit?.()} disabled={bezig}>Laat maar</button>
			{/if}
			<button class="groot primair" disabled={bezig || (corrigeren && !gewijzigd)}>
				{#if bezig}
					Bezig…
				{:else if corrigeren}
					Opslaan {begin} – {eind}
				{:else if gewijzigd}
					Melden {begin} – {eind}
				{:else}
					Gedraaid
				{/if}
			</button>
		</div>
	</form>
</div>
