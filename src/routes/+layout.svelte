<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { datumLang, dagNaam, isoWeek } from '$lib/tijd';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const titels: Record<string, string> = {
		'/mijn-week': 'Mijn week',
		'/beschikbaarheid': 'Beschikbaarheid',
		'/rooster': 'Rooster',
		'/beheer': 'Beheer',
		'/beheer/sjabloon': 'Weekrooster',
		'/overzicht': 'Weekoverzicht',
		'/export': 'Export',
		'/inloggen': 'Inloggen',
		'/ik': 'Ingelogd'
	};

	let pad = $derived(page.url.pathname);
	let titel = $derived(titels[pad] ?? 'Urenregistratie');
	let beheerder = $derived(data.ik?.rol === 'beheerder');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{titel}</title>
</svelte:head>

<div class="schil">
	<header class="kop">
		<h1>{titel}</h1>
		<p class="datum">
			{dagNaam(data.nu.datum)}
			{datumLang(data.nu.datum)}, {data.nu.tijd} · week {isoWeek(data.nu.datum)}
			{#if data.ik}
				· <a href="/ik">{data.ik.naam}</a>
			{/if}
		</p>

		<nav class="tabs">
			<a href="/rooster" aria-current={pad === '/rooster' ? 'page' : undefined}>Rooster</a>
			{#if data.bezorger}
				<a href="/mijn-week" aria-current={pad === '/mijn-week' ? 'page' : undefined}>Mijn week</a>
				<a
					href="/beschikbaarheid"
					aria-current={pad === '/beschikbaarheid' ? 'page' : undefined}>Wanneer ik kan</a
				>
			{/if}
			{#if beheerder}
				<a href="/overzicht" aria-current={pad === '/overzicht' ? 'page' : undefined}>Baas</a>
				<a href="/export" aria-current={pad === '/export' ? 'page' : undefined}>Boekhouder</a>
				<a href="/beheer" aria-current={pad === '/beheer' ? 'page' : undefined}>Beheer</a>
			{/if}
		</nav>
	</header>

	{@render children()}
</div>
