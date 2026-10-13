"""
RELAZIONE DI PROGETTO E SPECIFICHE BACKEND - MOTOSHOP (PARTE 1)
File sorgente: app.py (Inizializzazione, Connessioni, Routing e Autenticazione)
================================================================================
Modulo centrale dell'application server WSGI basato su micro-framework Flask.
Questa prima sezione definisce il bootstrap del servizio, la persistenza su
database MongoDB non relazionale, il routing di base e la gestione sicura del
ciclo di vita delle sessioni utente.

NOTE DI SVILUPPO E SCELTE ARCHITETTURALI:

1. Modello dati flessibile con PyMongo:
   Per il catalogo di un e-commerce motociclistico (caschi, giacche, accessori)
   la variabilita degli attributi e' elevata. L'uso di MongoDB semplifica la
   memorizzazione di documenti JSON senza l'obbligo di schemi rigidi o migrazioni.
   E' stato configurato un timeout di serverSelectionTimeoutMS a 2000ms: durante
   i primi test in locale capitava spesso che il demone mongod non fosse ancora
   avviato in background, portando il processo Flask a bloccarsi indefinitamente
   in attesa di una risposta; con questa soglia temporale l'errore emerge subito
   nel terminale consentendo un riavvio rapido del servizio.
   Sulla collection 'utenti' e' stato creato a livello di codice un indice univoco
   sul campo email, delegando direttamente al motore del database il compito di
   bloccare alla radice qualsiasi tentativo di registrazione duplicata senza dover
   eseguire query manuali ridondanti di pre-controllo.

2. Politiche RBAC (Role-Based Access Control) e salvataggio password:
   Per scongiurare falle di privilege escalation, il form pubblico di registrazione
   forza in modo deterministico e univoco il ruolo 'cliente'. Gli account ad alto
   privilegio ('admin' e 'lavoratore') non possono registrarsi dall'interfaccia
   pubblica, ma vengono generati direttamente durante il bootstrap del server.
   Le credenziali non transitano mai in chiaro verso la base dati: le password
   vengono cifrate con l'algoritmo PBKDF2:SHA256 fornito dal modulo security di
   werkzeug (con salt casuale per ogni record), mentre i cookie di sessione
   client-side sono firmati crittograficamente tramite la chiave segreta (secret_key)
   impostata a livello di istanza applicativa.
   In aggiunta, tutte le stringhe email vengono normalizzate con .strip().lower()
   per impedire che discrepanze di maiuscole/minuscole creino disallineamenti di accesso.

3. Tracciamento accessi, gestione stati e routing template:
   A ogni richiesta di login o logout andata a buon fine viene inserito un record
   storico nella collection 'accessi' con timestamp UTC, aggiornando contestualmente
   i campi last_login, last_logout e il flag booleano is_online sul documento utente.
   Anche i tentativi falliti vengono registrati con azione 'login_failed' per avere
   un log chiaro di eventuali anomalie.
   Per quanto riguarda il routing delle pagine web, oltre agli endpoint espliciti
   per home, login e registrazione, e' stata introdotta la rotta parametrica /p/<path:filename>:
   questa scelta permette di servire in modo pulito e immediato le viste secondarie
   (come il catalogo o le schede dettaglio) riutilizzando lo stesso motore di template
   senza dover dichiarare decine di funzioni identiche nel codice principale.
================================================================================
"""

from flask import Flask, request, redirect, session, render_template, jsonify
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, ServerSelectionTimeoutError
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timezone
import os

app = Flask(__name__)
# la chiave per criptare i cookie di sessione
app.secret_key = os.getenv("FLASK_SECRET_KEY", "supersegreto")

# -----------------------------------------------------------------------------
# CONNESSIONE A MONGODB
# -----------------------------------------------------------------------------
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
MONGODB_DB = os.getenv("MONGODB_DB", "motoshop_db")
SECRET_CODE = os.getenv("SECRET_CODE", "12345") # codice per la registrazione dei lavoratori

# timeout basso per non far freezare il sito se dimentico di accendere il db
client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=2000)

try:
    client.admin.command("ping")
    print("✅ Connesso correttamente a MongoDB!")
except ServerSelectionTimeoutError as e:
    print("❌ Errore critico: MongoDB NON è raggiungibile:", e)
    raise

