// Config partagee (main + renderer) du compagnon MANOA.
// Vous pouvez changer de modele Vosk en modifiant MODEL_NAME / MODEL_URL.
// Listes des modeles : https://alphacephei.com/vosk/models

module.exports = {
  // Modele Vosk (telecharge une seule fois, puis stocke dans userData/models)
  modelName: 'vosk-model-small-fr-0.22',
  modelUrl:
    'https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip',

  // Mots d'eveil (independants de la casse)
  wakeWords: ['manoa', 'man', 'matrix'],

  // Phrases de reponse vocale (choisies au hasard)
  greetings: [
    'Oui, je vous écoute.',
    'Oui ? MANOA est là.',
    'Je vous écoute. J’ouvre l’application.',
  ],

  // Ports du projet MANOA
  backendPort: 4000,
  frontendPort: 5173,

  // Duree pendant laquelle le micro reste coupe apres un eveil (ms)
  cooldownMs: 9000,
};
