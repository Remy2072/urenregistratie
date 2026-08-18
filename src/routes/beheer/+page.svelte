<script lang="ts">
	import { enhance } from '$app/forms';
	import Merk from '$lib/componenten/Merk.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/** Welke regel je aan het bewerken bent. Eén tegelijk, anders wordt het rommelig. */
	let bewerkt = $state<string | null>(null);

	/**
	 * Meldingen staan bovenaan, en dit scherm is lang. Sta je onderaan bij de
	 * personen, dan lijkt een gelukte actie op niets -- zeker bij het aanmaken
	 * van een login, want dat wachtwoord zie je maar één keer.
	 */
	const naarDeMelding = () => async ({ update }: { update: () => Promise<void> }) => {
		await update();
		window.scrollTo({ top: 0, behavior: 'smooth' });
	};
</script>

{#if form?.fout}
	<p class="fout">{form.fout}</p>
{/if}
{#if form?.let_op}
	<p class="notitie">{form.let_op}</p>
{/if}
{#if typeof form?.gedaan === 'string' && form.gedaan.includes('@')}
	<p class="notitie">{form.gedaan}</p>
{/if}
{#if form?.login}
	<!--
		Eén keer in beeld en nooit meer. Supabase bewaart alleen een versleutelde
		versie, dus ook wij kunnen hem daarna niet meer opzoeken -- opnieuw
		instellen is dan het enige dat rest.
	-->
	<div class="blok">
		<div class="kaart nu">
			<div class="regel">
				<span class="dag">
					{form.login.opnieuw ? 'Nieuw wachtwoord voor' : 'Login voor'}
					{form.login.naam}
				</span>
			</div>
			<p class="detail" style="margin:0.4rem 0 0">{form.login.email}</p>
			<p class="uitkomst"><span class="tijden">{form.login.wachtwoord}</span></p>
			<p class="notitie">
				Schrijf dit over of geef het meteen door. Zodra je deze pagina ververst is het weg — ook
				voor mij, want Supabase bewaart alleen een versleutelde versie.
			</p>
		</div>
	</div>
{/if}

{#if !data.beheerder}
	<div class="blok">
		<h2>Alleen voor de baas</h2>
		<p class="detail">Hier stel je in wie er werkt en waarop.</p>
	</div>
{:else}
	<div class="blok">
		<h2>Het vaste weekrooster</h2>
		<p class="detail">
			Wie er élke maandag, elke dinsdag enzovoort rijdt. Daar maakt de wekelijkse uitrol de
			diensten van.
		</p>
		<div class="knoppen">
			<a href="/beheer/sjabloon">Weekrooster instellen →</a>
		</div>
	</div>

	<!-- ── Posten ──────────────────────────────────────────────────── -->
	<div class="blok">
		<h2>Bussen en scooters</h2>

		{#each data.posten as po (po.id)}
			<div class="kaart">
				{#if bewerkt === po.id}
					<form
						method="post"
						action="?/postWijzig"
						use:enhance={() => async ({ update }) => {
							await update();
							bewerkt = null;
						}}
					>
						<input type="hidden" name="id" value={po.id} />
						<label class="veld"><span>Naam</span><input name="naam" value={po.naam} /></label>
						<label class="veld">
							<span>Volgorde</span>
							<input name="volgorde" type="number" value={po.volgorde} />
						</label>
						<label class="regel" style="gap:0.5rem;margin-top:0.5rem">
							<input type="checkbox" name="actief" checked={po.actief} />
							<span class="detail">In gebruik</span>
						</label>
						<div class="knoppen">
							<button type="button" onclick={() => (bewerkt = null)}>Laat maar</button>
							<button class="primair">Opslaan</button>
						</div>
					</form>

					<form method="post" action="?/postWeg" use:enhance>
						<input type="hidden" name="id" value={po.id} />
						<div class="knoppen"><button>Verwijderen</button></div>
					</form>
				{:else}
					<div class="regel">
						<span class="dag">{po.naam}</span>
						{#if !po.actief}<Merk soort="afgemeld" tekst="niet in gebruik" />{/if}
					</div>
					<div class="knoppen">
						<button type="button" onclick={() => (bewerkt = po.id)}>Wijzigen</button>
					</div>
				{/if}
			</div>
		{/each}

		<form method="post" action="?/postToevoegen" use:enhance>
			<p class="regel" style="gap:0.5rem;flex-wrap:wrap;margin-top:0.6rem">
				<input name="naam" placeholder="Bus 5, Scooter 1…" />
				<input name="volgorde" type="number" placeholder="volgorde" style="max-width:8rem" />
				<button class="primair">Toevoegen</button>
			</p>
		</form>

		<p class="notitie">
			Verwijderen lukt alleen zolang er nog niets aan hangt. Zodra er diensten op hebben gestaan
			houdt de database het tegen — zet hem dan op "niet in gebruik". Hij verdwijnt dan uit alle
			keuzelijsten, maar oude weken blijven kloppen.
		</p>
	</div>

	<!-- ── Dienstsoorten ───────────────────────────────────────────── -->
	<div class="blok">
		<h2>Diensttijden</h2>

		{#each data.dienstsoorten as ds (ds.id)}
			<div class="kaart">
				{#if bewerkt === ds.id}
					<form
						method="post"
						action="?/soortWijzig"
						use:enhance={() => async ({ update }) => {
							await update();
							bewerkt = null;
						}}
					>
						<input type="hidden" name="id" value={ds.id} />
						<label class="veld"><span>Naam</span><input name="naam" value={ds.naam} /></label>
						<label class="veld">
							<span>Begint</span>
							<input name="begintijd" type="time" step="1800" value={ds.begintijd} />
						</label>
						<label class="veld">
							<span>Eindigt</span>
							<input name="eindtijd" type="time" step="1800" value={ds.eindtijd} />
						</label>
						<label class="regel" style="gap:0.5rem;margin-top:0.5rem">
							<input type="checkbox" name="actief" checked={ds.actief} />
							<span class="detail">In gebruik</span>
						</label>
						<div class="knoppen">
							<button type="button" onclick={() => (bewerkt = null)}>Laat maar</button>
							<button class="primair">Opslaan</button>
						</div>
					</form>

					<form method="post" action="?/soortWeg" use:enhance>
						<input type="hidden" name="id" value={ds.id} />
						<div class="knoppen"><button>Verwijderen</button></div>
					</form>
				{:else}
					<div class="regel">
						<span class="dag">{ds.naam}</span>
						<span class="detail tijden">{ds.begintijd} – {ds.eindtijd}</span>
					</div>
					<div class="regel" style="margin-top:0.2rem">
						{#if !ds.actief}<Merk soort="afgemeld" tekst="niet in gebruik" />{/if}
					</div>
					<div class="knoppen">
						<button type="button" onclick={() => (bewerkt = ds.id)}>Wijzigen</button>
					</div>
				{/if}
			</div>
		{/each}

		<form method="post" action="?/soortToevoegen" use:enhance>
			<p class="regel" style="gap:0.5rem;flex-wrap:wrap;margin-top:0.6rem">
				<input name="naam" placeholder="vroeg, laat, weekend…" />
				<input name="begintijd" type="time" step="1800" value="15:00" />
				<input name="eindtijd" type="time" step="1800" value="20:00" />
				<button class="primair">Toevoegen</button>
			</p>
		</form>

		<p class="notitie">
			Alleen hele en halve uren — dat dwingt de database af, want daar hangt de hele afrondregel
			aan. Tijden die je hier wijzigt gelden voor nieuwe diensten; wat al ingeroosterd staat houdt
			zijn eigen tijden, want een dienst is een momentopname.
		</p>
	</div>

	<!-- ── Mensen ──────────────────────────────────────────────────── -->
	<div class="blok">
		<h2>Wie er werkt</h2>

		{#each data.personen as p (p.id)}
			<div class="kaart">
				{#if bewerkt === p.id}
					<form
						method="post"
						action="?/persoonWijzig"
						use:enhance={() => async ({ update }) => {
							await update();
							bewerkt = null;
						}}
					>
						<input type="hidden" name="id" value={p.id} />
						<label class="veld"><span>Naam</span><input name="naam" value={p.naam} /></label>
						<label class="veld">
							<span>Rol</span>
							<select name="rol">
								<option value="medewerker" selected={p.rol === 'medewerker'}>Bezorger</option>
								<option value="beheerder" selected={p.rol === 'beheerder'}>Beheerder</option>
							</select>
						</label>
						<label class="regel" style="gap:0.5rem;margin-top:0.5rem">
							<input type="checkbox" name="actief" checked={p.actief} />
							<span class="detail">Werkt hier</span>
						</label>
						<div class="knoppen">
							<button type="button" onclick={() => (bewerkt = null)}>Laat maar</button>
							<button class="primair">Opslaan</button>
						</div>
					</form>
				{:else}
					<div class="regel">
						<span class="dag">{p.naam}</span>
						<span>
							{#if p.rol === 'beheerder'}<Merk soort="bevestigd" tekst="beheerder" />{/if}
							{#if !p.actief}<Merk soort="afgemeld" tekst="werkt hier niet meer" />{/if}
							{#if !p.auth_user_id}<Merk soort="achteraf" tekst="geen login" />{/if}
						</span>
					</div>
					<div class="knoppen">
						<button type="button" onclick={() => (bewerkt = p.id)}>Wijzigen</button>
					</div>

					{#if !p.auth_user_id && p.actief}
						<form method="post" action="?/loginAanmaken" use:enhance={naarDeMelding}>
							<input type="hidden" name="id" value={p.id} />
							<p class="regel" style="gap:0.5rem;flex-wrap:wrap;margin:0.5rem 0 0">
								<input name="email" type="email" placeholder="e-mailadres" />
								<button>Login aanmaken</button>
							</p>
						</form>
					{:else if p.auth_user_id}
						<form method="post" action="?/adresWijzig" use:enhance={naarDeMelding}>
							<input type="hidden" name="id" value={p.id} />
							<p class="regel" style="gap:0.5rem;flex-wrap:wrap;margin:0.5rem 0 0">
								<input
									name="email"
									type="email"
									value={data.adressen?.[p.auth_user_id] ?? ''}
								/>
								<button>Adres opslaan</button>
							</p>
						</form>
						<form method="post" action="?/nieuwWachtwoord" use:enhance={naarDeMelding}>
							<input type="hidden" name="id" value={p.id} />
							<div class="knoppen"><button>Nieuw wachtwoord</button></div>
						</form>
					{/if}
				{/if}
			</div>
		{/each}

		<form method="post" action="?/persoonToevoegen" use:enhance={naarDeMelding}>
			<p class="regel" style="gap:0.5rem;flex-wrap:wrap;margin-top:0.6rem">
				<input name="naam" placeholder="Naam" />
				<select name="rol">
					<option value="medewerker">Bezorger</option>
					<option value="beheerder">Beheerder</option>
				</select>
				<button class="primair">Toevoegen</button>
			</p>
		</form>

		<p class="notitie">
			Iemand gaat op "werkt hier niet meer", hij wordt niet verwijderd. Anders verdwijnt hij ook
			uit de weken waarin hij wél gereden heeft, en dan klopt geen enkel oud overzicht meer.
		</p>
		<p class="notitie">
			Wachtwoord kwijt? Druk op <strong>Nieuw wachtwoord</strong>. Het oude vervalt dan meteen en
			er komt een nieuw in beeld — ook hier weer één keer.
		</p>
		<p class="notitie">
			<strong>Geen login</strong> betekent dat iemand wel ingeroosterd kan worden maar zijn uren
			niet kan melden — en omdat niemand namens hem invult, komt hij dan ook nooit in de export.
			Vul een e-mailadres in en druk op "Login aanmaken": het wachtwoord komt één keer in beeld,
			jij geeft het door, zijn telefoon onthoudt het.
		</p>
	</div>
{/if}