# preparo le "tabelle" (collezioni) che userò in tutto il sito
db = client[MONGODB_DB]
users = db["utenti"]
accessi = db["accessi"]
acquisti = db["acquisti"]
contatti = db["contatti"]
prodotti = db["prodotti"]

try:
    # forzo l'email ad essere unica, così Mongo blocca da solo i doppioni
    users.create_index("email", unique=True)
except Exception:
    pass

# -----------------------------------------------------------------------------
# ROTTE DI NAVIGAZIONE E RENDER TEMPLATE HTML
# -----------------------------------------------------------------------------
@app.route('/')
def home_page():
    return render_template("Home.html")

@app.route('/login_page')
def login_page():
    return render_template("Login.html")

@app.route('/register_page')
def register_page():
    return render_template("Registrazione.html")

@app.route('/dashboard_page')
def dashboard_page():
    # smisto gli utenti nella loro area riservata in base al ruolo salvato in sessione
    if "email" in session:
        role = session.get("role")
        if role == "admin":
            return render_template("DashboardAdmin.html")
        elif role == "lavoratore":
            return render_template("DashboardLavoratore.html")
        else:
            return render_template("Dashboard.html") 
    return redirect("/login_page")

@app.route("/p/<path:filename>")
def serve_page(filename):
    # rotta jolly per servire tutte le altre pagine (catalogo, carrello, ecc)
    return render_template(filename)

# -----------------------------------------------------------------------------
# FLUSSO DI REGISTRAZIONE UTENTI (SOLO CLIENTI)
# -----------------------------------------------------------------------------
@app.route("/register", methods=["POST"])
def register():
    nome = (request.form.get("nome") or "").strip()
    cognome = (request.form.get("cognome") or "").strip()
    email = (request.form.get("email") or "").strip().lower()
    password = request.form.get("password") or ""
    confirm_password = request.form.get("confirm_password") or ""

    # Controllo che i dati base ci siano tutti
    if not all([nome, cognome, email, password, confirm_password]):
        return "❌ Tutti i campi sono obbligatori!", 400
    
    if password != confirm_password:
        return "❌ Le password inserite non coincidono!", 400
    
    # FORZATURA DI SICUREZZA: Chiunque si registri dal sito è automaticamente un cliente.
    # L'admin e i lavoratori sono già creati dal sistema all'avvio.
    role = "cliente"

    # cripto la password (mai salvare in chiaro nel db!)
    hashed_password = generate_password_hash(password)
    now = datetime.now(timezone.utc)

    try:
        users.insert_one({
            "nome": nome,
            "cognome": cognome,
            "email": email,
            "password": hashed_password,
            "role": role,
            "created_at": now,
            "is_online": False
        })
        print(f"✅ Nuovo CLIENTE registrato con successo: {email}")
    except DuplicateKeyError:
        return "❌ Questa email risulta già registrata!", 409

    return redirect("/login_page")

# -----------------------------------------------------------------------------
# LOGIN E GESTIONE SESSIONE
# -----------------------------------------------------------------------------
@app.route("/login", methods=["POST"])
def login():
    email = (request.form.get("email") or "").strip().lower()
    password = (request.form.get("password") or "")
    role = (request.form.get("role") or "").strip()

    if not all([email, password, role]):
        return "❌ Tutti i campi sono obbligatori!", 400

    user = users.find_one({"email": email, "role": role})
    
    if user and check_password_hash(user["password"], password):
        session["email"] = email
        session["nome"] = user.get("nome", "")
        session["cognome"] = user.get("cognome", "")
        session["role"] = user.get("role", "")

        now = datetime.now(timezone.utc)
        accessi.insert_one({"email": email, "azione": "login", "ruolo": role, "timestamp": now})
        users.update_one({"_id": user["_id"]}, {"$set": {"last_login": now, "is_online": True}})

        print(f"✅ Login effettuato da: {email}")
        return redirect("/dashboard_page")

    accessi.insert_one({"email": email, "azione": "login_failed", "ruolo": role, "timestamp": datetime.now(timezone.utc)})
    print(f"❌ Tentativo di login fallito per: {email}")
    return "❌ Email, password o ruolo non validi!", 401

@app.route("/logout")
def logout():
    if "email" in session:
        email = session["email"]
        now = datetime.now(timezone.utc)
        accessi.insert_one({"email": email, "azione": "logout", "timestamp": now})
        users.update_one({"email": email}, {"$set": {"last_logout": now, "is_online": False}})
        print(f"✅ Logout eseguito per: {email}")
    
    session.clear() 
    return redirect("/")
