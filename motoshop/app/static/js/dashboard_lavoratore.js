/*
  appunti personali e diario di bordo - gestione magazzino (dashboard_lavoratore.js)
  ---------------------------------------------------------------------------------
  questo script mi serve per far funzionare il pannello riservato ai lavoratori del negozio.
  rispetto alla dashboard dell'amministratore qui non ho messo la parte di gestione utenti
  e ruoli, perche al dipendente interessa soltanto caricare la merce e controllare cosa c'e'
  a magazzino per eliminare i pezzi esauriti o non piu disponibili.
  
  durante le prove col backend flask ho risolto un paio di cose rognose:
  - all'avvio faccio partire subito loadInventory() col DOMContentLoaded senno toccava
    premere ogni volta un tasto per visualizzare il catalogo.
  - il form con la foto: provando a mandare un normale body json con stringify l'immagine
    non veniva serializzata e flask mi sputava errore 400. ho risolto usando FormData nativo,
    appendendo a mano nome, categoria, prezzo e descrizione e passando il riferimento
    files[0] sulla chiave 'img_file', cosi la chiamata viaggia pulita in multipart/form-data.
  - una volta inserito il pezzo con esito 200 resetto il form e ricarico subito la lista
    a destra con loadInventory(), cosi l'operatore vede immediatamente la riga creata.
  - per la rimozione ho tenuto il confirm() classico del browser perche testando dal
    portatile col touchpad capitava di cliccare elimina per sbaglio mentre scorrevo la vista.
*/

document.addEventListener("DOMContentLoaded", () => {
    // appena il browser completa il caricamento del dom popolo subito l'inventario
    loadInventory(); //[cite: 2]

    // Gestione del form di aggiunta prodotto (Colonna di sinistra)[cite: 2]
    const addForm = document.getElementById("add-product-form"); //[cite: 2]
    
    if (addForm) { //[cite: 2]
        addForm.addEventListener("submit", async (e) => { //[cite: 2]
            // blocco il refresh predefinito della pagina per gestire tutto asincrono
            e.preventDefault(); //[cite: 2]
            
            // mi serve formdata altrimenti il file binario della foto non viaggia verso flask
            const formData = new FormData(); //[cite: 2]
            formData.append("nome", document.getElementById("prod-name").value); //[cite: 2]
            formData.append("categoria", document.getElementById("prod-cat").value); //[cite: 2]
            formData.append("prezzo", document.getElementById("prod-price").value); //[cite: 2]
            formData.append("desc", document.getElementById("prod-desc").value); //[cite: 2]
            
            // controllo se l'utente ha scelto una foto prima di appenderla alla richiesta
            const fileInput = document.getElementById("prod-img-file"); //[cite: 2]
            if (fileInput.files.length > 0) { //[cite: 2]
                formData.append("img_file", fileInput.files[0]); //[cite: 2]
            }

            try {
                // post asincrona alla rotta flask per salvare il record a db
                const res = await fetch("/api/prodotti", { //[cite: 2]
                    method: "POST", //[cite: 2]
                    body: formData // passo direttamente formdata senza specificare header json[cite: 2]
                });
                
                const data = await res.json(); //[cite: 2]
                
                if (res.ok) { //[cite: 2]
                    alert(data.message || "Prodotto aggiunto al database!"); //[cite: 2]
                    addForm.reset(); // azzero i campi del form[cite: 2]
                    
                    // ricarico la vista a destra per mostrare subito il prodotto inserito
                    loadInventory(); //[cite: 2]
                } else {
                    alert("Ops, errore: " + (data.error || "Impossibile aggiungere il prodotto.")); //[cite: 2]
                }
            } catch (err) {
                // errore se il server flask in locale e' spento o non risponde
                console.error(err); //[cite: 2]
                alert("Errore di rete. Controlla che il server Flask sia acceso."); //[cite: 2]
            }
        });
    }
});

// funzione per tirare giu tutti i prodotti e generare le righe del catalogo
async function loadInventory() { //[cite: 2]
    const container = document.getElementById("catalog-inventory"); //[cite: 2]
    if (!container) return; // se non trova il div esce subito[cite: 2]

    try {
        // fetch get verso l'endpoint prodotti
        const res = await fetch('/api/prodotti'); //[cite: 2]
        if (res.ok) { //[cite: 2]
            const products = await res.json(); //[cite: 2]
            container.innerHTML = ""; // levo l'avviso di attesa iniziale[cite: 2]

            // controllo se non ci sono ancora prodotti registrati
            if (products.length === 0) { //[cite: 2]
                container.innerHTML = "<p style='color: #888;'>Nessun prodotto in catalogo.</p>"; //[cite: 2]
                return; //[cite: 2]
            }

            // ciclo i prodotti e creo le schede con stile scuro inline
            products.forEach(p => { //[cite: 2]
                const div = document.createElement("div"); //[cite: 2]
                
                // stili inline per evitare di creare classi aggiuntive nel foglio css principale
                div.style.backgroundColor = "#121212"; //[cite: 2]
                div.style.padding = "15px"; //[cite: 2]
                div.style.marginBottom = "10px"; //[cite: 2]
                div.style.borderRadius = "8px"; //[cite: 2]
                div.style.border = "1px solid #333"; //[cite: 2]
                div.style.display = "flex"; //[cite: 2]
                div.style.justifyContent = "space-between"; //[cite: 2]
                div.style.alignItems = "center"; //[cite: 2]

                // inserisco titolo, categoria, prezzo con 2 decimali e bottone elimina con id mongo
                div.innerHTML = `
                    <div>
                        <h4 style="color: #fff; margin-bottom: 5px;">${p.nome}</h4>
                        <p style="color: #aaa; font-size: 13px;">Cat: ${p.categoria} | Prezzo: €${parseFloat(p.prezzo).toFixed(2)}</p>
                    </div>
                    <button onclick="deleteProduct('${p._id}')" style="background-color: #ff4d4d; color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; font-weight: bold;">Elimina</button>
                `; //[cite: 2]
                container.appendChild(div); //[cite: 2]
            });
        } else {
            // se l'api restituisce uno status di errore
            container.innerHTML = "<p style='color: #ff4d4d;'>Impossibile caricare l'inventario dal server.</p>"; //[cite: 2]
        }
    } catch (err) {
        // errore di rete durante il recupero dei dati
        console.error("Errore nel caricamento dell'inventario:", err); //[cite: 2]
        container.innerHTML = "<p style='color: #ff4d4d;'>Errore di connessione.</p>"; //[cite: 2]
    }
}

// funzione per eliminare il singolo articolo selezionato tramite id
async function deleteProduct(id) { //[cite: 2]
    // popup di conferma per evitare cancellazioni involontarie se scappa il dito dal touchpad
    if (!confirm("Sei veramente sicuro di voler eliminare questo prodotto dal catalogo?")) return; //[cite: 2]

    try {
        // richiesta delete verso l'endpoint passando l'id nell'url
        const res = await fetch('/api/prodotti/' + id, { method: 'DELETE' }); //[cite: 2]
        const data = await res.json(); //[cite: 2]
        
        if (res.ok) { //[cite: 2]
            alert("Prodotto rimosso con successo!"); //[cite: 2]
            
            // rinfresco l'inventario per togliere l'elemento senza dover ricaricare la pagina con f5
            loadInventory(); //[cite: 2]
        } else {
            alert("Errore: " + (data.error || "Impossibile eliminare.")); //[cite: 2]
        }
    } catch (err) {
        // gestione errore durante la cancellazione
        console.error(err); //[cite: 2]
        alert("Errore di connessione."); //[cite: 2]
    }
}