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
	// Bij corrigeren staat er misschien al een opmerking; die wil je zien en niet
	// opnieuw hoeven typen. $state met een beginwaarde uit props kijkt maar één
	// keer, dus die zetten we bij het wisselen van dienst zelf om.
	let opmerking = $state('');
	let gezienVoor = '';
	$effect(() => {
		if (gezienVoor !== dienst.id) {
			gezienVoor = dienst.id;
			opmerking = dienst.opmerking ?? '';
		}
	});

	// Het venster waarbinnen de tijdstapper mag komen. Deze twee getallen zijn
	// de enige plek in de app waar een aanname over openingstijden staat: hier
	// is dat een avonddienst, want bij de eerste klant begint er niets voor
	// 15:00 en is alles voor middernacht klaar. Buiten het venster tik je toch
	// alleen maar mis.
	//
	// Een ochtendploeg of een nachtdienst zet ze anders. Ze horen daarom op de
	// bedrijfspagina uit `ideeen.md`; zolang die er niet is, verander je ze hier.
	const VROEGSTE = '15:00';
	const LAATSTE = '22:00';

	let begin = $derived(verschuif(basisBegin, bijBegin));
	let eind = $derived(verschuif(basisEind, bijEind));
	let gewijzigd = $derived(bijBegin !== 0 || bijEind !== 0);

	/** Anders dan gepland -- ongeacht of je nu aan het melden of corrigeren bent. */
	let afwijkt = $derived(begin !== dienst.gepland_begin || eind !== dienst.gepland_eind);

	let verschil = $derived(
		minuten(eind) - minuten(begin) - (minuten(dienst.gepland_eind) - minuten(dienst.gepland_begin))
	);

	/**
	 * Het voorbeeld in het veld hangt af van welke kant je op gaat. Stond er bij
	 * minder uren "liep uit", dan legt het zichzelf tegen -- en dan gaat iemand
	 * dat overtypen omdat het er stond.
	 */
	let hint = $derived(
		verschil > 0
			? 'laatste rit liep uit'
			: verschil < 0
				? 'eerder klaar, niets meer te bezorgen'
				: 'later begonnen, even lang doorgereden'
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
		if (nieuwBegin < minuten(VROEGSTE) || nieuwEind > minuten(LAATSTE)) return;
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

	<p class="detail" style="margin:0.5rem 0 0">
		Vroegste begintijd {VROEGSTE}, laatste eindtijd {LAATSTE}.
	</p>

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

		<!--
			Wijken je tijden af, dan wil de baas weten waarom. Zonder die regel
			staat er straks "+30 min" op zijn scherm zonder enige uitleg en moet hij
			bellen -- en dat is precies het telefoontje dat deze app moet uitsparen.
		-->
		{#if afwijkt}
			<label class="veld" style="margin-top:0.6rem">
				<span>Wat was er anders?</span>
				<input name="opmerking" bind:value={opmerking} placeholder={hint} required />
			</label>
		{/if}
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
