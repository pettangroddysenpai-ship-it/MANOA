import { getOpenAI, embed } from './openai.js';
import { geminiGenerate } from './geminiService.js';
import { config, hasOpenAIKey, hasGeminiKey, hasYoutubeKey } from '../config/index.js';
import { searchKnowledge } from './knowledgeBase.js';
import { searchYoutube } from './youtubeService.js';

const ROADMAP_PROMPT = `Tu es un assistant telecom de Matrix Telecom qui repond en francais.
L'utilisateur pose une question "comment faire / comment configurer / comment resoudre".
Genere une feuille de route pedagogique (type Duolingo) de 4 a 7 etapes pour repondre.
Chaque etape doit etre executable par un technicien junior: donne les menus exacts, les commandes exactes,
les valeurs a remplacer, les controles attendus et les criteres de validation.
Pour MikroTik, privilegie Winbox + Terminal RouterOS et donne les commandes /interface, /ip, /ppp, /ip route,
/ip firewall nat, /tool ping quand c'est pertinent.
Reponds STRICTEMENT en JSON, sans texte autour, au format:
{
  "title": "titre court",
  "steps": [
    {
      "title": "titre de l'etape",
      "description": "objectif + action exacte + resultat attendu",
      "commands": ["commande exacte ou action exacte a executer"],
      "type": "info" | "run",
      "scene": "pop-edge" | "configure-device" | "ping-test" | "app-walkthrough" | "inspection",
      "app": "",
      "quiz": { "question": "question rapide", "options": ["a","b","c"], "answerIndex": 0 }
    }
  ]
}
Choix du champ "scene" pour l'animation bonhomme:
- verifier l'architecture reseau / liens POP / Provider Edge / fibre FO ou FH / topologie -> "pop-edge"
- configurer un equipement (routeur Cisco/MikroTik, switch, point d'acces) -> "configure-device"
- tester la liaison / ping / verification / simulation -> "ping-test"
- utiliser un logiciel (Winbox, Putty, Cisco Packet Tracer, Google Earth, logiciel de simulation) -> "app-walkthrough" et remplir "app" avec le nom du logiciel
- sinon -> "inspection"
La derniere etape doit etre "Quiz" avec un quiz obligatoire (quiz non vide).
Chaque etape doit avoir un quiz SAUF si c'est une etape d'action (type "run") qui a des commandes.`;

const SYSTEM_PROMPT = `Tu es "MANOA", l'assistant technique virtuel de Matrix Telecom, un FAI du Cameroun (Yaounde).
Tu reponds en francais simple, direct et operationnel. Ton objectif est de permettre au technicien d'executer la procedure sans deviner.
Regles CRITIQUES:
1. Donne toujours une reponse structuree en etapes numerotees quand il y a une action technique.
2. Chaque etape doit dire: objectif, action exacte, commande/menu exact, resultat attendu.
3. Donne les valeurs a remplacer sous la forme <CLIENT>, <VLAN_ID>, <WAN>, <LAN>, <GATEWAY>, <DNS>.
4. Pour MikroTik, donne les commandes RouterOS exactes et precise aussi le chemin Winbox si utile.
5. Evite les mots vagues: "verifier", "configurer", "tester" doivent etre suivis de l'action concrete.
6. Cite la source entre parentheses quand elle vient du contexte documentaire.
7. Si une information manque, donne une hypothese claire puis la procedure adaptable.`;

const ROADMAP_KEYWORDS = /comment\s+|comment faire|configurer|depanner|troubleshoot|resoudre|résoudre|installer|mettre en place|creer|créer|mettre en oeuvre|expliquer pas a pas|pas à pas|procedure|procédure|etapes|étapes|marche à suivre|marche a suivre/i;

export function shouldBuildRoadmap(question) {
  return ROADMAP_KEYWORDS.test(question);
}

function buildContext(results) {
  return results
    .map((r, i) => `[Extrait ${i + 1}] (Source: ${r.file})\n${r.content.slice(0, 1200)}`)
    .join('\n\n');
}

async function enrichWithVideos(question, payload) {
  payload.videos = [];
  if (!hasYoutubeKey()) return payload;
  try {
    payload.videos = await searchYoutube(question, config.youtube.maxResults);
  } catch (err) {
    console.warn('[ai] youtube search failed:', err.message);
  }
  return payload;
}