"""
RELAZIONE DI PROGETTO E SPECIFICHE BACKEND - MOTOSHOP 
File sorgente: app.py (Endpoint RESTful, Gestione Ordini, Bootstrap e Avvio)
================================================================================
Questa seconda sezione dell'application server gestisce i flussi di dati asincroni
(AJAX/Fetch) per il catalogo e il carrello, la persistenza delle transazioni,
il controllo degli accessi amministrativi e il popolamento iniziale del database.

NOTE DI SVILUPPO E SCELTE ARCHITETTURALI:

1. Gestione transazioni di acquisto (/acquista):
   L'endpoint accetta un payload JSON contenente l'elenco degli articoli presenti
   nel carrello dell'utente. Oltre alla verifica di sessione attiva, la funzione
   effettua un'iterazione su ogni elemento calcolando il totale parziale
   (prezzo_unitario * quantita) e arrotondando a due decimali con round() per evitare
   imprecisioni tipiche dell'aritmetica floating point. Ogni voce valida viene inserita
   come singolo documento tracciabile nella collection 'acquisti' con timestamp UTC,
   garantendo uno storico atomico e facilmente filtrabile per utente.

2. CRUD Prodotti e caricamento immagini su filesystem:
   Le operazioni di inserimento (/api/prodotti in POST) e cancellazione (DELETE con id)
   sono rigidamente protette: solo gli utenti con ruolo 'lavoratore' o 'admin' possono
   invocarle. Per l'upload degli asset visivi, i file ricevuti dal form multipart
   vengono sanitizzati tramite secure_filename di werkzeug prima di essere salvati
   nella directory fisica static/img_moto, memorizzando sul database MongoDB solo
   il percorso relativo standard. La rimozione sfrutta il cast esplicito ObjectId(id)
   della libreria bson per individuare e cancellare il record esatto.

3. Serializzazione BSON/JSON per il frontend:
   Poiche i tipi nativi di MongoDB (ObjectId e datetime) non sono serializzabili
   direttamente dal jsonify standard di Flask, gli endpoint (/api/prodotti,
   /api/miei-ordini, /api/admin/utenti) eseguono una trasformazione esplicita:
   l'_id viene convertito in stringa e i campi data vengono formattati con strftime
   leggibile prima della risposta HTTP. Nella lista utenti per l'amministratore viene
   inoltre applicata la proiezione {"password": 0} per non esporre mai gli hash.

4. Script di bootstrap e affidabilita offline (esame):
   Le routine inizializza_database() e inizializza_utenti_demo() assicurano che
   al primo avvio il server sia immediatamente operativo. E' stata rimossa ogni
   dipendenza da CDN o immagini esterne (Unsplash) forzando asset locali in /static,
   cosi da azzerare rischi di visualizzazione difettosa in caso di assenza di rete.
================================================================================
"""

from flask import Flask, request, redirect, session, render_template, jsonify
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, ServerSelectionTimeoutError
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timezone
import os

# =============================================================================
# ENDPOINT API REST PER IL FRONTEND (AJAX / FETCH)
# =============================================================================

@app.route("/acquista", methods=["POST"])
def acquista():
    if "email" not in session:
        return jsonify({"error": "Devi effettuare il login per completare l'acquisto"}), 403

    try:
        data = request.get_json(force=True)
    except Exception as e:
        return jsonify({"error": f"Errore di parsing JSON: {e}"}), 400

    cart_items = data.get("cart")
    if not cart_items or not isinstance(cart_items, list):
        return jsonify({"error": "Il carrello è vuoto o i dati non sono validi"}), 400

    now = datetime.now(timezone.utc)
    inserted = 0
    errors = []

    for idx, item in enumerate(cart_items):
        try:
            nome = item.get("nome")
            desc = item.get("desc", "")
            taglia = item.get("size", "")
            quantita = int(item.get("qty", 1))
            prezzo_unitario = float(item.get("prezzo", 0))
            totale = round(prezzo_unitario * quantita, 2)

            if not nome or prezzo_unitario <= 0 or quantita <= 0:
                errors.append(f"Prodotto {idx+1} ignorato: dati non validi")
                continue

            acquisti.insert_one({
                "email": session["email"],
                "nome_prodotto": nome,
                "descrizione": desc,
                "taglia": taglia,
                "quantita": quantita,
                "prezzo_unitario": prezzo_unitario,
                "totale": totale,
                "timestamp": now
            })
            inserted += 1
        except Exception as e:
            errors.append(f"Errore nel salvataggio del prodotto {idx+1}: {e}")

    if inserted == 0:
        return jsonify({"error": "Nessun prodotto valido è stato salvato", "details": errors}), 500

    print(f"✅ Registrati {inserted} acquisti per l'utente {session['email']}")
    return jsonify({"success": True, "message": f"Registrati {inserted} acquisti con successo!", "errors": errors})

