/*
  questo script serve a fare andare tutta la parte visiva e logica del carrello.
  in pratica prendo quello che c'e' salvato nel localstorage, sommo i prezzi di ogni
  singolo prodotto in base alle quantita scelte e alla fine mando la richiesta post
  al backend flask per creare l'ordine vero e proprio nel database.
*/

// tengo le funzioni separate per non fare confusione tra lettura e invio dati
function loadCart() {
    let cart = JSON.parse(localStorage.getItem("cart")) || [];
    const container = document.getElementById("cart-items");
    const summary = document.getElementById("cart-summary");
    
    // se mancano i contenitori nella pagina blocco tutto subito per evitare errori in console
    if (!container || !summary) return;

    // devo ripulire il div altrimenti ogni volta che aggiorno il carrello mi appende roba doppia
    container.innerHTML = "";

    // se l'array e' vuoto stampo il messaggio di avviso e levo il riepilogo col prezzo
    if (cart.length === 0) {
        container.innerHTML = "<p style='text-align: center; color: #888; padding: 20px;'>Il tuo carrello è vuoto.</p>";
        summary.innerHTML = "";
        return;
    }

    let total = 0;

    // ciclo ogni elemento presente nell'array per calcolare il totale e generare le card html
    cart.forEach((product, index) => {
        total += (product.prezzo * product.qty);
        
        const itemDiv = document.createElement("div");
        itemDiv.classList.add("cart-item");
        itemDiv.innerHTML = `
            <img src="${product.img}" alt="${product.nome}">
            <div class="cart-details">
                <h3>${product.nome}</h3>
                <p>€ ${product.prezzo.toFixed(2)} x ${product.qty}</p>
            </div>
            <!-- passo l'indice dell'array cosi la funzione sa quale riga eliminare -->
            <button class="btn-remove" onclick="removeItem(${index})">Rimuovi</button>
        `;
        container.appendChild(itemDiv);
    });

    // stampo a schermo il prezzo finale calcolato e il bottone per comprare
    summary.innerHTML = `
        <h2>Totale: € ${total.toFixed(2)}</h2>
        <button class="btn-buy" onclick="checkout()">Procedi all'acquisto</button>
    `;
}

// rimuove il singolo prodotto sfruttando l'indice dell'array e aggiorna lo storage
function removeItem(index) {
    let cart = JSON.parse(localStorage.getItem("cart")) || [];
    cart.splice(index, 1);
    localStorage.setItem("cart", JSON.stringify(cart));
    
    // richiamo subito loadCart per ridisegnare la lista aggiornata senza ricaricare la pagina
    loadCart();
}

// funzione asincrona che gestisce la comunicazione con le api di flask
async function checkout() {
    let cart = JSON.parse(localStorage.getItem("cart")) || [];
    if (cart.length === 0) return;

    try {
        // invio i dati del carrello in formato json all'endpoint /acquista
        const response = await fetch("/acquista", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ cart: cart })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // se l'acquisto va a buon fine svuoto la memoria locale e reindirizzo all'area utente
            alert("Acquisto completato con successo!");
            localStorage.removeItem("cart"); 
            window.location.href = "/dashboard_page"; 
        } else {
            // se il server risponde con un errore (per esempio utente non loggato) mostro il popup e mando al login
            alert("Attenzione: " + (result.error || "Devi effettuare l'accesso per acquistare."));
            window.location.href = "/login_page";
        }
    } catch(err) {
        // cattura eventuali problemi di connessione o server non raggiungibile
        console.error("Errore di rete durante il checkout:", err);
        alert("Ops, c'è stato un problema di connessione.");
    }
}

// aggancio la funzione principale al caricamento completo del dom
document.addEventListener("DOMContentLoaded", loadCart);