function detectIntent(question) {
  const q = question.toLowerCase();
  if (/mikrotik|routeros|winbox/.test(q) && /pppoe|ppp/.test(q)) return 'mikrotik-pppoe';
  if (/mikrotik|routeros|winbox/.test(q) && /nat|internet|wan|lan|dhcp/.test(q)) return 'mikrotik-internet';
  if (/panne|depann|troubleshoot|internet|connexion|los|pon|onu|cpe/.test(q)) return 'internet-troubleshooting';
  return 'generic';
}

function makeStep({ title, description, commands = [], scene = 'inspection', app = '', quiz }) {
  return {
    title,
    description,
    commands,
    type: commands.length ? 'run' : 'info',
    scene,
    app,
    quiz,
  };
}
function fallbackRoadmap(question, sourceFile) {
  const src = sourceFile ? `(Source: ${sourceFile})` : '';
  const intent = detectIntent(question);

  if (intent === 'mikrotik-pppoe') {
    return {
      title: 'Configuration PPPoE MikroTik',
      steps: [
        makeStep({ title: 'Identifier les interfaces', description: `Reperez le port WAN vers le fournisseur et le port LAN vers le client. Notez les noms exacts avant toute modification. ${src}`, commands: ['/interface print', '/ip address print', '/interface bridge port print'], scene: 'configure-device', app: 'Winbox', quiz: { question: 'Quel port doit porter le client PPPoE ?', options: ['Le port WAN vers le fournisseur', 'Le port LAN uniquement', 'Le port console'], answerIndex: 0 } }),
        makeStep({ title: 'Creer le client PPPoE', description: 'Ajoutez le client PPPoE sur <WAN>. Remplacez <USER> et <PASSWORD> par les identifiants fournis par le NOC.', commands: ['/interface pppoe-client add name=pppoe-out1 interface=<WAN> user=<USER> password=<PASSWORD> disabled=no add-default-route=yes use-peer-dns=yes'], scene: 'configure-device', app: 'Winbox', quiz: { question: 'Quel parametre installe automatiquement la route par defaut ?', options: ['add-default-route=yes', 'disabled=yes', 'use-peer-dns=no'], answerIndex: 0 } }),
        makeStep({ title: 'Configurer le LAN client', description: 'Attribuez une adresse au LAN et creez un pool DHCP si le routeur doit distribuer les adresses aux equipements du client.', commands: ['/ip address add address=192.168.88.1/24 interface=<LAN> comment=LAN_CLIENT', '/ip pool add name=pool-lan ranges=192.168.88.10-192.168.88.250', '/ip dhcp-server add name=dhcp-lan interface=<LAN> address-pool=pool-lan disabled=no', '/ip dhcp-server network add address=192.168.88.0/24 gateway=192.168.88.1 dns-server=8.8.8.8,1.1.1.1'], scene: 'configure-device', app: 'Winbox', quiz: { question: 'Quelle adresse devient la passerelle des clients LAN dans cet exemple ?', options: ['192.168.88.1', '8.8.8.8', '<USER>'], answerIndex: 0 } }),
        makeStep({ title: 'Activer le NAT', description: 'Ajoutez un masquerade pour permettre aux clients LAN de sortir vers Internet via la session PPPoE.', commands: ['/ip firewall nat add chain=srcnat out-interface=pppoe-out1 action=masquerade comment=NAT_PPPoE_CLIENT'], scene: 'configure-device', app: 'Winbox', quiz: { question: 'Pourquoi utilise-t-on masquerade ?', options: ['Pour traduire les adresses LAN vers la sortie Internet', 'Pour creer un compte PPPoE', 'Pour tester le ping'], answerIndex: 0 } }),
        makeStep({ title: 'Valider la connexion', description: 'Controlez que PPPoE est connecte, que la route par defaut existe, puis testez une IP publique et un nom DNS.', commands: ['/interface pppoe-client monitor pppoe-out1', '/ip route print where dst-address=0.0.0.0/0', '/tool ping 8.8.8.8 count=4', '/tool ping google.com count=4'], scene: 'ping-test', quiz: { question: 'Si 8.8.8.8 repond mais google.com echoue, le probleme probable est :', options: ['DNS', 'Cable LAN', 'Mot de passe Winbox'], answerIndex: 0 } }),
        { title: 'Quiz final', description: 'Validez la procedure PPPoE MikroTik.', commands: [], type: 'quiz', scene: 'inspection', app: '', quiz: { question: 'Ordre correct minimal ?', options: ['Interfaces -> PPPoE -> LAN/DHCP -> NAT -> tests', 'NAT -> effacer routes -> reboot', 'DNS -> changer mot de passe -> ping'], answerIndex: 0 } },
      ],
    };
  }

  if (intent === 'mikrotik-internet') {
    return {
      title: 'Mise en service Internet MikroTik',
      steps: [
        makeStep({ title: 'Nommer WAN et LAN', description: 'Identifiez le port fournisseur et le port client pour eviter de mettre DHCP/NAT sur la mauvaise interface.', commands: ['/interface print', '/interface set <WAN> comment=WAN_PROVIDER', '/interface set <LAN> comment=LAN_CLIENT'], scene: 'configure-device', app: 'Winbox', quiz: { question: 'Le WAN est connecte a :', options: ['La liaison fournisseur', 'Le PC client uniquement', 'La console serie'], answerIndex: 0 } }),
        makeStep({ title: 'Configurer l adresse WAN', description: 'Si le fournisseur donne une IP statique, appliquez-la. Si le WAN est DHCP, utilisez la commande DHCP client a la place.', commands: ['/ip address add address=<WAN_IP>/<PREFIX> interface=<WAN> comment=WAN_PROVIDER', '/ip route add dst-address=0.0.0.0/0 gateway=<GATEWAY>', '/ip dns set servers=8.8.8.8,1.1.1.1 allow-remote-requests=yes'], scene: 'configure-device', app: 'Winbox', quiz: { question: 'La route 0.0.0.0/0 sert a :', options: ['Envoyer le trafic inconnu vers Internet', 'Creer le LAN', 'Changer le nom du routeur'], answerIndex: 0 } }),
        makeStep({ title: 'Configurer le LAN et DHCP', description: 'Creez le reseau local client avec une passerelle et un serveur DHCP.', commands: ['/ip address add address=192.168.10.1/24 interface=<LAN> comment=LAN_CLIENT', '/ip pool add name=pool-client ranges=192.168.10.10-192.168.10.254', '/ip dhcp-server add name=dhcp-client interface=<LAN> address-pool=pool-client disabled=no', '/ip dhcp-server network add address=192.168.10.0/24 gateway=192.168.10.1 dns-server=192.168.10.1'], scene: 'configure-device', app: 'Winbox', quiz: { question: 'Le DHCP sert a :', options: ['Distribuer automatiquement les adresses LAN', 'Tester la fibre', 'Supprimer la route'], answerIndex: 0 } }),
        makeStep({ title: 'Ajouter le NAT', description: 'Autorisez les machines LAN a sortir par le WAN.', commands: ['/ip firewall nat add chain=srcnat out-interface=<WAN> action=masquerade comment=NAT_INTERNET'], scene: 'configure-device', app: 'Winbox', quiz: { question: 'Le NAT doit sortir par :', options: ['<WAN>', '<LAN>', 'loopback'], answerIndex: 0 } }),
        makeStep({ title: 'Tester et documenter', description: 'Validez depuis le routeur puis depuis un PC client. Notez les IP, VLAN, login et date de mise en service.', commands: ['/tool ping <GATEWAY> count=4', '/tool ping 8.8.8.8 count=4', '/tool traceroute 8.8.8.8', 'Depuis un PC: ipconfig /all puis ping 8.8.8.8'], scene: 'ping-test', quiz: { question: 'Si le routeur ping Internet mais pas le PC, verifiez d abord :', options: ['DHCP/LAN/NAT', 'Le compte Gmail', 'La taille du disque'], answerIndex: 0 } }),
      ],
    };
  }

  if (intent === 'internet-troubleshooting') {
    return {
      title: 'Diagnostic panne Internet client',
      steps: [
        makeStep({ title: 'Confirmer le symptome', description: `Demandez au client si la panne touche tous les appareils, depuis quand, et si les voyants PWR/PON/LOS/WLAN sont normaux. ${src}`, commands: ['Noter: heure de debut, site client, numero client, equipement touche', 'Verifier: PWR allume, PON fixe, LOS eteint'], scene: 'inspection', quiz: { question: 'LOS rouge/clignotant indique souvent :', options: ['Perte de signal optique', 'Mot de passe Wi-Fi faible', 'Navigateur obsolete'], answerIndex: 0 } }),
        makeStep({ title: 'Tester la couche locale', description: 'Verifiez que le PC recoit une adresse IP, une passerelle et un DNS. Corrigez d abord le LAN si ces valeurs manquent.', commands: ['Windows: ipconfig /all', 'Linux/macOS: ip addr && ip route', 'ping <GATEWAY_LAN>'], scene: 'ping-test', quiz: { question: 'Si le ping vers la passerelle LAN echoue, cherchez d abord :', options: ['Cable/Wi-Fi/DHCP local', 'BGP international', 'Quota YouTube'], answerIndex: 0 } }),
        makeStep({ title: 'Tester depuis le routeur', description: 'Connectez-vous au routeur client et testez la passerelle operateur, une IP publique, puis un nom DNS.', commands: ['/tool ping <GATEWAY> count=4', '/tool ping 8.8.8.8 count=4', '/tool ping google.com count=4', '/ip route print where dst-address=0.0.0.0/0'], scene: 'ping-test', quiz: { question: 'IP publique OK mais nom DNS KO signifie probablement :', options: ['Probleme DNS', 'Cable fibre coupe', 'Mauvais SSID'], answerIndex: 0 } }),
        makeStep({ title: 'Controler l acces fournisseur', description: 'Verifiez la session PPPoE, le VLAN, l interface WAN et les logs. Escaladez au NOC si la liaison operateur ne repond pas.', commands: ['/interface pppoe-client print detail', '/log print where message~"ppp|pppoe|ether|link"', '/interface monitor-traffic <WAN> once'], scene: 'configure-device', app: 'Winbox', quiz: { question: 'Une session PPPoE en echec demande de verifier :', options: ['Login, mot de passe, VLAN et liaison WAN', 'Le fond d ecran', 'La taille du disque'], answerIndex: 0 } }),
        { title: 'Quiz final', description: 'Validez le diagnostic avant cloture du ticket.', commands: [], type: 'quiz', scene: 'inspection', app: '', quiz: { question: 'Ordre de diagnostic recommande ?', options: ['Client/LAN -> routeur -> WAN/fournisseur -> DNS', 'DNS -> peinture -> redemarrage aleatoire', 'Changer tout le materiel directement'], answerIndex: 0 } },
      ],
    };
  }
  return {
    title: 'Diagnostic reseau',
    steps: [
      {
        title: 'Verifier l\'architecture reseau',
        description: `Identifiez le chemin POP -> Provider Edge et les liens utilises (fibre FO ou faisceau FH). ${src}`,
        commands: ['Identifier le POP et le fournisseur de transport', 'Noter le type de lien: FO ou FH'],
        type: 'info',
        scene: 'pop-edge',
        app: '',
        quiz: { question: 'FO et FH designent respectivement :', options: ['Fibre Optique / Faisceau Hertzien', 'Fast Online / Fast Hub', 'Fibre Overlay / Full Host'], answerIndex: 0 },
      },
      {
        title: 'Configurer les equipements',
        description: 'Connectez-vous au routeur (Cisco ou MikroTik), switch ou point d\'acces concerne.',
        commands: ['Ouvrir Winbox (MikroTik) ou Putty (Cisco)', 'Verifier la config interface / VLAN / PPPoE'],
        type: 'run',
        scene: 'configure-device',
        app: 'Winbox',
        quiz: { question: 'Quel logiciel pour administrer un MikroTik ?', options: ['Putty', 'Winbox', 'Wireshark'], answerIndex: 1 },
      },
      {
        title: 'Tester la liaison',
        description: 'Verifiez la connectivite avec ping et des simulations.',
        commands: ['ping 8.8.8.8', 'ping <gateway>', 'traceroute <destination>'],
        type: 'run',
        scene: 'ping-test',
        app: '',
        quiz: { question: 'Un ping vers la passerelle qui echoue indique :', options: ['Un probleme local', 'Un probleme mondial', 'Un probleme de cable chez le client'], answerIndex: 0 },
      },
      {
        title: 'Verifier le compte et les equipements client',
        description: 'Controlez le statut PPPoE, l\'etat du compte et les leds de l\'ONU/CPE.',
        commands: ['Verifier la session PPPoE', 'Verifier les leds ONU (LOS, PWR, PON)'],
        type: 'run',
        scene: 'inspection',
        app: '',
        quiz: { question: 'Une led LOS clignotante sur l\'ONU signifie :', options: ['Pas de signal optique', 'Wifi actif', 'Batterie faible'], answerIndex: 0 },
      },
      {
        title: 'Quiz',
        description: 'Validez vos connaissances.',
        commands: [],
        type: 'quiz',
        scene: 'inspection',
        app: '',
        quiz: { question: 'Quelle est la premiere action lors d\'une panne Internet ?', options: ['Redemarrer le serveur', 'Verifier le signal optique / la led LOS', 'Changer de modem'], answerIndex: 1 },
      },
    ],
  };
}

