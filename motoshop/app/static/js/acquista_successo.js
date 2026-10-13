/*
  script per gestire il riepilogo dopo aver comprato/aggiunto la roba al carrello.
  in pratica prendo tutto dai parametri nell'url solo per stamparli a schermo, 
  tanto l'aggiornamento vero e proprio del carrello è già avvenuto prima di arrivare qui.
*/

document.addEventListener("DOMContentLoaded", () => {
    // tiro fuori i parametri passati con la query string
    const params = new URLSearchParams(window.location.search);
    
    // se per qualche motivo manca il nome (tipo url aperto a mano o ricaricato male),
    // inutile mostrare la pagina vuota: rimando subito indietro al catalogo
    if (!params.get("nome")) {
        window.location.href = "/p/CatalogoUniversale.html";
        return;
    }

    // assemblo l'oggetto con le info del prodotto preso dall'url
    // converto il prezzo a float altrimenti toFixed poi spacca tutto se rimane stringa
    const product = {
        nome: params.get("nome"),
        desc: params.get("desc"),
        prezzo: parseFloat(params.get("prezzo")),
        img: params.get("img")
    };

    // vado a prendere il container dove buttare dentro la grafica
    const infoContainer = document.getElementById("product-info");
    if (infoContainer) {
        // creo la scheda con immagine, titolo, descrizione e prezzo formattato con 2 decimali
        infoContainer.innerHTML = `
            <img src="${product.img}" alt="${product.nome}">
            <h3>${product.nome}</h3>
            <p style="color: #cccccc; font-size: 14px; margin-top: 10px;">${product.desc}</p>
            <h2 style="color: #ff4d4d; margin-top: 15px;">€ ${product.prezzo.toFixed(2)}</h2>
        `;
    }
});