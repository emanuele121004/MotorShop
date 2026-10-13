/*
  script per la pagina dedicata ai caschi.
  invece di fare una rotta backend per ogni categoria, tiro giu l'intero elenco
  dei prodotti da /api/prodotti e poi filtro via frontend tenendo solo i caschi,
  cosi tengo l'api di flask piu snella e riutilizzabile.
*/

document.addEventListener("DOMContentLoaded", async () => {
    try {
        // richiesta get per scaricare il catalogo completo dal backend
        const res = await fetch('/api/prodotti');
        
        if (res.ok) {
            const products = await res.json();
            const container = document.getElementById("product-container");
            container.innerHTML = ""; // levo il testo o il loader iniziale prima di iniettare le card

            // filtro l'array per prendere sia 'casco' che 'caschi'
            // trasformo tutto in minuscolo prima del controllo senno rischio di perdere prodotti per problemi di maiuscole
            const caschi = products.filter(p => 
                p.categoria.toLowerCase().includes("casco") || 
                p.categoria.toLowerCase().includes("caschi")
            );

            // caso limite: se la lista filtrata e' vuota mostro il messaggio informativo
            if (caschi.length === 0) {
                container.innerHTML = "<p style='color: #888; text-align: center; width: 100%;'>Nessun casco disponibile al momento.</p>";
                return;
            }

            // itero sui caschi rimasti e assemblo la card html per ognuno
            caschi.forEach(product => {
                const card = document.createElement("div");
                card.classList.add("card");
                
                // nei link passo l'id del singolo prodotto come parametro url per aprire la pagina di dettaglio
                card.innerHTML = `
                    <a href="/p/dettaglio_prodotto.html?id=${product._id}" style="text-decoration: none; color: inherit;">
                        <img src="${product.img}" alt="${product.nome}">
                        <h3>${product.nome}</h3>
                        <span class="price">€ ${parseFloat(product.prezzo).toFixed(2)}</span>
                    </a>
                    <div style="margin-top: 15px;">
                        <a class="btn-buy" href="/p/dettaglio_prodotto.html?id=${product._id}">Visualizza Dettagli</a>
                    </div>
                `;
                container.appendChild(card);
            });
        }
    } catch (err) {
        // traccio l'errore in console se la fetch fallisce o se flask non risponde
        console.error("Errore nel caricamento dei caschi:", err);
    }
});