const OFFLINE_ANSWERS = {
  'mikrotik-pppoe': {
    title: 'Configuration PPPoE sur MikroTik - pas a pas',
    steps: [
      { title: 'Reperer les ports WAN et LAN', body: 'Le WAN est la liaison vers le fournisseur, le LAN le port vers le client. Notez les noms exacts des interfaces avant toute modification.', command: '/interface print\n/ip address print\n/interface bridge port print' },
      { title: 'Creer le client PPPoE sur le WAN', body: 'Remplacez <WAN> par le nom du port fournisseur et <USER> / <PASSWORD> par les identifiants fournis par le NOC. add-default-route=yes installe la route par defaut, use-peer-dns=yes recupere les DNS.', command: '/interface pppoe-client add name=pppoe-out1 interface=<WAN> user=<USER> password=<PASSWORD> disabled=no add-default-route=yes use-peer-dns=yes' },
      { title: 'Configurer le LAN et le serveur DHCP', body: 'La passerelle LAN est 192.168.88.1 dans cet exemple. Le pool distribue les adresses aux equipements du client.', command: '/ip address add address=192.168.88.1/24 interface=<LAN> comment=LAN_CLIENT\n/ip pool add name=pool-lan ranges=192.168.88.10-192.168.88.250\n/ip dhcp-server add name=dhcp-lan interface=<LAN> address-pool=pool-lan disabled=no\n/ip dhcp-server network add address=192.168.88.0/24 gateway=192.168.88.1 dns-server=8.8.8.8,1.1.1.1' },
      { title: 'Activer le NAT (masquerade)', body: 'Sans cette regle, les machines LAN ne peuvent pas sortir vers Internet via la session PPPoE.', command: '/ip firewall nat add chain=srcnat out-interface=pppoe-out1 action=masquerade comment=NAT_PPPoE_CLIENT' },
      { title: 'Valider la connexion', body: 'Le client PPPoE doit etre "connected", la route par defaut doit exister, puis le ping vers 8.8.8.8 et vers google.com doit reussir. Si 8.8.8.8 repond mais google.com echoue, c est un probleme DNS.', command: '/interface pppoe-client monitor pppoe-out1\n/ip route print where dst-address=0.0.0.0/0\n/tool ping 8.8.8.8 count=4\n/tool ping google.com count=4' },
    ],
  },
  'mikrotik-internet': {
    title: 'Mise en service Internet sur MikroTik - pas a pas',
    steps: [
      { title: 'Nommer les interfaces', body: 'Identifiez le port fournisseur (WAN) et le port client (LAN) pour eviter de mettre DHCP ou NAT sur la mauvaise interface.', command: '/interface print\n/interface set <WAN> comment=WAN_PROVIDER\n/interface set <LAN> comment=LAN_CLIENT' },
      { title: 'Configurer l adresse WAN', body: 'Si le fournisseur a donne une IP statique, appliquez-la avec la route par defaut vers la passerelle. Si le WAN est en DHCP, utilisez un DHCP client a la place.', command: '/ip address add address=<WAN_IP>/<PREFIX> interface=<WAN> comment=WAN_PROVIDER\n/ip route add dst-address=0.0.0.0/0 gateway=<GATEWAY>\n/ip dns set servers=8.8.8.8,1.1.1.1 allow-remote-requests=yes' },
      { title: 'Configurer le LAN et le DHCP', body: 'Creez le reseau local du client avec une passerelle et un serveur DHCP qui distribue les adresses.', command: '/ip address add address=192.168.10.1/24 interface=<LAN> comment=LAN_CLIENT\n/ip pool add name=pool-client ranges=192.168.10.10-192.168.10.254\n/ip dhcp-server add name=dhcp-client interface=<LAN> address-pool=pool-client disabled=no\n/ip dhcp-server network add address=192.168.10.0/24 gateway=192.168.10.1 dns-server=192.168.10.1' },
      { title: 'Ajouter le NAT', body: 'Le masquerade doit sortir par le WAN pour traduire les adresses LAN vers Internet.', command: '/ip firewall nat add chain=srcnat out-interface=<WAN> action=masquerade comment=NAT_INTERNET' },
      { title: 'Tester et documenter', body: 'Validez depuis le routeur puis depuis un PC client. Notez les IP, les VLAN, le login et la date de mise en service pour le dossier.', command: '/tool ping <GATEWAY> count=4\n/tool ping 8.8.8.8 count=4\n/tool traceroute 8.8.8.8\nDepuis un PC: ipconfig /all puis ping 8.8.8.8' },
    ],
  },
  'internet-troubleshooting': {
    title: 'Diagnostic panne Internet client - pas a pas',
    steps: [
      { title: 'Confirmer le symptome', body: 'Demandez si la panne touche tous les appareils, depuis quand, et relevez les voyants: PWR allume, PON fixe, LOS eteint, WLAN ok.', command: 'Noter: heure de debut, numero client, equipement touche\nVerifier: PWR allume, PON fixe, LOS eteint' },
      { title: 'Tester la couche locale (PC)', body: 'Verifiez que le PC recoit une adresse IP, une passerelle et un DNS. Si le ping vers la passerelle LAN echoue, le probleme est local (cable, Wi-Fi, DHCP).', command: 'Windows: ipconfig /all\nLinux/macOS: ip addr && ip route\nping <GATEWAY_LAN>' },
      { title: 'Tester depuis le routeur', body: 'Connectez-vous au routeur client. Si l IP publique repond mais pas le nom de domaine, c est un probleme DNS.', command: '/tool ping <GATEWAY> count=4\n/tool ping 8.8.8.8 count=4\n/tool ping google.com count=4\n/ip route print where dst-address=0.0.0.0/0' },
      { title: 'Controler la session fournisseur', body: 'Verifiez la session PPPoE, le VLAN et l interface WAN. Escaladez au NOC si la liaison operateur ne repond pas.', command: '/interface pppoe-client print detail\n/log print where message~"ppp|pppoe|ether|link"\n/interface monitor-traffic <WAN> once' },
    ],
  },
};

