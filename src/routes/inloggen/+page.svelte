<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let bezig = $state(false);
</script>

{#if !data.ingesteld}
	<div class="blok">
		<div class="kaart aandacht">
			<div class="regel"><span class="dag">Database nog niet ingesteld</span></div>
			<p class="detail" style="margin:0.4rem 0 0">
				Maak een bestand <code>.env</code> naast <code>package.json</code> en zet daar de twee
				waarden in die in <code>.env.example</code> staan. Daarna de dev server opnieuw starten.
			</p>
		</div>
	</div>
{/if}

<div class="blok">
	<form
		method="POST"
		use:enhance={() => {
			bezig = true;
			return async ({ update }) => {
				await update();
				bezig = false;
			};
		}}
	>
		<label class="veld">
			<span>E-mailadres</span>
			<input
				name="email"
				type="email"
				autocomplete="username"
				inputmode="email"
				required
				value={form?.email ?? ''}
			/>
		</label>

		<label class="veld">
			<span>Wachtwoord</span>
			<input name="wachtwoord" type="password" autocomplete="current-password" required />
		</label>

		{#if form?.fout}
			<p class="fout">{form.fout}</p>
		{/if}

		<div class="knoppen">
			<button class="groot primair" type="submit" disabled={bezig}>
				{bezig ? 'Bezig…' : 'Inloggen'}
			</button>
		</div>
	</form>
</div>

<div class="blok">
	<p class="notitie">
		Geen account aanmaken hier. Je krijgt je inlog van de baas — tien mensen, dat regel je niet met
		een registratieformulier dat iedereen kan vinden.
	</p>
</div>
