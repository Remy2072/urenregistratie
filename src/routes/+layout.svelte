<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { NU } from '$lib/nepdata';
	import { datumLang, dagNaam, isoWeek } from '$lib/tijd';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const titels: Record<string, string> = {
		'/': 'Urenregistratie',
		'/mijn-week': 'Mijn week',
		'/overzicht': 'Weekoverzicht',
		'/export': 'Export',
		'/inloggen': 'Inloggen',
		'/ik': 'Ingelogd'
	};

	// Alleen de uitlegpagina draait nog op nepdata: die laat het vaste moment in
	// week 34 zien om uit te leggen waar de app voor is. De drie schermen zelf
	// praten allemaal met de database.
	const prototypePaden = ['/'];

	let pad = $derived(page.url.pathname);
	let titel = $derived(titels[pad] ?? 'Urenregistratie');
	let prototype = $derived(prototypePaden.includes(pad));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{titel}</title>
</svelte:head>

{#if prototype}
	<p class="strook">Prototype — nepdata, niets wordt opgeslagen</p>
{/if}

<div class="schil">
	<header class="kop">
		<h1>{titel}</h1>
		{#if prototype}
			<p class="datum">
				{dagNaam(NU.datum)}
				{datumLang(NU.datum)}, {NU.tijd} · week {isoWeek(NU.datum)}
			</p>
		{:else}
			<p class="datum">
				{dagNaam(data.nu.datum)}
				{datumLang(data.nu.datum)}, {data.nu.tijd} · week {isoWeek(data.nu.datum)}
				{#if data.ik}
					· <a href="/ik">{data.ik.naam}</a>
				{/if}
			</p>
		{/if}

		<nav class="tabs">
			<a href="/" aria-current={pad === '/' ? 'page' : undefined}>Uitleg</a>
			<a href="/mijn-week" aria-current={pad === '/mijn-week' ? 'page' : undefined}>Bezorger</a>
			<a href="/overzicht" aria-current={pad === '/overzicht' ? 'page' : undefined}>Baas</a>
			<a href="/export" aria-current={pad === '/export' ? 'page' : undefined}>Boekhouder</a>
		</nav>
	</header>

	{@render children()}
</div>
