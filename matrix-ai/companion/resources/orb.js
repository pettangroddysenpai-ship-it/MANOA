// Compagnon flottant MANOA : orbe circulaire en bas a droite du bureau.
// Cliquer = ouvrir l'application. Les evenements (eveil vocal, etat d'ecoute)
// arrivent du main via le bridge "manoa".

const orb = document.getElementById('orb');

function openApp() {
  try {
    manoa.openApp();
  } catch {
    window.location = 'http://localhost:5173';
  }
}

orb.addEventListener('click', openApp);
orb.addEventListener('dblclick', openApp);

// Etat d'ecoute (allume / sourdine)
manoa.onListening((on) => {
  orb.classList.toggle('listening', !!on);
  orb.classList.toggle('muted', !on);
  orb.title = on ? 'MANOA vous écoute — dites MANOA, MAN ou MATRIX' : 'MANOA en sourdine';
});

// Mot d'eveil detecte : flash vert
manoa.onWake((word) => {
  orb.classList.remove('wake');
  void orb.offsetWidth; // relance l'animation
  orb.classList.add('wake');
  orb.title = 'MANOA : « ' + (word || '?') + ' » détecté';
  setTimeout(() => {
    orb.classList.remove('wake');
    orb.title = 'MANOA vous écoute — dites MANOA, MAN ou MATRIX';
  }, 3000);
});

// Statuts divers (modele, chargement...)
manoa.onStatus((msg) => {
  if (msg) orb.title = String(msg);
});
