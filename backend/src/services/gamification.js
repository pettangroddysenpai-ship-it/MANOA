const XP_PER_STEP = 25;
const XP_ROADMAP_BONUS = 50;

export function levelForXp(xp) {
  return Math.floor(xp / 100) + 1;
}

export function badgesFor(xp, { chatCount = 0, roadmapsDone = 0 } = {}) {
  const badges = [];
  if (xp >= 50) badges.push('Telecom Debutant');
  if (xp >= 200) badges.push('Agent Reseau');
  if (xp >= 500) badges.push('Technicien Confirme');
  if (xp >= 1000) badges.push('Expert Telecom');
  if (chatCount >= 5) badges.push('Curieux');
  if (roadmapsDone >= 3) badges.push('Apprenant Assidu');
  return badges;
}

export async function awardXp(db, userId, amount) {
  const user = (await db.getUser(userId)) || (await db.createUser({ id: userId, name: 'Visiteur' }));
  const xp = (user.xp || 0) + amount;
  const patch = { xp, level: levelForXp(xp) };
  patch.badges = badgesFor(xp, { chatCount: user.chatCount || 0, roadmapsDone: user.roadmapsDone || 0 });
  return db.updateUser(userId, patch);
}

export async function registerChatActivity(db, userId) {
  const user = (await db.getUser(userId)) || (await db.createUser({ id: userId, name: 'Visiteur' }));
  const today = new Date().toISOString().slice(0, 10);
  const lastDay = user.lastActiveDay;
  let streak = user.streak || 0;
  if (lastDay !== today) {
    streak = lastDay && new Date(today) - new Date(lastDay) === 86400000 ? streak + 1 : 1;
  }
  const chatCount = (user.chatCount || 0) + 1;
  return db.updateUser(userId, {
    streak,
    chatCount,
    lastActiveDay: today,
    badges: badgesFor(user.xp || 0, { chatCount, roadmapsDone: user.roadmapsDone || 0 }),
  });
}

export async function completeRoadmapStep(db, userId, progressId, stepIndex) {
  const list = await db.getProgress(userId);
  const item = list.find((p) => p.id === progressId);
  if (!item) return { ok: false, reason: 'roadmap introuvable' };

  if (stepIndex < 0 || stepIndex >= item.steps.length) return { ok: false, reason: 'etape invalide' };
  if (stepIndex > 0 && !item.steps[stepIndex - 1].completed) {
    return { ok: false, reason: 'etape verrouillee' };
  }
  if (item.steps[stepIndex].completed) return { ok: false, reason: 'deja completee' };

  item.steps[stepIndex].completed = true;
  const allDone = item.steps.every((s) => s.completed);

  let xpEarned = XP_PER_STEP;
  if (allDone) {
    item.completed = true;
    xpEarned += XP_ROADMAP_BONUS;
  }

  await db.saveProgress(userId, item);
  let user = await awardXp(db, userId, xpEarned);
  if (allDone) {
    user = await db.updateUser(userId, {
      roadmapsDone: (user.roadmapsDone || 0) + 1,
      badges: badgesFor(user.xp || 0, { chatCount: user.chatCount || 0, roadmapsDone: (user.roadmapsDone || 0) + 1 }),
    });
  }

  return { ok: true, xpEarned, allDone, user, roadmap: item };
}