const EXTRA_GUIDES = [
  {
    test: /pppoe|ppp/,
    title: 'Comprendre le PPPoE',
    steps: [
      { title: 'Principe', body: 'PPPoE encapsule la session PPP dans des trames Ethernet. Le client PPPoE de la CPE ouvre une session avec le concentrateur d acces (AC) du fournisseur a l aide d un login et d un mot de passe.' },
      { title: 'En pratique', body: 'Le login et le mot de passe sont fournis par le NOC. La session peut porter une route par defaut et les DNS du fournisseur.' },
      { title: 'Verification', body: 'Une session PPPoE "connected" est requise pour l acces Internet. Sinon, verifiez login, mot de passe, VLAN et liaison optique.' },
    ],
  },
  {
    test: /nat|masquerade/,
    title: 'Comprendre le NAT / masquerade',
    steps: [
      { title: 'Principe', body: 'Le NAT (masquerade) traduit les adresses privees du LAN en adresse publique de la sortie WAN. Sans lui, les machines LAN ne peuvent pas atteindre Internet.' },
      { title: 'Regle a creer', body: 'La regle de source NAT doit sortir par l interface WAN (ou la session PPPoE).' },
      { title: 'Verification', body: 'Sur MikroTik: /ip firewall nat print. Un seul masquerade sur la bonne sortie suffit; une regle sur le LAN casserait la navigation.' },
    ],
  },
  {
    test: /dhcp/,
    title: 'Comprendre le DHCP',
    steps: [
      { title: 'Principe', body: 'Le serveur DHCP distribue automatiquement adresse IP, passerelle et DNS aux machines du LAN, ce qui evite la configuration manuelle.' },
      { title: 'Sur MikroTik', body: 'Il faut 3 blocs: un pool d adresses, un serveur DHCP sur l interface LAN, et la definition du reseau (adresse, gateway, DNS).' },
      { title: 'Verification', body: 'Depuis un PC: ipconfig /all (Windows) ou ip addr (Linux). Si le PC n a pas d adresse valide, le serveur DHCP ou le cable est en cause.' },
    ],
  },
  {
    test: /dns/,
    title: 'Comprendre le DNS',
    steps: [
      { title: 'Principe', body: 'Le DNS traduit les noms de domaine (google.com) en adresses IP. Si les IP fonctionnent mais pas les noms, le DNS est en cause.' },
      { title: 'Sur MikroTik', body: 'Configurez les serveurs DNS et autorisez les requetes des clients.', command: '/ip dns set servers=8.8.8.8,1.1.1.1 allow-remote-requests=yes' },
      { title: 'Verification', body: 'ping 8.8.8.8 (IP) puis ping google.com (nom). Si le premier reussit et pas le second, corrigez le DNS.' },
    ],
  },
  {
    test: /los|pon|ont|onu|cpe|fibre|optique/,
    title: 'Diagnostic fibre (voyants ONU/CPE)',
    steps: [
      { title: 'Lire les voyants', body: 'PWR doit etre allume, PON/LOS indique le signal optique: LOS allume ou clignotant = pas de signal optique (fibre, connecteur ou port OLT).' },
      { title: 'Si LOS est anormal', body: 'Re-enfichez le connecteur SC/APC, verifiez la fibre jusqu au point de raccordement puis escaladez au NOC pour tester le port OLT.' },
      { title: 'Si les voyants sont normaux', body: 'Le probleme vient du reseau local (PC, cable, Wi-Fi) ou de la session du client. Poursuivez avec le diagnostic IP/PPPoE.' },
    ],
  },
  {
    test: /winbox|routeros|mikrotik/,
    title: 'Prendre la main sur un MikroTik avec Winbox',
    steps: [
      { title: 'Trouver le routeur', body: 'Ouvrez Winbox, onglet "Neighbors" pour decouvrir le routeur sur le reseau local, ou saisissez directement son adresse IP.' },
      { title: 'Se connecter', body: 'Saisissez le login et le mot de passe (par defaut admin sans mot de passe, a changer immediatement).' },
      { title: 'Utiliser le terminal', body: 'Ouvrez "New Terminal" pour lancer les commandes RouterOS: /interface print, /ip address print, /ip route print.' },
    ],
  },
];

