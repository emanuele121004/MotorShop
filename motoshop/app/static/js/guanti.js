/*
  MODULO CARICAMENTO CATALOGO GUANTI (guanti.js)
  -----------------------------------------------------------------------------
  Script frontend per agganciare i dati dei guanti restituiti dal server
  e iniettarli dinamicamente nella griglia HTML della pagina dedicata.
  
  Funzionamento generale:
  1. Attesa del caricamento completo del DOM per evitare che l'elemento container
     risulti nullo al momento della ricerca con getElementById.
  2. Chiamata asincrona via fetch verso l'endpoint locale /api/prodotti.
  3. Filtraggio lato client per estrarre solo gli articoli la cui categoria
     contiene la stringa 'guanto' o 'guanti' (con controllo case-insensitive).
  4. Generazione dinamica dei tag <a> con le classi CSS della card e redirect
     alla vista del dettaglio passando l'ID dell'articolo come query param.
  -----------------------------------------------------------------------------
*/

document.addEventListener("DOMContentLoaded", async () => {
    // Cerco il div che fa da griglia per le card dei guanti
    const container = document.getElementById("product-container");
    if (!container) return; // Se per sbaglio lo script e' importato altrove esco subito

    try {
        // Chiamata REST per prelevare il catalogo completo memorizzato nel database
        const res = await fetch('/api/prodotti');
        if (res.ok) {
            const products = await res.json();
            
            /*
              Filtro solo per i guanti:
              Controllo sia la dicitura al singolare che al plurale convertendo
              prima in minuscolo, cosi da evitare problemi con inserimenti manuali
              fatti dal gestionale con caratteri misti (es. Guanti, GUANTO).
            */
            const guanti = products.filter(p => 
                p.categoria.toLowerCase().includes('guanto') || 
                p.categoria.toLowerCase().includes('guanti')
            );

            // Svuoto il container prima di renderizzare per eliminare eventuali placeholder
            container.innerHTML = ""; 

            // Se la query non restituisce nulla mostro un messaggio neutro centrato
            if (guanti.length === 0) {
                container.innerHTML = "<p style='color: #888; text-align: center; width: 100%;'>Nessun guanto disponibile al momento.</p>";
                return;
            }

            // Ciclo l'array filtrato e appendo la struttura della scheda prodotto
            guanti.forEach(p => {
                container.innerHTML += `
                    <a href="/p/Dettaglio_prodotto.html?id=${p._id}" class="card" style="text-decoration: none;">
                        <img src="${p.img}" alt="${p.nome}">
                        <h3>${p.nome}</h3>
                        <span class="price">€ ${parseFloat(p.prezzo).toFixed(2)}</span>
                        <span class="btn-buy" style="margin-top: auto;">Vedi Dettagli</span>
                    </a>
                `;
            });
        }
    } catch (err) {
        // Traccio l'errore di rete nella console e avviso l'utente con testo evidenziato in rosso
        console.error("Errore fetch:", err);
        container.innerHTML = "<p style='color: #ff4d4d; text-align: center; width: 100%;'>Errore nel caricamento dei prodotti.</p>";
    }
});