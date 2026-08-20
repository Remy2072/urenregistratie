<script lang="ts">
	import { enhance } from '$app/forms';
	import { dagNaam, datumLang, duurInUren, urenTekst } from '$lib/tijd';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let bezig = $state(false);
	const wacht = () => {
		bezig = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			bezig = false;
		};
	};

	let v = $derived(data.verzoek);
	let open = $derived(v.status === 'open');
</script>

{#if form?.fout}
	<p class="fout">{form.fout}</p>
{/if}

<div class="blok">
	<div class="kaart nu">
		<div class="regel">
			<span class="dag">{dagNaam(v.datum)} {datumLang(v.datum)}</span>
			<span class="detail tijden">{v.gepland_begin} – {v.gepland_eind}</span>
		</div>
		<p class="detail" style="margin:0.3rem 0 0">
			{v.post} · {urenTekst(duurInUren(v.gepland_begin, v.gepland_eind))} uur
		</p>
		<p class="detail" style="margin:0.4rem 0 0">
			{#if v.open_verzoek}
				<strong>{v.van_naam}</strong> zoekt iemand die deze dienst overneemt.
			{:else}
				<strong>{v.van_naam}</strong> vraagt of jij deze dienst overneemt.
			{/if}
		</p>
	</div>
</div>

{#if !open}
	<!-- Al afgehandeld. Dat kan gewoon gebeuren bij een open verzoek: de link
	     blijft in de groepsapp staan nadat iemand hem heeft gepakt. -->
	<div class="blok">
		<div class="kaart">
			<div class="regel">
				<span class="dag">
					{#if v.status === 'geaccepteerd'}
						Al overgenomen
					{:else if v.status === 'geweigerd'}
						Afgewezen
					{:else}
						Ingetrokken
					{/if}
				</span>
			</div>
			<p class="detail" style="margin:0.4rem 0 0">
				{#if v.status === 'geaccepteerd'}
					Iemand was er eerder bij. Deze dienst staat al op naam van een ander.
				{:else if v.status === 'geweigerd'}
					Dit verzoek is afgewezen.
				{:else}
					{v.van_naam} heeft dit verzoek zelf gesloten — waarschijnlijk heeft hij iemand gevonden.
				{/if}
			</p>
			<div class="knoppen"><a href="/mijn-week">Naar mijn week</a></div>
		</div>
	</div>
{:else if v.van_mij}
	<div class="blok">
		<p class="notitie">Dit is je eigen verzoek. Je kunt hem niet zelf overnemen.</p>
		<div class="knoppen"><a href="/mijn-week">Naar mijn week</a></div>
	</div>
{:else if form?.geweigerd}
	<div class="blok">
		<p class="notitie">
			Je hebt nee gezegd. {v.van_naam} ziet dat in zijn week staan en zoekt verder.
		</p>
		<div class="knoppen"><a href="/mijn-week">Naar mijn week</a></div>
	</div>
{:else}
	<div class="blok">
		<form method="post" action="?/accepteren" use:enhance={wacht}>
			<div class="knoppen">
				<button class="groot primair" disabled={bezig}>
					{bezig ? 'Bezig…' : 'Ja, ik neem hem over'}
				</button>
			</div>
		</form>

		{#if v.voor_mij}
			<form method="post" action="?/weigeren" use:enhance={wacht}>
				<div class="knoppen"><button disabled={bezig}>Nee, kan niet</button></div>
			</form>
		{/if}

		<p class="notitie">
			Zeg je ja, dan staat deze dienst meteen in jouw week en is hij weg bij {v.van_naam}. Melden
			doe je hem daarna zelf, na de rit.
		</p>
		{#if v.open_verzoek}
			<p class="notitie">
				Dit is een open verzoek: wie het eerst ja zegt, krijgt de dienst. Ben je te laat, dan zegt
				dit scherm dat.
			</p>
		{/if}
	</div>
{/if}
