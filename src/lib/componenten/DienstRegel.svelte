<!-- De kop van elke dienstkaart: welke dag, welke bus. -->
<script lang="ts">
	import type { Dienst } from '$lib/model';
	import { dagNaam, datumKort } from '$lib/tijd';

	let { dienst, post }: { dienst: Dienst; post: string } = $props();
</script>

<div class="regel">
	<span class="dag">{dagNaam(dienst.datum)} {datumKort(dienst.datum)}</span>
	<span class="detail">{post}</span>
</div>