@app.route("/api/prodotti", methods=["GET"])
def get_prodotti():
    prods = list(prodotti.find({}))
    for p in prods:
        p["_id"] = str(p["_id"])
    return jsonify(prods)

@app.route("/api/prodotti", methods=["POST"])
def add_prodotto():
    if session.get("role") not in ["lavoratore", "admin"]:
        return jsonify({"error": "Accesso negato. Solo i lavoratori e l'admin possono aggiungere articoli."}), 403

    nome = (request.form.get("nome") or "").strip()
    categoria = (request.form.get("categoria") or "").strip()
    desc = (request.form.get("desc") or "").strip()
    
    try:
        prezzo = float(request.form.get("prezzo", 0))
    except ValueError:
        return jsonify({"error": "Il prezzo inserito non è valido"}), 400

    if not nome or prezzo <= 0:
        return jsonify({"error": "Nome e prezzo sono campi obbligatori validi!"}), 400

    img_path = "/static/img_moto/casco1.png"
    file = request.files.get("img_file")
    
    if file and file.filename != '':
        from werkzeug.utils import secure_filename
        filename = secure_filename(file.filename)
        upload_folder = os.path.join("static", "img_moto")
        os.makedirs(upload_folder, exist_ok=True)
        
        file_path = os.path.join(upload_folder, filename)
        file.save(file_path)
        img_path = f"/static/img_moto/{filename}"

    try:
        prodotti.insert_one({
            "nome": nome,
            "categoria": categoria,
            "desc": desc,
            "prezzo": prezzo,
            "img": img_path,
            "creato_da": session["email"],
            "timestamp": datetime.now(timezone.utc)
        })
        print(f"✅ Nuovo prodotto caricato da {session['email']}: {nome}")
        return jsonify({"success": True, "message": "Prodotto aggiunto al database con successo!"})
    except Exception as e:
        return jsonify({"error": f"Errore durante l'inserimento nel db: {e}"}), 500

@app.route("/api/prodotti/<id>", methods=["DELETE"])
def delete_prodotto(id):
    if session.get("role") not in ["lavoratore", "admin"]:
        return jsonify({"error": "Accesso negato. Operazione non autorizzata."}), 403

    try:
        from bson import ObjectId
        result = prodotti.delete_one({"_id": ObjectId(id)})
        if result.deleted_count > 0:
            print(f"🗑️ Prodotto ID {id} eliminato da {session['email']}")
            return jsonify({"success": True, "message": "Prodotto eliminato correttamente!"})
        else:
            return jsonify({"error": "Prodotto non trovato nel database"}), 404
    except Exception as e:
        return jsonify({"error": f"Errore durante la cancellazione: {e}"}), 500

@app.route("/api/miei-ordini", methods=["GET"])
def miei_ordini():
    if "email" not in session:
        return jsonify({"error": "Non autorizzato"}), 403
    
    try:
        ordini_list = list(acquisti.find({"email": session["email"]}).sort("timestamp", -1))
        for o in ordini_list:
            o["_id"] = str(o["_id"])
            if "timestamp" in o and isinstance(o["timestamp"], datetime):
                o["timestamp"] = o["timestamp"].strftime("%d/%m/%Y %H:%M")
        return jsonify({"success": True, "ordini": ordini_list})
    except Exception as e:
        return jsonify({"error": f"Errore nel recupero degli ordini: {e}"}), 500

