<!--
	Het witte vlak met een randje waar bijna alles in staat: een dienst, een bus,
	een collega, een melding.

	Stond dertig keer als `<div class="kaart">` uitgeschreven over elf schermen.
	Dat werkte prima zolang een kaart een div met een randje is -- maar zodra hij
	iets anders moet zijn (een `<article>`, een schaduw, een aanraakvlak dat
	openklapt) zoek je dertig plekken af. Nu is het er één.

	`soort` in plaats van losse class-namen, want een kaart is precies één van de
	drie: gewoon, vraagt aandacht, of dit is hem nu.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		soort = 'gewoon',
		children
	}: { soort?: 'gewoon' | 'aandacht' | 'nu'; children: Snippet } = $props();
</script>

<div class="kaart" class:aandacht={soort === 'aandacht'} class:nu={soort === 'nu'}>
	{@render children()}
</div>