function pickGuide(question) {
  const intent = detectIntent(question);
  if (OFFLINE_ANSWERS[intent]) return OFFLINE_ANSWERS[intent];
  const q = question.toLowerCase();
  for (const g of EXTRA_GUIDES) {
    if (g.test.test(q)) return g;
  }
  return null;
}

function formatGuide(guide, sourceFile) {
  const parts = [guide.title, ''];
  guide.steps.forEach((s, i) => {
    parts.push(`${i + 1}. ${s.title}`);
    parts.push(`   ${s.body}`);
    if (s.command) parts.push(`   Commandes : ${s.command}`);
    parts.push('');
  });
  if (sourceFile) parts.push(`(Source: ${sourceFile})`);
  return parts.join('\n').trim();
}

function fallbackTextAnswer(question, results) {
  const guide = pickGuide(question);
  if (guide) return formatGuide(guide, results[0]?.file);

  const best = results[0];
  if (!best) {
    return 'Je n ai pas trouve de documentation pertinente pour cette question hors ligne.\n\nReformulez votre question, ou posez-la sous la forme "comment configurer..." / "comment depanner..." pour obtenir une feuille de route detaillee avec des etapes precises et des commandes.';
  }
  const clean = best.content.replace(/\s+/g, ' ').trim();
  const sentences = clean.split(/(?<=[.!?])\s+/);
  const words = question.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  let chosen = sentences.filter((s) => words.some((w) => s.toLowerCase().includes(w)));
  if (chosen.length < 2) chosen = sentences.slice(0, 6);
  const lines = chosen.slice(0, 8).map((s, i) => `${i + 1}. ${s.trim()}`).join('\n');
  return `Reponse d'apres la documentation Matrix Telecom (Source: ${best.file}):\n${lines}\n\nPour la procedure complete avec commandes et quiz, posez la question sous la forme "comment configurer..." afin d obtenir une feuille de route.`;
}

