# MANOA - Matrix AI Technician

Assistant telecom virtuel et interactif pour Matrix Telecom : robot anime, conversation vocale, chat,
feuilles de route pedagogiques style Duolingo et base de connaissances RAG (27 documents de formation).

## Stack

| Couche | Technologie |
|--------|-------------|
| Frontend | React + Vite + Tailwind CSS + Framer Motion |
| Backend | Node.js + Express |
| IA | OpenAI API (GPT-4o-mini + text-embedding-3-small) |
| Base de donnees | Firebase Firestore (sinon JSON local automatique) |
| Voix | SpeechRecognition (entree) + speechSynthesis (sortie) - gratuit, navigateur |
| Robot | Image `MANOA.jpeg` animee en CSS/Framer Motion |

## Demarrage rapide

Prerequis : Node.js 18+ installe.

### 1. Configurer (une fois)

```powershell
cd matrix-ai\backend
npm install
```

### 2. Ajouter votre cle OpenAI (optionnel mais recommande)

Ouvrez `backend\.env` et remplacez la valeur placeholder :

```
OPENAI_API_KEY=sk-...
```

Sans cle, l'application fonctionne en mode hors-ligne (reponses generees depuis les documents
de formation, feuilles de route predefinies) pour la demonstration.

### 3. Lancer le projet

Double-cliquez sur `start.ps1` (ou depuis PowerShell) :

```powershell
.\start.ps1
```

Cela ouvre :
- Frontend : http://localhost:5173
- Backend  : http://localhost:4000/api/health

## Fonctionnalites

- **Assistant vocal** : cliquez sur le micro, parlez, MANOA repond en voix (navigation Chrome).
- **Robot anime** : MANOA cligne des yeux, flotte et bouge la bouche quand il parle.
- **Chat telecom** : reponses basees sur les 27 documents de formation Matrix (RAG).
- **Feuilles de route** : questions "comment..." -> parcours Duolingo avec etapes, commandes et quiz.
- **Progression** : XP, niveaux, badges, series.
- **Tableau de bord admin** : statistiques d'utilisation, conversations (mot de passe : `manoa-admin`).

## Test rapide

1. Dans le chat, demandez : *"Comment depanner une panne Internet ?"*
2. MANOA affiche une feuille de route. Ouvrez chaque etape et validez (quiz compris).
3. Gagnez des XP, puis ouvrez **Feuilles de route** pour retrouver votre progression.

## Base de donnees

Par defaut, les donnees sont stockees dans `backend/data/localdb.json` (aucune installation).

Pour utiliser **Firebase Firestore** :
1. Creez un projet sur https://console.firebase.google.com et activez Firestore.
2. Telechargez la cle de compte de service (Parametres du projet -> Comptes de service).
3. Dans `backend\.env`, pointez `FIREBASE_SERVICE_ACCOUNT` vers ce fichier JSON.

## Ajouter des documents a la base de connaissances

Deposez des fichiers `.txt`, `.md` ou `.html` dans `backend/knowledge/` puis supprimez
`backend/data/knowledge_index.json` et relancez le backend pour re-indexer (28 docs / 504 fragments).

## Structure

```
matrix-ai/
  backend/
    src/
      config/        # lecture du .env
      data/          # Firestore + fallback JSON local
      routes/        # /api/chat, /api/roadmap, /api/progress, /api/admin, /api/documents
      services/      # openai.js, aiService.js, knowledgeBase.js, gamification.js
    knowledge/       # 27 documents de formation Matrix (HTML)
    data/            # base locale + index d'embeddings
  frontend/
    src/
      components/    # Robot, ChatView, RoadmapView, DashboardView, ProgressListView
      hooks/         # useSpeech (micro + TTS)
      services/      # api.js (client backend)
    public/manoa.jpg # image du robot
  start.ps1
  README.md
```

## Feuille de route (Roadmap de developpement)

- [x] Phase 1 - Chat IA (Node/Express + React/Vite)
- [x] Phase 2 - Voix (entree/sortie navigateur)
- [x] Phase 3 - Robot anime (image MANOA + Framer Motion)
- [x] Phase 4 - Base de connaissances RAG (documents Matrix)
- [x] Phase 5 - Tableau de bord admin
- [x] Bonus - Feuilles de route Duolingo + XP/badges
- [ ] Phase 6 - Deploiement (VPS/Docker), identification client, WhatsApp/Telegram
