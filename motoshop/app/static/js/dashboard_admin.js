/*
  appunti al volo sul controller dell'admin:
  in questo script ho preferito tenere insieme sia la gestione utenti sia il magazzino dei prodotti.
  all'inizio avevo mezza idea di sdoppiare tutto su due pagine html separate, ma provando i flussi col server flask
  in locale perdevo troppo tempo a ricaricare ogni volta per vedere se le modifiche andavano a buon fine.
  cosi ho accorpato tutto qui e buonanotte.
  
  alcune cose da tenere a mente se ci rimetto mano:
  - all'avvio (appena scatta il domcontentloaded) tiro giu subito sia gli utenti che i prodotti.
    se la sessione e' scaduta o uno non e' admin, flask risponde picche (401/403) e invece di far
    spaccare la console ci scrivo al volo dentro "Accesso negato" col testo rosso.
  - il form di inserimento mi ha fatto impazzire per colpa dell'immagine: se provavo a spedire tutto
    come json normale con fetch il file si perdeva perche non si serializza. alla fine ho risolto
    usando FormData nativo appendendo i campi a mano e passando direttamente il binario (files[0]),
    altrimenti flask non prendeva il multipart e dava errore.
  - per la cancellazione lascio il confirm() nativo del browser senno col trackpad del portatile
    rischiavo di cliccare per sbaglio il tasto elimina mentre scorrevo l'elenco dei prodotti.
*/

document.addEventListener("DOMContentLoaded", () => {
    // lancio subito le due get per riempire la vista
    loadUsers();
    loadInventory();

    const addForm = document.getElementById("add-product-form");
    if (addForm) {
        addForm.addEventListener("submit", async (e) => {
            // fermo il reload automatico della pagina senno la chiamata fetch si interrompe subito
            e.preventDefault();
            
            // mi serve formdata altrimenti il file dell'immagine non arriva al backend
            const formData = new FormData();
            formData.append("nome", document.getElementById("prod-name").value);
            formData.append("categoria", document.getElementById("prod-cat").value);
            formData.append("prezzo", document.getElementById("prod-price").value);
            formData.append("desc", document.getElementById("prod-desc").value);
            
            // controllo se e' stato selezionato un file prima di appenderlo alla richiesta
            const fileInput = document.getElementById("prod-img-file");
            if (fileInput.files.length > 0) {
                formData.append("img_file", fileInput.files[0]);
            }

            try {
                // invio i dati alla rotta post su flask
                const res = await fetch("/api/prodotti", {
                    method: "POST",
                    body: formData
                });
                const data = await res.json();
                
                if (res.ok) {
                    alert(data.message || "Prodotto aggiunto al catalogo con successo!");
                    addForm.reset();
                    // ricarico subito la lista senza costringere a fare refresh manuale
                    loadInventory();
                } else {
                    alert("Errore: " + (data.error || "Impossibile aggiungere il prodotto."));
                }
            } catch (err) {
                // se salta la connessione al backend flask
                console.error("Errore fetch inserimento:", err);
                alert("Errore di connessione al server.");
            }
        });
    }
});

// funzione per tirare giu tutti gli utenti registrati
async function loadUsers() {
    const container = document.getElementById("users-list");
    if (!container) return; 

    try {
        const res = await fetch('/api/admin/utenti');
        
        if (res.ok) {
            const data = await res.json();
            container.innerHTML = ""; // levo la scritta di attesa iniziale

            if (!data.utenti || data.utenti.length === 0) {
                container.innerHTML = "<p style='color: #888;'>Nessun utente registrato.</p>";
                return;
            }

            // ciclo gli account e cambio colore al badge in base al ruolo
            data.utenti.forEach(u => {
                let badgeClass = "role-cliente";
                if (u.role === "admin") badgeClass = "role-admin";
                if (u.role === "lavoratore") badgeClass = "role-lavoratore";

                const div = document.createElement("div");
                div.classList.add("user-card");
                // template string con nome cognome e mail
                div.innerHTML = `
                    <div>
                        <h4 style="color: #fff; margin-bottom: 5px;">${u.nome} ${u.cognome}</h4>
                        <p style="color: #aaa; font-size: 14px;">${u.email}</p>
                    </div>
                    <span class="role-badge ${badgeClass}">${u.role}</span>
                `;
                container.appendChild(div);
            });
        } else {
            // se non si e' loggati con permessi admin flask risponde 401 o 403
            container.innerHTML = "<p style='color: #ff4d4d;'>Accesso negato. Area riservata all'Admin.</p>";
        }
    } catch (err) {
        console.error("Errore fetch utenti:", err);
        container.innerHTML = "<p style='color: #ff4d4d;'>Errore di connessione al server.</p>";
    }
}

// recupero di tutti i prodotti in vendita dal db
async function loadInventory() {
    const container = document.getElementById("catalog-inventory");
    if (!container) return;

    try {
        // chiamata get all'endpoint del catalogo
        const res = await fetch('/api/prodotti');
        if (res.ok) {
            const products = await res.json();
            container.innerHTML = "";

            if (products.length === 0) {
                container.innerHTML = "<p style='color: #888;'>Nessun prodotto in catalogo.</p>";
                return;
            }

            // genero le righe dei prodotti con un po' di stile inline al volo per non toccare il css
            // uso flexbox per tenere nome/prezzo a sinistra e il bottone elimina a destra
            products.forEach(p => {
                const div = document.createElement("div");
                div.style.backgroundColor = "#121212";
                div.style.padding = "15px";
                div.style.marginBottom = "10px";
                div.style.borderRadius = "8px";
                div.style.border = "1px solid #333";
                div.style.display = "flex";
                div.style.justifyContent = "space-between";
                div.style.alignItems = "center";

                // passo direttamente l'id mongo al click del bottone elimina
                div.innerHTML = `
                    <div>
                        <h4 style="color: #fff; margin-bottom: 5px;">${p.nome}</h4>
                        <p style="color: #aaa; font-size: 13px;">Cat: ${p.categoria} | Prezzo: €${parseFloat(p.prezzo).toFixed(2)}</p>
                    </div>
                    <button onclick="deleteProduct('${p._id}')" style="background-color: #ff4d4d; color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; font-weight: bold;">Elimina</button>
                `;
                container.appendChild(div);
            });
        } else {
            container.innerHTML = "<p style='color: #ff4d4d;'>Impossibile caricare l'inventario.</p>";
        }
    } catch (err) {
        // se flask non risponde o la rotta da 500
        console.error("Errore fetch inventario:", err);
        container.innerHTML = "<p style='color: #ff4d4d;'>Errore di connessione.</p>";
    }
}

// cancellazione del singolo articolo
async function deleteProduct(id) {
    // popup di sicurezza per evitare click a vuoto durante lo scroll
    if (!confirm("Sei sicuro di voler eliminare definitivamente questo prodotto dal catalogo?")) return;

    try {
        // chiamo la delete passando l'id nell'url
        const res = await fetch('/api/prodotti/' + id, { method: 'DELETE' });
        const data = await res.json();
        
        if (res.ok) {
            alert("Prodotto eliminato con successo!");
            loadInventory(); // riaggiorno subito l'elenco a video senza ricaricare la pagina
        } else {
            alert("Errore: " + (data.error || "Impossibile eliminare."));
        }
    } catch (err) {
        // se salta la connessione durante la rimozione
        console.error("Errore eliminazione:", err);
        alert("Errore di connessione.");
    }
}