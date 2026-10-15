# Aide & Services — site pédagogique de cybersécurité

Site web de démonstration imitant un organisme d'aide à la personne.
Objectif : faire observer aux élèves la connexion HTTPS, l'avertissement de certificat,
la création de compte et la transmission de données personnelles **fictives**.

> ⚠️ **SITE DE DÉMONSTRATION** — N'utilisez jamais de données personnelles réelles ni un vrai mot de passe.

Organisme fictif : **Aide & Services**. Aucun lien avec une entreprise réelle.

---

## Arborescence

```text
tp-Info/
├── docker-compose.yml
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py              # Application FastAPI
│   ├── database.py          # SQLite
│   ├── models.py            # Utilisateurs (sans mot de passe)
│   ├── schemas.py
│   ├── generate_certs.py    # Certificat TLS auto-signé
│   ├── run.py               # Démarrage HTTPS
│   └── entrypoint.sh
├── frontend/
│   ├── templates/           # Pages HTML (Jinja2)
│   └── static/              # CSS / JS
├── database/                # Fichier SQLite (créé au démarrage)
└── certs/                   # Certificat auto-signé local
```

---

## Lancement rapide (Docker)

Prérequis : [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
docker compose up --build
```

Puis ouvrir Firefox :

**https://localhost:8443**

---

## Lancement sans Docker (Python)

Depuis la racine du projet :

```bash
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
python backend\run.py

# Linux / macOS
# source .venv/bin/activate
# pip install -r backend/requirements.txt
# python backend/run.py
```

URL : **https://localhost:8443**

Le certificat auto-signé est généré automatiquement dans `certs/` au premier lancement.

---

## Identifiants administrateur (enseignant)

| Champ        | Valeur            |
|--------------|-------------------|
| Identifiant  | `enseignant`      |
| Mot de passe | `PedagoDemo2026!` |

Page : **https://localhost:8443/admin**

Ces identifiants sont modifiables via les variables d'environnement
`ADMIN_USERNAME` et `ADMIN_PASSWORD` dans `docker-compose.yml`.

---

## URLs utiles

| Page                         | URL                                      |
|------------------------------|------------------------------------------|
| Accueil                      | https://localhost:8443/                  |
| Nos services                 | https://localhost:8443/services          |
| À propos                     | https://localhost:8443/a-propos          |
| Contact                      | https://localhost:8443/contact           |
| Créer un compte              | https://localhost:8443/register          |
| Se connecter                 | https://localhost:8443/login             |
| Page pédagogique TLS         | https://localhost:8443/securite          |
| Admin enseignant             | https://localhost:8443/admin             |

---

## Accéder au site HTTPS avec Firefox

1. Lancez le projet (`docker compose up --build` ou `python run.py`).
2. Ouvrez Firefox et allez sur `https://localhost:8443`.
3. Firefox affiche un avertissement du type **« Attention : risque probable de sécurité »**
   (`SEC_ERROR_UNKNOWN_ISSUER` / certificat auto-signé).
4. Cliquez sur **Avancé…** puis **Accepter le risque et continuer**
   (uniquement dans le cadre du TP local).
5. Le bandeau rouge rappelle qu'il s'agit d'une démonstration pédagogique.

---

## Examiner le certificat dans Firefox

1. Sur le site, cliquez sur l'icône de cadenas / triangle d'avertissement dans la barre d'adresse.
2. Ouvrez **Connexion non sécurisée** / **Plus d'informations**.
3. Cliquez sur **Voir le certificat**.
4. Observez notamment :
   - **Émis par** : Aide & Services DEMO (auto-signé, pas une autorité publique) ;
   - **Nom commun (CN)** : `localhost` ;
   - **Validité** : dates de début et de fin ;
   - absence de chaîne de confiance vers une autorité reconnue.

C'est exactement le signal que doit repérer l'élève avant de transmettre des données.

---

## Comportement pédagogique important

- Le formulaire d'inscription demande des données personnelles **fictives**.
- Un avertissement visible et une case obligatoire précèdent la validation.
- Après inscription, une page d'alerte **réaffiche** les données transmises.
- Le **mot de passe n'est jamais stocké** (ni en clair, ni hashé).
- La connexion `/login` simule une session si l'e-mail existe déjà en base.
- L'enseignant consulte les comptes fictifs dans `/admin`.

---

## Remise à zéro des données

### Depuis l'interface enseignant

1. Connectez-vous sur `/admin`.
2. Cliquez sur **Supprimer toutes les données**.
3. Confirmez.

Vous pouvez aussi supprimer un compte individuellement, ou cliquer sur
**Générer des utilisateurs fictifs** (Jean Exemple, Sophie Démonstration, Alice Test — domaines `@example.test`).

### Depuis le système de fichiers

```bash
# Arrêter le conteneur si besoin
docker compose down

# Supprimer la base SQLite
Remove-Item database\demo.db -ErrorAction SilentlyContinue   # PowerShell
# rm -f database/demo.db                                     # Linux/macOS
```

Au prochain démarrage, une base vide est recréée.

---

## Régénérer le certificat auto-signé

```bash
# Supprimer les anciens certificats
Remove-Item certs\server.crt, certs\server.key -ErrorAction SilentlyContinue

# Relancer (génération automatique) ou :
cd backend
python generate_certs.py
```

Ne jamais utiliser un certificat d'une autorité publique pour ce TP.

---

## Parcours élève recommandé

1. Arriver sur le site via HTTPS.
2. Constater l'avertissement Firefox sur le certificat.
3. Examiner le certificat.
4. Poursuivre uniquement dans le cadre du TP.
5. Créer un compte avec des données **manifestement fictives**.
6. Lire l'avertissement du formulaire.
7. Valider.
8. Voir la page listant les données transmises.
9. L'enseignant montre `/admin`.
10. Débrief : pourquoi ne pas transmettre ses vraies informations à un site inconnu.

---

## Limites volontairement absentes

Ce projet **n'implémente pas** :

- le stockage de mots de passe ;
- la récupération de cookies de navigateurs ;
- la collecte hors formulaire ;
- la capture de données système ;
- tout mécanisme visant un véritable service en ligne.

Toutes les données restent dans l'environnement local de démonstration.