function normalizeRoadmap(raw) {
  const steps = Array.isArray(raw?.steps) ? raw.steps : [];
  const knownScenes = ['pop-edge', 'configure-device', 'ping-test', 'app-walkthrough', 'inspection'];
  return {
    title: raw?.title || 'Feuille de route',
    steps: steps.slice(0, 8).map((s, i) => ({
      title: s?.title || `Etape ${i + 1}`,
      description: s?.description || '',
      commands: Array.isArray(s?.commands) ? s.commands : [],
      type: s?.type === 'run' ? 'run' : i === steps.length - 1 ? 'quiz' : 'info',
      scene: knownScenes.includes(s?.scene) ? s.scene : 'inspection',
      app: typeof s?.app === 'string' ? s.app : '',
      quiz: s?.quiz || null,
    })),
  };
}

async function openaiTextAnswer(question, ctx) {
  const openai = getOpenAI();
  if (!openai) return null;
  const completion = await openai.chat.completions.create({
    model: config.openai.model,
    temperature: 0.3,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: `Contexte documentaire:\n${ctx || 'Aucun document pertinent trouve.'}` },
      { role: 'user', content: question },
    ],
  });
  return completion.choices[0].message.content;
}

async function geminiTextAnswer(question, ctx) {
  return geminiGenerate({ system: SYSTEM_PROMPT, context: ctx, question, json: false });
}

