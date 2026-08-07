import { getOpenAI, embed } from './openai.js';
import { config, hasOpenAIKey } from '../config/index.js';
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
      "description": "explication courte et concrete",
      "commands": ["commande ou action a executer"],
      "type": "info" | "run",
      "quiz": { "question": "question rapide", "options": ["a","b","c"], "answerIndex": 0 }
    }
  ]
}
La derniere etape doit etre "Quiz" avec un quiz obligatoire (quiz non vide).
Chaque etape sauf la derniere doit avoir un quiz OU une description tres detaillee.`;

const SYSTEM_PROMPT = `Tu es "MANOA", l'assistant technique virtuel de Matrix Telecom, un FAI du Cameroun.
Tu reponds en francais, de facon claire, courte et professionnelle, comme un ingenieur reseau.
Lorsqu'on te fournit des extraits de la documentation interne Matrix, base-toi sur eux pour repondre
et cite la source entre parentheses, par exemple (Source: routage-mikrotik).
Si tu ne sais pas, dis-le honnêtement et propose la marche a suivre.`;

const ROADMAP_KEYWORDS = /comment\s+|comment faire|configurer|depanner|troubleshoot|resoudre|résoudre|installer|mettre en place|creer|créer|mettre en oeuvre|expliquer pas a pas|pas à pas|procedure|procédure|etapes|étapes/i;

export function shouldBuildRoadmap(question) {
  return ROADMAP_KEYWORDS.test(question);
}

function buildContext(results) {
  return results
    .map((r, i) => `[Extrait ${i + 1}] (Source: ${r.file})\n${r.content.slice(0, 900)}`)
    .join('\n\n');
}

function fallbackRoadmap(question, sourceFile) {
  const src = sourceFile ? `(Source: ${sourceFile})` : '';
  return {
    title: 'Diagnostic reseau',
    steps: [
      {
        title: 'Identification du probleme',
        description: `Recueillez les symptomes exacts rapportes par le client ou observes. ${src}`,
        commands: ['Noter le symptome, la zone et le type de service'],
        type: 'info',
        quiz: { question: 'Pourquoi est-il important d\'identifier les symptomes ?', options: ['Pour gagner du temps', 'Pour cibler la cause racine', 'Ce n\'est pas utile'], answerIndex: 1 },
      },
      {
        title: 'Verification physique',
        description: 'Verifiez l\'alimentation, les cables et les leds du CPE / ONU.',
        commands: ['Verifier la led LOS et PWR sur l\'ONU', 'Verifier les connecteurs et la fibre'],
        type: 'run',
        quiz: { question: 'Que signifie une led LOS qui clignote ?', options: ['Connexion OK', 'Pas de signal optique', 'Surconsommation'], answerIndex: 1 },
      },
      {
        title: 'Test de connectivite',
        description: 'Pingez la passerelle puis une adresse publique.',
        commands: ['ping 8.8.8.8', 'ping <gateway>'],
        type: 'run',
        quiz: { question: 'Si le ping vers la passerelle echoue, le probleme est :', options: ['Public', 'Local (CPE/rezo)', 'Chez Google'], answerIndex: 1 },
      },
      {
        title: 'Verification du compte client',
        description: 'Controlez le statut du compte, l\'etat PPPoE et le solde.',
        commands: ['Verifier la session PPPoE', 'Verifier le statut du compte client'],
        type: 'run',
        quiz: { question: 'Une session PPPoE inactive peut indiquer :', options: ['Un probleme de compte', 'Une panne mondiale', 'Un probleme meteorologique'], answerIndex: 0 },
      },
      {
        title: 'Quiz',
        description: 'Validez ce que vous avez appris.',
        commands: [],
        type: 'quiz',
        quiz: { question: 'Quelle est la premiere chose a verifier lors d\'une panne Internet ?', options: ['Le code postal', 'Le signal optique / la led LOS', 'La meteo'], answerIndex: 1 },
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
  return `D'apres la documentation interne Matrix Telecom (Source: ${best.file}): ${snippet.slice(0, 600)}...`;
}

export async function answerQuestion(question) {
  const sources = [];
  let text = '';
  let roadmap = null;
  let provider = 'openai';

  const { results, embedded } = await searchKnowledge(question);
  const ctx = buildContext(results);
  for (const r of results.slice(0, 3)) sources.push({ title: r.file, snippet: r.content.slice(0, 160) });

  const wantsRoadmap = shouldBuildRoadmap(question);
  const openai = getOpenAI();

  if (!openai) {
    provider = 'offline';
    if (wantsRoadmap) {
      roadmap = fallbackRoadmap(question, results[0]?.file);
    }
    text = fallbackTextAnswer(question, results);
    return { type: wantsRoadmap ? 'roadmap' : 'text', text, roadmap, sources, provider, embedded, hasContext: results.length > 0 };
  }

  try {
    if (wantsRoadmap) {
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
      const raw = completion.choices[0].message.content;
      roadmap = normalizeRoadmap(JSON.parse(raw));
      text = `Voici une feuille de route pour : ${roadmap.title}. Suivez les etapes ci-dessous.`;
    } else {
      const completion = await openai.chat.completions.create({
        model: config.openai.model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: `Contexte documentaire:\n${ctx || 'Aucun document pertinent trouve.'}` },
          { role: 'user', content: question },
        ],
      });
      text = completion.choices[0].message.content;
    }
  } catch (err) {
    console.error('[ai] OpenAI call failed:', err.message);
    provider = 'offline';
    if (wantsRoadmap) roadmap = fallbackRoadmap(question, results[0]?.file);
    text = fallbackTextAnswer(question, results);
  }

  return { type: wantsRoadmap ? 'roadmap' : 'text', text, roadmap, sources, provider, embedded, hasContext: results.length > 0 };
}

export async function generateRoadmapOnly(question) {
  const { results } = await searchKnowledge(question);
  const openai = getOpenAI();
  const fallback = fallbackRoadmap(question, results[0]?.file);

  if (!openai) return { roadmap: fallback, provider: 'offline' };

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      response_format: { type: 'json_object' },
      temperature: 0.5,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'system', content: `Contexte documentaire:\n${buildContext(results) || 'Aucun document pertinent.'}` },
        { role: 'system', content: ROADMAP_PROMPT },
        { role: 'user', content: question },
      ],
    });
    return { roadmap: normalizeRoadmap(JSON.parse(completion.choices[0].message.content)), provider: 'openai' };
  } catch (err) {
    console.error('[ai] Roadmap generation failed:', err.message);
    return { roadmap: fallback, provider: 'offline' };
  }
}

function normalizeRoadmap(raw) {
  const steps = Array.isArray(raw?.steps) ? raw.steps : [];
  return {
    title: raw?.title || 'Feuille de route',
    steps: steps.slice(0, 8).map((s, i) => ({
      title: s?.title || `Etape ${i + 1}`,
      description: s?.description || '',
      commands: Array.isArray(s?.commands) ? s.commands : [],
      type: s?.type === 'run' ? 'run' : i === steps.length - 1 ? 'quiz' : 'info',
      quiz: s?.quiz || null,
    })),
  };
}
