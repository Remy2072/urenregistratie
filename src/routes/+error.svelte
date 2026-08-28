<!--
	De foutpagina. Bestond nog niet, en dat viel niet op zolang er niets
	misging.

	Hij is er vooral voor 503: "even geen verbinding, je bent niet uitgelogd".
	Zonder deze pagina krijgt iemand daar de kale melding van SvelteKit te zien,
	en die leest als iets wat kapot is -- terwijl het antwoord "probeer het nog
	eens" is. Zie de deurcontrole in hooks.server.ts.
-->
<script lang="ts">
	import { page } from '$app/state';
	import Kaart from '$lib/componenten/Kaart.svelte';
	import Merk from '$lib/componenten/Merk.svelte';

	// 503 is de storing hierboven. 404 is een verkeerd adres. De rest is een
	// echte fout, en dan is de enige eerlijke zin dat je het opnieuw probeert.
	let storing = $derived(page.status === 503);
	let onbekend = $derived(page.status === 404);
</script>

<div class="blok">
	<Kaart soort="aandacht">
		<div class="regel">
			<span class="dag">
				{#if storing}
					Even geen verbinding
				{:else if onbekend}
					Deze pagina bestaat niet
				{:else}
					Er ging iets mis
				{/if}
			</span>
			<Merk soort="afwijking" tekst={String(page.status)} />
		</div>

		<p class="detail na-klein">
			{#if storing}
				De app kon even niet nagaan wie je bent. <strong>Je bent niet uitgelogd</strong> — je
				wachtwoord hoef je dus niet op te zoeken. Ververs de pagina, en als het aanhoudt is het aan
				onze kant.
			{:else if onbekend}
				Er staat niets op dit adres. Ga naar je eigen scherm en probeer het daar.
			{:else}
				{page.error?.message ?? 'Onbekende fout.'}
			{/if}
		</p>

		<div class="knoppen">
			<a href="/mijn-week">Naar mijn week</a>
		</div>
	</Kaart>
</div>