async function openaiRoadmap(question, ctx) {
  const openai = getOpenAI();
  if (!openai) return null;
  const completion = await openai.chat.completions.create({
    model: config.openai.model,
    response_format: { type: 'json_object' },
    temperature: 0.5,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: `Contexte documentaire:\n${ctx || 'Aucun document pertinent trouve.'}` },
      { role: 'system', content: ROADMAP_PROMPT },
      { role: 'user', content: question },
    ],
  });
  return normalizeRoadmap(JSON.parse(completion.choices[0].message.content));
}

async function geminiRoadmap(question, ctx) {
  const raw = await geminiGenerate({
    system: `${SYSTEM_PROMPT}\n\n${ROADMAP_PROMPT}`,
    context: ctx,
    question,
    json: true,
  });
  return raw ? normalizeRoadmap(raw) : null;
}

export async function answerQuestion(question) {
  const { results, embedded } = await searchKnowledge(question);
  const ctx = buildContext(results);
  const sources = results.slice(0, 3).map((r) => ({ title: r.file, snippet: r.content.slice(0, 160) }));
  const wantsRoadmap = shouldBuildRoadmap(question);

  const usedProviders = [];
  let roadmap = null;
  let text = '';

  if (wantsRoadmap) {
    let gen;
    if (hasOpenAIKey()) {
      try {
        gen = await openaiRoadmap(question, ctx);
        usedProviders.push('openai');
      } catch (err) {
        console.error('[ai] OpenAI roadmap failed:', err.message);
      }
    }
    if (!gen && hasGeminiKey()) {
      try {
        gen = await geminiRoadmap(question, ctx);
        usedProviders.push('gemini');
      } catch (err) {
        console.error('[ai] Gemini roadmap failed:', err.message);
      }
    }
    if (gen) {
      roadmap = gen;
      text = `Voici une feuille de route pour : ${roadmap.title}. Suivez les etapes, les animations vous montrent chaque action.`;
    } else {
      usedProviders.push('offline');
      roadmap = fallbackRoadmap(question, results[0]?.file);
      text = fallbackTextAnswer(question, results);
    }
  } else {
    const answers = [];
    if (hasOpenAIKey()) {
      try {
        const a = await openaiTextAnswer(question, ctx);
        if (a) {
          answers.push({ label: 'OpenAI', body: a });
          usedProviders.push('openai');
        }
      } catch (err) {
        console.error('[ai] OpenAI answer failed:', err.message);
      }
    }
    if (hasGeminiKey()) {
      try {
        const a = await geminiTextAnswer(question, ctx);
        if (a) {
          answers.push({ label: 'Gemini', body: a });
          usedProviders.push('gemini');
        }
      } catch (err) {
        console.error('[ai] Gemini answer failed:', err.message);
      }
    }

    if (answers.length === 1) {
      text = answers[0].body;
    } else if (answers.length > 1) {
      text = `${answers[0].body}\n\n--- Complement ${answers[1].label} ---\n${answers[1].body}`;
    } else {
      usedProviders.push('offline');
      text = fallbackTextAnswer(question, results);
    }
  }

  const result = {
    type: wantsRoadmap ? 'roadmap' : 'text',
    text,
    roadmap,
    sources,
    providers: usedProviders,
    embedded,
    hasContext: results.length > 0,
  };
  return enrichWithVideos(question, result);
}

export async function generateRoadmapOnly(question) {
  const { results } = await searchKnowledge(question);
  const ctx = buildContext(results);
  const fallback = fallbackRoadmap(question, results[0]?.file);

  let result = { roadmap: fallback, providers: ['offline'] };
  if (hasOpenAIKey()) {
    try {
      const roadmap = await openaiRoadmap(question, ctx);
      if (roadmap) result = { roadmap, providers: ['openai'] };
    } catch (err) {
      console.error('[ai] OpenAI roadmap failed:', err.message);
    }
  }
  if (!result.roadmap || result.providers.includes('offline')) {
    if (hasGeminiKey()) {
      try {
        const roadmap = await geminiRoadmap(question, ctx);
        if (roadmap) result = { roadmap, providers: ['gemini'] };
      } catch (err) {
        console.error('[ai] Gemini roadmap failed:', err.message);
      }
    }
  }
  return enrichWithVideos(question, result);
}
