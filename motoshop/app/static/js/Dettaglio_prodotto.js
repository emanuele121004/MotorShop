/*
  DIARIO DI SVILUPPO E LOGICA APPLICATIVA - MOTOSHOP (Dettaglio_prodotto.js)
  =================================================================================
  File frontend dedicato alla gestione della pagina di scheda prodotto singola.
  Questo modulo riceve l'ID del componente dall'URL, interroga il database tramite
  endpoint API e renderizza l'interfaccia con selettori di taglia e quantita.
  
  Note di implementazione e risoluzione delle criticita:
  
  1. Parsing dei parametri dell'indirizzo:
     L'accesso alla pagina puo avvenire direttamente da link esterno o tramite click
     sulle card del catalogo. Per gestire la query string in modo sicuro si sfrutta
     URLSearchParams leggendo la chiave "id". Nel caso in cui il parametro risulti nullo
     o non definito, l'utente viene immediatamente reindirizzato alla vista generale
     del catalogo (/p/CatalogoUniversale.html) per evitare di mostrare un template vuoto.
  
  2. Recupero asincrono e casting degli identificatori:
     I prodotti vengono prelevati tramite chiamata fetch all'endpoint /api/prodotti.
     Poiche gli identificatori univoci a database (_id) possono essere restituiti sia
     sotto forma di stringa esadecimale sia come oggetti ObjectId serializzati, e' stato
     necessario applicare String(p._id) === String(productId). Senza questa conversione
     esplicita, il confronto stretto falliva sistematicamente in alcuni scenari di test.
  
  3. Costruzione dinamica del blocco visivo:
     Una volta individuato l'oggetto corrispondente in memoria, viene assemblata la
     struttura HTML contenente l'anteprima fotografica, il nome del modello, il prezzo
     formattato a due cifre decimali, la descrizione estesa e due elementi interattivi:
     il menu di selezione della taglia (S, M, L, XL con default su M) e l'input numerico
     per la quantita desiderata (limitato tra 1 e 99 per impedire valori negativi).
  
  4. Gestione dello storage del carrello e aggregazione duplicati:
     All'attivazione del pulsante di acquisto, l'articolo viene salvato localmente nel
     localStorage sotto la chiave "cart". Prima dell'inserimento viene eseguita una scansione
     per verificare se un elemento con lo stesso nome e la medesima taglia sia gia presente:
     in caso positivo, la quantita selezionata viene sommata a quella esistente, evitando
     la creazione di righe duplicate disordinate nel riepilogo dell'ordine.
  
  5. Risoluzione della race condition sul caricamento del DOM:
     In ambienti di rete lenti o con caricamento differito degli script, l'evento classico
     DOMContentLoaded rischiava di essere emesso prima che il listener venisse registrato.
     Per garantire l'esecuzione deterministica, si controlla lo stato document.readyState:
     se il browser sta ancora effettuando il parsing ('loading') ci si aggancia all'evento,
     altrimenti la funzione di bootstrap viene invocata immediatamente.
  =================================================================================
*/

// Riferimento in memoria al prodotto selezionato per le successive operazioni di checkout
let currentProduct = null;

