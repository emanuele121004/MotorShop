/*
  APPUNTI DI SVILUPPO - AREA PERSONALE CLIENTE (dashboard_cliente.js)
  --------------------------------------------------------------------------
  questo script serve a gestire il pannello del profilo utente e lo storico ordini.
  invece di iniettare variabili jinja direttamente nel codice javascript (cosa che
  nei template html crea solo pasticci di sintassi e problemi con i linter), ho preferito
  passare i dati della sessione tramite data-attributes nel div container dell'html.
  
  alcuni passaggi pratici da ricordare:
  - all'avvio leggo subito l'oggetto dataset dal div dashboard-data. se l'email e' vuota
    o la sessione flask e' scaduta rimando subito al login con window.location.href,
    cosi blocco accessi non autorizzati lato client prima ancora di mostrare la vista.
  - per l'avatar circolare prendo la prima lettera del nome e la forzo in maiuscolo
    con toUpperCase(), evitando di dover caricare immagini di default pesanti.
  - gli ordini vengono tirati giu con una get dedicata (/api/miei-ordini) che restituisce
    solo i record associati all'utente loggato. se l'array e' vuoto stampo il testo grigio
    di avviso, altrimenti ciclo e formatto data, quantita', taglia e prezzo con toFixed(2).
*/

document.addEventListener("DOMContentLoaded", () => {
    // Cerco il main container dove ho "nascosto" i dati di sessione
    const dashboardElement = document.getElementById("dashboard-data");
    if (!dashboardElement) return;

    // dataset mi converte automaticamente data-nome in sessionData.nome
    const sessionData = dashboardElement.dataset;

    // Controllo di sicurezza: se c'è un'email vuol dire che è loggato
    if (sessionData.email) {
        // Stampo nome e cognome nella sidebar
        document.getElementById("sidebar-name").textContent = `${sessionData.nome} ${sessionData.cognome}`;
        document.getElementById("sidebar-email").textContent = sessionData.email;
        
        // Trucchetto per prendere solo la prima lettera del nome e farla maiuscola per l'avatar
        document.getElementById("user-initials").textContent = sessionData.nome.charAt(0).toUpperCase();
        
        // Ora che ho caricato l'interfaccia, vado a pescare gli ordini dal database
        loadCustomerOrders();
    } else {
        // Se non trovo l'email, caccio l'utente e lo rimando al login
        window.location.href = "/login_page";
    }
});

async function loadCustomerOrders() {
    const container = document.getElementById("orders-container");
    try {
        // Chiamo la rotta Flask che mi restituisce solo gli ordini di QUESTO utente
        const res = await fetch('/api/miei-ordini');
        
        if (res.ok) {
            const data = await res.json();
            container.innerHTML = ""; // Tolgo il testo di caricamento

            // Se l'array degli ordini è vuoto
            if (!data.ordini || data.ordini.length === 0) {
                container.innerHTML = "<p style='color: #aaa; text-align: center; padding: 20px;'>Non hai ancora effettuato alcun ordine. Visita il catalogo per iniziare!</p>";
                return;
            }

            // Creo una riga per ogni ordine trovato
            data.ordini.forEach(ord => {
                const div = document.createElement("div");
                div.classList.add("order-card");
                
                // Formatto i dati dell'ordine in HTML. Se la taglia non c'è, scrivo 'Unica'
                div.innerHTML = `
                    <div class="order-info">
                        <h4>${ord.nome_prodotto}</h4>
                        <p>Taglia: <b>${ord.taglia || 'Unica'}</b> | Q.tà: ${ord.quantita}</p>
                        <small style="color: #888;">Ordinato il: ${ord.timestamp}</small>
                    </div>
                    <div class="order-price">
                        <span>€ ${parseFloat(ord.totale).toFixed(2)}</span>
                        <small style="color: #00ffcc;">Completato</small>
                    </div>
                `;
                container.appendChild(div);
            });
        }
    } catch (err) {
        console.error("Errore fetch ordini", err);
        container.innerHTML = "<p style='color: #ff4d4d; text-align: center; padding: 20px;'>Errore nel caricamento degli ordini.</p>";
    }
}