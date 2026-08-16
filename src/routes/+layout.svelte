<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { NU } from '$lib/nepdata';
	import { datumLang, dagNaam, isoWeek } from '$lib/tijd';

	let { children } = $props();

	const titels: Record<string, string> = {
		'/': 'Urenregistratie',
		'/mijn-week': 'Mijn week',
		'/overzicht': 'Weekoverzicht',
		'/export': 'Export'
	};

	let titel = $derived(titels[page.url.pathname] ?? 'Urenregistratie');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{titel}</title>
</svelte:head>

<p class="strook">Prototype — nepdata, niets wordt opgeslagen</p>

<div class="schil">
	<header class="kop">
		<h1>{titel}</h1>
		<p class="datum">
			{dagNaam(NU.datum)}
			{datumLang(NU.datum)}, {NU.tijd} · week {isoWeek(NU.datum)}
		</p>
		<nav class="tabs">
			<a href="/" aria-current={page.url.pathname === '/' ? 'page' : undefined}>Uitleg</a>
			<a href="/mijn-week" aria-current={page.url.pathname === '/mijn-week' ? 'page' : undefined}>
				Bezorger
			</a>
			<a href="/overzicht" aria-current={page.url.pathname === '/overzicht' ? 'page' : undefined}>
				Baas
			</a>
			<a href="/export" aria-current={page.url.pathname === '/export' ? 'page' : undefined}>
				Boekhouder
			</a>
		</nav>
	</header>

	{@render children()}
</div>
