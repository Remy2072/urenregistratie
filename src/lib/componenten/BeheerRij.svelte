<!--
	Eén regel op het beheerscherm: een bus, een diensttijd, een collega.

	Alle drie werken ze hetzelfde. Je ziet wie of wat het is, je drukt op
	Wijzigen, en dan staat er een formulier met velden, een vinkje "in gebruik",
	en Laat maar / Opslaan. Dat skelet stond vier keer uitgeschreven in
	`beheer/+page.svelte` -- inclusief vier keer dezelfde `use:enhance` die na
	het opslaan de regel weer dichtklapt, en vier keer hetzelfde verborgen
	id-veld. Eén ervan vergeten bij te werken en het scherm doet ineens iets
	anders per soort, zonder dat iemand dat besloten heeft.

	Wat per soort verschilt zijn de velden en wat je in de gesloten stand ziet,
	en dat zijn precies de twee snippets die je meegeeft.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Snippet } from 'svelte';
	import Kaart from './Kaart.svelte';

	let {
		id,
		open,
		openen,
		sluiten,
		wijzigActie,
		wegActie,
		actief,
		actiefLabel,
		openLabel = 'Wijzigen',
		velden,
		toon,
		extra
	}: {
		/** Van wie of wat deze regel is; gaat als verborgen veld mee. */
		id: string;
		/** Staat het formulier open? Eén tegelijk, dat bepaalt het scherm. */
		open: boolean;
		openen: () => void;
		sluiten: () => void;
		wijzigActie: string;
		/** Weglaten als er niets te verwijderen valt -- bij mensen bijvoorbeeld. */
		wegActie?: string;
		actief: boolean;
		/** 'In gebruik' bij een bus, 'Werkt hier' bij een mens. */
		actiefLabel: string;
		/** Bij oud-collega's staat er 'Weer aannemen' op de knop. */
		openLabel?: string;
		velden: Snippet;
		toon: Snippet;
		/** Wat er in de gesloten stand ónder de knop hoort: logins, adressen. */
		extra?: Snippet;
	} = $props();
</script>

<Kaart>
	{#if open}
		<form
			method="post"
			action={wijzigActie}
			use:enhance={() => async ({ update }) => {
				await update();
				sluiten();
			}}
		>
			<input type="hidden" name="id" value={id} />
			{@render velden()}
			<label class="vinkrij na-mid">
				<input type="checkbox" name="actief" checked={actief} />
				<span class="detail">{actiefLabel}</span>
			</label>
			<div class="knoppen">
				<button type="button" onclick={sluiten}>Laat maar</button>
				<button class="primair">Opslaan</button>
			</div>
		</form>

		{#if wegActie}
			<form method="post" action={wegActie} use:enhance>
				<input type="hidden" name="id" value={id} />
				<div class="knoppen"><button>Verwijderen</button></div>
			</form>
		{/if}
	{:else}
		{@render toon()}
		<div class="knoppen">
			<button type="button" onclick={openen}>{openLabel}</button>
		</div>
		{@render extra?.()}
	{/if}
</Kaart>
