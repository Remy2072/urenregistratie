<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Als beheerder zie je de hele ploeg, als bezorger alleen jezelf. Dat
	// verschil is precies wat de policies doen.
	let beheerder = $derived(data.persoon?.rol === 'beheerder');
</script>

<div class="blok">
	{#if data.persoon}
		<div class="kaart nu">
			<div class="regel">
				<span class="dag">{data.persoon.naam}</span>
				<span class="merk {beheerder ? 'bevestigd' : 'gemeld'}">{data.persoon.rol}</span>
			</div>
			<p class="detail" style="margin:0.3rem 0 0">{data.email}</p>
		</div>
	{:else}
		<div class="kaart aandacht">
			<div class="regel"><span class="dag">Nog niet gekoppeld</span></div>
			<p class="detail" style="margin:0.4rem 0 0">
				Je bent ingelogd als {data.email}, maar dit account hangt nog aan geen enkele persoon. Zolang
				<code>personen.auth_user_id</code> leeg is, laat de database je nergens bij — vandaar dat alle
				tellingen hieronder op nul staan.
			</p>
		</div>
	{/if}
</div>

<div class="blok">
	<h2>Wat de database jou laat zien</h2>
	<div class="tabelrand">
		<table>
			<tbody>
				<tr><td>Personen</td><td class="getal">{data.zichtbaar.personen}</td></tr>
				<tr><td>Diensten</td><td class="getal">{data.zichtbaar.diensten}</td></tr>
				<tr><td>Sjabloonregels</td><td class="getal">{data.zichtbaar.sjabloon}</td></tr>
				<tr><td>Posten</td><td class="getal">{data.zichtbaar.posten}</td></tr>
			</tbody>
		</table>
	</div>

	<p class="notitie">
		{#if beheerder}
			Je ziet de hele ploeg en alle diensten. Dat hoort: je bent beheerder.
		{:else if data.persoon}
			Eén persoon — jezelf — en van het sjabloon alleen jouw eigen vaste dagen. De ploeg staat er
			wel, je mag hem alleen niet zien. Posten zijn voor iedereen zichtbaar; daar staan geen
			persoonsgegevens in.
		{:else}
			Overal nul. Niet omdat de database leeg is, maar omdat dit account nog nergens bij hoort.
		{/if}
	</p>
</div>

<div class="blok">
	<form method="POST" action="?/uitloggen">
		<div class="knoppen">
			<button class="groot" type="submit">Uitloggen</button>
		</div>
	</form>
</div>
