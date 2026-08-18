<!--
	De −30/+30-knoppen. Geen tijdkiezer: de database staat alleen hele en halve
	uren toe, dus een kiezer zou tijden aanbieden die niet kunnen bestaan.

	De knoppen rekenen zelf niets af -- ze stappen. Wie om 21:20 klaar is kiest
	dus zelf, en de afspraak daarover staat op het scherm zelf.
-->
<script lang="ts">
	let {
		label,
		stappen,
		stap
	}: { label: string; stappen: number[]; stap: (delta: number) => void } = $props();
</script>

<div class="stelrij">
	<span class="stellabel">{label}</span>
	{#each stappen as delta (delta)}
		<button type="button" onclick={() => stap(delta)}>
			{delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
		</button>
	{/each}
</div>
