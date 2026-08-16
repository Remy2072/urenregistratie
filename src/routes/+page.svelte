<script lang="ts">
	import { NU } from '$lib/nepdata';
	import { dagNaam, datumLang } from '$lib/tijd';
</script>

<div class="blok">
	<p>
		Dit is het prototype uit fase 0. Er zit geen database achter en er wordt niets bewaard: ververs
		de pagina en alles staat weer zoals het was. Het is bedoeld om te laten zien wat de drie mensen
		in dit verhaal straks te zien krijgen.
	</p>
	<p class="notitie">
		De app doet alsof het <strong>{dagNaam(NU.datum)} {datumLang(NU.datum)}, {NU.tijd}</strong> is.
		Midden in de week, na sluitingstijd — dan staat er op elk scherm iets te gebeuren.
	</p>
</div>

<div class="blok">
	<h2>De drie schermen</h2>

	<a class="kaart" href="/mijn-week" style="display:block; text-decoration:none">
		<div class="regel">
			<span class="dag">Bezorger</span>
			<span class="detail">Mijn week</span>
		</div>
		<p class="detail" style="margin:0.4rem 0 0">
			Je eigen diensten. Eén tik als je gedraaid hebt zoals gepland, knoppen als het langer werd. De
			maandag die je vergeten bent staat er nog steeds, en kun je nu alsnog invullen.
		</p>
	</a>

	<a class="kaart" href="/overzicht" style="display:block; text-decoration:none">
		<div class="regel">
			<span class="dag">Baas</span>
			<span class="detail">Weekoverzicht</span>
		</div>
		<p class="detail" style="margin:0.4rem 0 0">
			Bovenaan alleen wat aandacht nodig heeft: afwijkingen met het verschil erbij, achteraf gemelde
			diensten en diensten waar niemand iets mee gedaan heeft. De rest hoeft hij niet te bekijken.
		</p>
	</a>

	<a class="kaart" href="/export" style="display:block; text-decoration:none">
		<div class="regel">
			<span class="dag">Boekhouder</span>
			<span class="detail">Export</span>
		</div>
		<p class="detail" style="margin:0.4rem 0 0">
			Alleen bevestigde diensten, alleen uren, nooit euro's. Precies de kolommen die de database ook
			teruggeeft.
		</p>
	</a>
</div>

<div class="blok">
	<h2>Wat hier nog niet in zit</h2>
	<p class="detail">
		Inloggen, een echte database, het uitrollen van het weekrooster en het bepalen van het
		exportformaat. Dat zijn fase 1 tot en met 6. Wat er wél al staat is de vorm van de gegevens: die
		is gelijk aan <code>schema.sql</code>, zodat deze schermen straks alleen een andere bron krijgen
		en niet opnieuw gebouwd hoeven worden.
	</p>
</div>
