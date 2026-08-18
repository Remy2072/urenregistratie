<!--
	Het gekleurde labeltje: 'gemeld', 'bevestigd', '+30 min', 'achteraf'.

	Stond in fase 0 als losse span in drie schermen. Nu op één plek, want de
	kleuren horen bij de status en niet bij het scherm waar hij toevallig staat.
-->
<script lang="ts">
	let { soort, tekst }: { soort: string; tekst?: string } = $props();
</script>

<span class="merk {soort}">{tekst ?? soort}</span>