async function loadProductDetail() {
    // Lettura dei parametri presenti nell'URL della schermata aperta
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get("id");
    const container = document.getElementById("product-detail");

    // Uscita di sicurezza se la pagina non possiede il contenitore target
    if (!container) return; 

    // Redirect immediato se l'utente naviga la pagina privo di parametro id valido
    if (!productId) {
        window.location.href = "/p/CatalogoUniversale.html";
        return;
    }

    try {
        // Chiamata REST per il recupero dei dati completi dei prodotti
        const res = await fetch('/api/prodotti');
        if (res.ok) {
            const products = await res.json();
            
            /*
              Confronto degli identificatori:
              Uso String() per normalizzare entrambi i valori ed evitare fallimenti
              del confronto rigoroso causati da differenze tra tipi di dato.
            */
            currentProduct = products.find(p => String(p._id) === String(productId));

            // Notifica visiva nel caso in cui l'ID non corrisponda a nessun record a database
            if (!currentProduct) {
                container.innerHTML = "<p style='color: #ff4d4d; text-align: center;'>Prodotto non trovato.</p>";
                return;
            }

            // Assemblaggio e iniezione della struttura visiva della scheda articolo
            container.innerHTML = `
                <div class="detail-image">
                    <img src="${currentProduct.img}" alt="${currentProduct.nome}">
                </div>
                <div class="detail-info">
                    <h1>${currentProduct.nome}</h1>
                    <span class="price">€ ${parseFloat(currentProduct.prezzo).toFixed(2)}</span>
                    <p><b>Descrizione Tecnica:</b><br>${currentProduct.desc}</p>
                    
                    <div class="size-selector">
                        <label>Seleziona Taglia:</label>
                        <select id="product-size" style="padding: 10px; border-radius: 8px; background: #121212; color: white; border: 1px solid #444; width: 100px; font-size: 16px;">
                            <option value="S">S</option>
                            <option value="M" selected>M</option>
                            <option value="L">L</option>
                            <option value="XL">XL</option>
                        </select>
                    </div>

                    <div class="size-selector" style="margin-top: 15px;">
                        <label>Quantità:</label>
                        <input type="number" id="product-qty" value="1" min="1" max="99" style="padding: 10px; border-radius: 8px; background: #121212; color: white; border: 1px solid #444; width: 100px; font-size: 16px;">
                    </div>

                    <button class="btn-buy" id="add-to-cart-btn" style="margin-top: 20px;">Aggiungi al Carrello</button>
                </div>
            `;

            // Collegamento dell'evento di aggiunta al carrello sul pulsante generato dinamicamente
            const btn = document.getElementById("add-to-cart-btn");
            if (btn) {
                btn.addEventListener("click", addToCart);
            }
        }
    } catch (err) {
        // Gestione degli errori di connessione con stampa su console e messaggio d'avviso
        console.error("Errore caricamento dettagli", err);
        container.innerHTML = "<p style='color: #ff4d4d; text-align: center;'>Errore di connessione col server.</p>";
    }
}

// Logica per serializzare l'acquisto nel carrello locale e instradare al flusso di pagamento
function addToCart() {
    if (!currentProduct) return;

    // Estrazione dei dati impostati nei campi di input
    const size = document.getElementById("product-size").value;
    const quantity = parseInt(document.getElementById("product-qty").value) || 1;
    
    // Inizializzazione o recupero dell'array del carrello salvato nello storage
    let cart = JSON.parse(localStorage.getItem("cart")) || [];
    
    // Definizione dell'oggetto articolo standardizzato
    const cartItem = {
        nome: currentProduct.nome,
        desc: currentProduct.desc,
        prezzo: parseFloat(currentProduct.prezzo),
        img: currentProduct.img,
        size: size,
        qty: quantity
    };

    /*
      Controllo delle righe duplicate:
      Se l'articolo con la stessa taglia e' gia presente si somma la nuova quantita,
      altrimenti viene inserito un elemento distinto in coda alla lista.
    */
    const existing = cart.find(p => p.nome === cartItem.nome && p.size === cartItem.size);
    
    if (existing) {
        existing.qty += quantity;
    } else {
        cart.push(cartItem);
    }

    // Salvataggio dello stato serializzato nel localStorage del browser
    localStorage.setItem("cart", JSON.stringify(cart));
    
    // Impostazione dei parametri di query per la schermata di riepilogo
    const params = new URLSearchParams({
        nome: currentProduct.nome,
        desc: currentProduct.desc,
        prezzo: currentProduct.prezzo,
        img: currentProduct.img
    }).toString();
    
    // Reindirizzamento alla schermata di checkout
    window.location.href = `/p/acquista.html?${params}`;
}

/*
  Inizializzazione robusta per prevenire race conditions:
  Se il documento e' ancora in fase di caricamento attende DOMContentLoaded,
  altrimenti se il parsing e' terminato esegue direttamente la routine.
*/
if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", loadProductDetail);
} else {
    loadProductDetail();
}