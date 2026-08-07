import { getOpenAI, embed } from './openai.js';
import { geminiGenerate } from './geminiService.js';
import { config, hasOpenAIKey, hasGeminiKey } from '../config/index.js';
import { searchKnowledge } from './knowledgeBase.js';

const ROADMAP_PROMPT = `Tu es un assistant telecom de Matrix Telecom qui repond en francais.
L'utilisateur pose une question "comment faire / comment configurer / comment resoudre".
Genere une feuille de route pedagogique (type Duolingo) de 4 a 7 etapes pour repondre.
Reponds STRICTEMENT en JSON, sans texte autour, au format:
{
  "title": "titre court",
  "steps": [
    {
      "title": "titre de l'etape",
      "description": "explication courte, precise et concrete",
      "commands": ["commande ou action a executer"],
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
Tu reponds en francais de facon PRECISE, CLAIRE et ACTIONNABLE, comme un ingenieur reseau senior.
Regles:
1. Reponds en etapes numerotees courtes et concretes.
2. Cite toujours la source entre parentheses quand tu utilises un extrait, exemple (Source: routage-mikrotik).
3. Donne les commandes exactes (ex: /interface vlan add name=vlan20 vlan-id=20 interface=ether1).
4. Si plusieurs causes possibles, classe-les par probabilite.
5. Si tu ne sais pas, dis-le et indique ou trouver l'information.`;

const ROADMAP_KEYWORDS = /comment\s+|comment faire|configurer|depanner|troubleshoot|resoudre|résoudre|installer|mettre en place|creer|créer|mettre en oeuvre|expliquer pas a pas|pas à pas|procedure|procédure|etapes|étapes|marche à suivre|marche a suivre/i;

export function shouldBuildRoadmap(question) {
  return ROADMAP_KEYWORDS.test(question);
}

function buildContext(results) {
  return results
    .map((r, i) => `[Extrait ${i + 1}] (Source: ${r.file})\n${r.content.slice(0, 1200)}`)
    .join('\n\n');
}

function fallbackRoadmap(question, sourceFile) {
  const src = sourceFile ? `(Source: ${sourceFile})` : '';
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

function fallbackTextAnswer(question, results) {
  const best = results[0];
  if (!best) {
    return 'Je suis desole, je n\'ai pas trouve d\'information dans la base de connaissances. Pouvez-vous reformuler votre question ?';
  }
  const snippet = best.content.replace(/\s+/g, ' ').trim();
  return `D'apres la documentation interne Matrix Telecom (Source: ${best.file}):\n${snippet.slice(0, 700)}...`;
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

  return {
    type: wantsRoadmap ? 'roadmap' : 'text',
    text,
    roadmap,
    sources,
    providers: usedProviders,
    embedded,
    hasContext: results.length > 0,
  };
}

export async function generateRoadmapOnly(question) {
  const { results } = await searchKnowledge(question);
  const ctx = buildContext(results);
  const fallback = fallbackRoadmap(question, results[0]?.file);

  if (hasOpenAIKey()) {
    try {
      const roadmap = await openaiRoadmap(question, ctx);
      if (roadmap) return { roadmap, providers: ['openai'] };
    } catch (err) {
      console.error('[ai] OpenAI roadmap failed:', err.message);
    }
  }
  if (hasGeminiKey()) {
    try {
      const roadmap = await geminiRoadmap(question, ctx);
      if (roadmap) return { roadmap, providers: ['gemini'] };
    } catch (err) {
      console.error('[ai] Gemini roadmap failed:', err.message);
    }
  }
  return { roadmap: fallback, providers: ['offline'] };
}
