/*
  MODULO CARICAMENTO CATALOGO GIACCHE (giacche.js)
  -----------------------------------------------------------------------------
  Script frontend per la gestione asincrona del catalogo dedicato all'abbigliamento.
  Si occupa di interrogare l'API interna dei prodotti, filtrare solo le giacche
  da moto e generare dinamicamente le schede HTML all'interno della griglia.
  
  Passaggi chiave:
  1. Ascolto dell'evento DOMContentLoaded per agganciare in sicurezza il nodo HTML.
  2. Esecuzione della richiesta asincrona tramite fetch verso /api/prodotti.
  3. Filtraggio lato client sul campo categoria con confronto case-insensitive
     (intercettando sia 'giacca' che 'giacche' per evitare incongruenze di inserimento).
  4. Rendering delle card con immagine, titolo, prezzo formattato a due decimali
     e collegamento ipertestuale alla vista Dettaglio_prodotto con parametro id.
  -----------------------------------------------------------------------------
*/

document.addEventListener("DOMContentLoaded", async () => {
    // Individuo il wrapper principale in cui verranno iniettate le card delle giacche
    const container = document.getElementById("product-container");
    if (!container) return; // Interrompo l'esecuzione se il container non e' presente nel DOM

    try {
        // Richiesta HTTP per recuperare l'elenco completo dei prodotti dal database
        const res = await fetch('/api/prodotti');
        if (res.ok) {
            const products = await res.json();
            
            /*
              Filtro solo per le giacche:
              Normalizzo il testo in minuscolo e verifico sia la forma singolare che
              quella plurale, coprendo eventuali variazioni nei tag del gestionale.
            */
            const giacche = products.filter(p => 
                p.categoria.toLowerCase().includes('giacca') || 
                p.categoria.toLowerCase().includes('giacche')
            );

            // Resetto il contenuto preesistente del container prima di inserire i nuovi elementi
            container.innerHTML = ""; 

            // Se il filtro restituisce un array vuoto mostro un avviso testuale centrato
            if (giacche.length === 0) {
                container.innerHTML = "<p style='color: #888; text-align: center; width: 100%;'>Nessuna giacca disponibile al momento.</p>";
                return;
            }

            // Iterazione su ogni articolo trovato per costruire la relativa card di anteprima
            giacche.forEach(p => {
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
        // Log dell'eccezione nella console di debug e notifica visiva d'errore all'utente
        console.error("Errore fetch:", err);
        container.innerHTML = "<p style='color: #ff4d4d; text-align: center; width: 100%;'>Errore nel caricamento dei prodotti.</p>";
    }
});