@app.route("/api/admin/utenti", methods=["GET"])
def admin_get_utenti():
    if session.get("role") != "admin":
        return jsonify({"error": "Accesso negato. Area riservata all'admin."}), 403

    try:
        utenti_list = list(users.find({}, {"password": 0}))
        for u in utenti_list:
            u["_id"] = str(u["_id"])
            if "created_at" in u and isinstance(u["created_at"], datetime):
                u["created_at"] = u["created_at"].strftime("%Y-%m-%d %H:%M:%S")
            if "last_login" in u and isinstance(u["last_login"], datetime):
                u["last_login"] = u["last_login"].strftime("%Y-%m-%d %H:%M:%S")

        return jsonify({"success": True, "utenti": utenti_list})
    except Exception as e:
        return jsonify({"error": f"Errore nel recupero lista utenti: {e}"}), 500


# =============================================================================
# SCRIPT DI INIZIALIZZAZIONE AUTOMATICA (ESEGUITI ALL'AVVIO DEL SERVER)
# =============================================================================

def inizializza_database():
    """
    Popola il database la prima volta che viene acceso con articoli di prova,
    usando file rigorosamente locali per non rischiare rotture offline all'esame.
    """
    prodotti.delete_many({"img": {"$regex": "unsplash"}})
    
    if prodotti.count_documents({}) == 0:
        prodotti_demo = [
            {
                "nome": "Casco AGV Pista GP RR",
                "categoria": "caschi",
                "desc": "Casco integrale racing in pura fibra di carbonio. Visiera panoramica.",
                "prezzo": 1250.00,
                "img": "/static/img_moto/casco.jpg",
                "creato_da": "sistema",
                "timestamp": datetime.now(timezone.utc)
            },
            {
                "nome": "Giacca Dainese Super Speed",
                "categoria": "giacche",
                "desc": "Giacca in pelle bovina D-Skin 2.0 con protezioni in alluminio sulle spalle.",
                "prezzo": 749.95,
                "img": "/static/img_moto/giacca.jpg",
                "creato_da": "sistema",
                "timestamp": datetime.now(timezone.utc)
            },
            {
                "nome": "Guanti Alpinestars GP Pro",
                "categoria": "guanti",
                "desc": "Guanti racing in pelle di canguro con protezioni nocche in carbonio.",
                "prezzo": 269.90,
                "img": "/static/img_moto/guanti.jpg",
                "creato_da": "sistema",
                "timestamp": datetime.now(timezone.utc)
            }
        ]
        prodotti.insert_many(prodotti_demo)
        print("🔧 Catalogo inizializzato con 3 prodotti e immagini LOCALI!")

def inizializza_utenti_demo():
    """
    Crea gli account di base (Admin, Lavoratore, Cliente) al primo avvio
    per avere l'e-commerce subito pronto per la presentazione all'esame.
    Tutti hanno la password '12345' per facilitare i test live.
    """
    now = datetime.now(timezone.utc)
    
    # 1. ADMIN SUPREMO (Tu)
    if users.count_documents({"email": "emanueleruppi@gmail.com"}) == 0:
        users.insert_one({
            "nome": "Emanuele",
            "cognome": "Ruppi",
            "email": "emanueleruppi@gmail.com",
            "password": generate_password_hash("12345"), 
            "role": "admin", 
            "created_at": now,
            "is_online": False
        })
        print("👑 Account Admin di Emanuele pronto! (emanueleruppi@gmail.com)")

    # 2. LAVORATORE/STAFF (Giovanni Marsala)
    if users.count_documents({"email": "giovannimarsala@gmail.com"}) == 0:
        users.insert_one({
            "nome": "Giovanni",
            "cognome": "Marsala",
            "email": "giovannimarsala@gmail.com",
            "password": generate_password_hash("12345"), 
            "role": "lavoratore", 
            "created_at": now,
            "is_online": False
        })
        print("📦 Account Lavoratore pronto! (giovannimarsala@gmail.com)")

    # 3. CLIENTE BASE (Valentino Rossi)
    if users.count_documents({"email": "valentinorossi@gmail.com"}) == 0:
        users.insert_one({
            "nome": "Valentino",
            "cognome": "Rossi",
            "email": "valentinorossi@gmail.com",
            "password": generate_password_hash("12345"), 
            "role": "cliente", 
            "created_at": now,
            "is_online": False
        })
        print("🛒 Account Cliente pronto! (valentinorossi@gmail.com)")

# Richiamo le due funzioni di autoconfigurazione
inizializza_database()
inizializza_utenti_demo()

if __name__ == "__main__":
    app.run(debug=True)