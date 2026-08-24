# MANOA Companion — mascotte en tray + réveil vocal (Vosk)

Petit compagnon de bureau pour le projet MANOA :

- **Icône de la mascotte dans la barre des tâches** (en bas à droite, systray) après installation.
- **Réveil vocal** : dites **« MANOA »**, **« MAN »** ou **« MATRIX »** (ou « MATRIX AI ») — le compagnon répond à voix
  et **ouvre automatiquement l'application** dans votre navigateur.
- Le backend / frontend sont **démarrés automatiquement** s'ils ne tournent pas déjà.
- Menu contextuel (clic droit sur l'icône) : ouvrir l'application, démarrer les services, couper/activer l'écoute,
  lancer au démarrage de Windows, quitter.

## Comment ça marche

| Brique | Technologie |
|--------|-------------|
| Tray | Electron (`Tray`) — aucune fenêtre visible |
| Détection du mot-clé | **Vosk** en WebAssembly (`vosk-browser`), 100 % hors-ligne |
| Micro | `getUserMedia` + AudioWorklet (16 kHz mono) |
| Modèle vocal | `vosk-model-small-fr-0.22` (41 Mo, téléchargé une seule fois, Apache 2.0) |
| Réponse vocale | `speechSynthesis` Windows (voix française) |
| Ouverture navigateur | `shell.openExternal` |

## Utilisation (développement)

```powershell
cd companion
.\start.ps1            # installe les deps et lance le compagnon
```

À la première exécution, le compagnon télécharge le modèle Vosk (~41 Mo) puis affiche l'icône.
Dites ensuite « MANOA » dans le micro.

## Construction de l'installateur Windows

```powershell
cd companion
npm run build:win      # genere dist/MANOA Setup x.x.x.exe (NSIS)
```

L'installateur embarque le **backend** (avec ses dépendances), le **frontend** (build Vite) et un
**runtime Node** (le backend est lancé par `node.exe` inclus) : une fois installé, l'application
fonctionne sans console ni installation de Node, les services se lancent depuis le tray.

## Configuration

Modifiez `companion/config.js` :
- `modelName` / `modelUrl` : changer de modèle Vosk (ex. `vosk-model-small-en-us-0.15`).
- `greetings` : phrases de réponse vocale.

Les mots d'éveil sont définis dans la regex `WAKE_RE` de `resources/wake.js`
(`manoa`, `man`, `mana`, `mano`, `matrice`, `matrix`).

## Logs

Tout est journalisé dans `%APPDATA%\manoa-companion\` :
- `companion.log` (compagnon),
- `backend.log` / `frontend.log` (services),
- `models\` (modèle Vosk téléchargé une seule fois).

## Antivirus (SMADAV et autres)

Sur les machines avec SMADAV (ou un antivirus agressif), `electron.exe`, le cache de téléchargement
et le dossier de données peuvent être supprimés silencieusement. Ajoutez les dossiers suivants
dans les **exclusions** de l'antivirus avant de lancer ou d'installer le compagnon :

- le dossier du projet MANOA,
- `%APPDATA%\manoa-companion`,
- `%LOCALAPPDATA%\electron` (cache du téléchargement d'Electron),
- après installation : le dossier d'installation de MANOA.

## Notes

- Le compagnon **ne s'ouvre pas automatiquement au démarrage de Windows** par défaut — cochez
  « Lancer au démarrage de Windows » dans le menu du tray pour l'activer.
- Le micro reste actif en arrière-plan pour l'écoute du mot-clé (traitement 100 % local, rien n'est envoyé sur Internet).
