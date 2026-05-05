const STORAGE_KEY = "pickleball-openplay-manager-v1";

const state = {
  players: [],
  sitouts: [],
  courts: [],
  settings: {
    courtCount: 4,
    preferSkill: true,
    sessionName: "Pickleball Queue"
  },
  stats: {},
  recentPartners: {},
  matchupStreaks: {},
  matchLog: [],
  finalStandings: null,
  gamesRun: 0
};

const els = {
  form: document.querySelector("#playerForm"),
  playerName: document.querySelector("#playerName"),
  playerLevel: document.querySelector("#playerLevel"),
  partySize: document.querySelector("#partySize"),
  sessionName: document.querySelector("#sessionName"),
  customMatchForm: document.querySelector("#customMatchForm"),
  customCourt: document.querySelector("#customCourt"),
  teamA1: document.querySelector("#teamA1"),
  teamA2: document.querySelector("#teamA2"),
  teamB1: document.querySelector("#teamB1"),
  teamB2: document.querySelector("#teamB2"),
  courtCount: document.querySelector("#courtCount"),
  preferSkill: document.querySelector("#preferSkill"),
  queueList: document.querySelector("#queueList"),
  sitoutList: document.querySelector("#sitoutList"),
  courtsGrid: document.querySelector("#courtsGrid"),
  upNextList: document.querySelector("#upNextList"),
  courtHint: document.querySelector("#courtHint"),
  queueHint: document.querySelector("#queueHint"),
  playerCount: document.querySelector("#playerCount"),
  waitingMetric: document.querySelector("#waitingMetric"),
  playingMetric: document.querySelector("#playingMetric"),
  openCourtMetric: document.querySelector("#openCourtMetric"),
  gamesMetric: document.querySelector("#gamesMetric"),
  leaderboard: document.querySelector("#leaderboard"),
  standingsBoard: document.querySelector("#standingsBoard"),
  standingsHint: document.querySelector("#standingsHint"),
  matchLog: document.querySelector("#matchLog"),
  generateStandingsBtn: document.querySelector("#generateStandingsBtn"),
  assignNextBtn: document.querySelector("#assignNextBtn"),
  autoFillBtn: document.querySelector("#autoFillBtn"),
  clearAllBtn: document.querySelector("#clearAllBtn"),
  playerTemplate: document.querySelector("#playerTemplate"),
  courtTemplate: document.querySelector("#courtTemplate")
};

const levelRank = {
  Beginner: 1,
  Intermediate: 2,
  Advanced: 3
};

const courtColors = ["#c8f1df", "#cfe0ff", "#f4d5ea", "#ffe1b8", "#dedcff", "#c9eef3", "#ffd1cd", "#dceec4"];

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    syncCourts();
    return;
  }

  try {
    const parsed = JSON.parse(stored);
    state.players = Array.isArray(parsed.players) ? parsed.players : [];
    state.sitouts = Array.isArray(parsed.sitouts) ? parsed.sitouts : [];
    state.courts = Array.isArray(parsed.courts) ? parsed.courts : [];
    state.settings = { ...state.settings, ...(parsed.settings || {}) };
    state.stats = parsed.stats || {};
    state.recentPartners = parsed.recentPartners || {};
    state.matchupStreaks = parsed.matchupStreaks || {};
    state.matchLog = Array.isArray(parsed.matchLog) ? parsed.matchLog : [];
    state.finalStandings = parsed.finalStandings || null;
    state.gamesRun = Number(parsed.gamesRun || 0);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  syncCourts();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function syncCourts() {
  const desired = clamp(Number(state.settings.courtCount), 1, 12);
  state.settings.courtCount = desired;

  while (state.courts.length < desired) {
    state.courts.push({ id: uid(), number: state.courts.length + 1, game: null });
  }

  if (state.courts.length > desired) {
    const removed = state.courts.splice(desired);
    removed.forEach((court) => {
      if (court.game) {
        requeuePlayers(court.game.players);
      }
    });
  }

  state.courts.forEach((court, index) => {
    court.number = index + 1;
  });
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function addPlayer(name, level, partySize) {
  const trimmed = name.trim();
  if (!trimmed) return;

  const partyId = Number(partySize) > 1 ? uid() : null;
  const count = clamp(Number(partySize), 1, 4);
  const partyLabel = count > 1 ? `party of ${count}` : "";

  for (let index = 0; index < count; index += 1) {
    state.players.push({
      id: uid(),
      name: count === 1 ? trimmed : `${trimmed} ${index + 1}`,
      level,
      partyId,
      partySize: count,
      partyLabel,
      checkedInAt: Date.now()
    });
  }
}

function addNamedParty(names, level) {
  const partyId = uid();
  const partySize = names.length;
  names.forEach((name) => {
    state.players.push({
      id: uid(),
      name,
      level,
      partyId,
      partySize,
      partyLabel: `party of ${partySize}`,
      checkedInAt: Date.now()
    });
  });
}

function addPlayersFromInput(value, level, partySize) {
  const names = value
    .split(/[\n,]+/)
    .map((name) => name.trim())
    .filter(Boolean);
  const count = clamp(Number(partySize), 1, 4);

  if (names.length > 1) {
    if (count === 1) {
      names.forEach((name) => addPlayer(name, level, 1));
      return names.length;
    }

    for (let index = 0; index < names.length; index += count) {
      const group = names.slice(index, index + count);
      if (group.length === count) {
        addNamedParty(group, level);
      } else {
        group.forEach((name) => addPlayer(name, level, 1));
      }
    }
    return names.length;
  }

  addPlayer(value, level, count);
  return value.trim() ? 1 : 0;
}

function removePlayer(playerId) {
  state.players = state.players.filter((player) => player.id !== playerId);
}

function sitOutPlayer(playerId) {
  const index = state.players.findIndex((player) => player.id === playerId);
  if (index < 0) return;
  const [player] = state.players.splice(index, 1);
  state.sitouts.push({ ...player, satOutAt: Date.now() });
}

function checkInPlayer(playerId) {
  const index = state.sitouts.findIndex((player) => player.id === playerId);
  if (index < 0) return;
  const [player] = state.sitouts.splice(index, 1);
  state.players.push({ ...player, checkedInAt: Date.now() });
}

function removeSitout(playerId) {
  state.sitouts = state.sitouts.filter((player) => player.id !== playerId);
}

function movePlayer(playerId, direction) {
  const index = state.players.findIndex((player) => player.id === playerId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= state.players.length) return;
  const [player] = state.players.splice(index, 1);
  state.players.splice(nextIndex, 0, player);
}

function selectNextFour() {
  return selectNextFourFrom(state.players);
}

function selectNextFourFrom(players) {
  if (players.length < 4) return [];

  const candidatePool = players.slice(0, Math.min(24, players.length));
  let bestGroup = candidatePool.slice(0, 4);
  let bestScore = Infinity;

  combinations(candidatePool, 4).forEach((group) => {
    const ranks = group.map((player) => levelRank[player.level] || 2);
    const spread = Math.max(...ranks) - Math.min(...ranks);
    const oldestIndexPenalty = group.reduce((sum, player) => sum + players.findIndex((item) => item.id === player.id), 0) / 20;
    const partyPenalty = splitPartyPenalty(group, players);
    const streakPenalty = sharedStreakPenalty(group);
    const waitBonus = longWaitBonus(group);
    const score = streakPenalty + (state.settings.preferSkill ? spread * 5 : 0) + oldestIndexPenalty + partyPenalty - waitBonus;
    if (score < bestScore) {
      bestGroup = group;
      bestScore = score;
    }
  });

  return bestGroup;
}

function splitPartyPenalty(group, queue = state.players) {
  const partyCounts = {};
  group.forEach((player) => {
    if (player.partyId) partyCounts[player.partyId] = (partyCounts[player.partyId] || 0) + 1;
  });

  return Object.entries(partyCounts).reduce((penalty, [partyId, selectedCount]) => {
    const waitingCount = queue.filter((player) => player.partyId === partyId).length;
    return selectedCount > 0 && selectedCount < waitingCount ? penalty + 2000 : penalty;
  }, 0);
}

function longWaitBonus(group) {
  const fifteenMinutes = 15 * 60 * 1000;
  return group.reduce((sum, player) => {
    const waitedMs = Date.now() - Number(player.checkedInAt || Date.now());
    if (waitedMs <= fifteenMinutes) return sum;
    const extraFiveMinuteBlocks = Math.floor((waitedMs - fifteenMinutes) / (5 * 60 * 1000));
    return sum + 120 + extraFiveMinuteBlocks * 20;
  }, 0);
}

function sharedStreakPenalty(group) {
  return pairCombinations(group).reduce((sum, pair) => {
    if (sameParty(pair[0], pair[1])) return sum;
    const streak = sharedStreak(pair[0], pair[1]);
    return sum + (streak >= 2 ? 1000 : streak * 22);
  }, 0);
}

function combinations(items, size) {
  const results = [];

  function walk(start, group) {
    if (group.length === size) {
      results.push([...group]);
      return;
    }

    for (let index = start; index < items.length; index += 1) {
      group.push(items[index]);
      walk(index + 1, group);
      group.pop();
    }
  }

  walk(0, []);
  return results;
}

function assignNextCourt(targetCourtId = null) {
  const openCourt = targetCourtId
    ? state.courts.find((court) => court.id === targetCourtId && !court.game)
    : state.courts.find((court) => !court.game);
  const selected = selectNextFour();
  if (!openCourt || selected.length < 4) return false;

  const selectedIds = new Set(selected.map((player) => player.id));
  state.players = state.players.filter((player) => !selectedIds.has(player.id));
  const teams = buildTeams(selected);
  openCourt.game = {
    id: uid(),
    startedAt: Date.now(),
    players: [...teams.teamA, ...teams.teamB],
    teamA: teams.teamA,
    teamB: teams.teamB,
    scoreA: 0,
    scoreB: 0
  };
  return true;
}

function assignCustomMatch(courtId, teamAIds, teamBIds) {
  const openCourt = state.courts.find((court) => court.id === courtId && !court.game);
  const selectedIds = [...teamAIds, ...teamBIds];
  const uniqueIds = new Set(selectedIds);
  if (!openCourt || selectedIds.length !== 4 || uniqueIds.size !== 4) return false;

  const playersById = new Map(state.players.map((player) => [player.id, player]));
  const selected = selectedIds.map((id) => playersById.get(id));
  if (selected.some((player) => !player)) return false;
  if (wouldCreateThirdSharedGame(selected)) return false;
  if (splitsLockedParty(selected)) return false;

  const teamA = teamAIds.map((id) => playersById.get(id));
  const teamB = teamBIds.map((id) => playersById.get(id));
  if (splitsLockedPairAcrossTeams(teamA, teamB)) return false;
  state.players = state.players.filter((player) => !uniqueIds.has(player.id));
  openCourt.game = {
    id: uid(),
    startedAt: Date.now(),
    players: [...teamA, ...teamB],
    teamA,
    teamB,
    scoreA: 0,
    scoreB: 0,
    custom: true
  };
  return true;
}

function autoFillCourts() {
  let assigned = false;
  while (assignNextCourt()) {
    assigned = true;
  }
  return assigned;
}

function finishGame(courtId, requeueWinnersFirst = false, winnerSide = null) {
  const court = state.courts.find((item) => item.id === courtId);
  if (!court || !court.game) return;

  const teamA = court.game.teamA || court.game.players.slice(0, 2);
  const teamB = court.game.teamB || court.game.players.slice(2, 4);
  const teamAWon = winnerSide ? winnerSide === "A" : court.game.scoreA >= court.game.scoreB;
  const winners = teamAWon ? teamA : teamB;
  const losers = teamAWon ? teamB : teamA;
  const returning = requeueWinnersFirst ? [...winners, ...losers] : crossPairReturnOrder(winners, losers);

  addMatchLogEntry(court, teamA, teamB, winners);
  updateStats(teamA, teamB, winners);
  rememberPartners(teamA);
  rememberPartners(teamB);
  rememberSharedMatchups([...teamA, ...teamB]);
  court.game = null;
  state.gamesRun += 1;
  requeuePlayers(returning);
}

function addMatchLogEntry(court, teamA, teamB, winners) {
  const winnerIds = new Set(winners.map((player) => player.id));
  const winnerLabel = winnerIds.has(teamA[0].id) ? "Team A" : "Team B";

  state.matchLog.unshift({
    id: uid(),
    courtNumber: court.number,
    courtColor: court.color || courtColors[(court.number - 1) % courtColors.length],
    finishedAt: Date.now(),
    elapsedMs: Date.now() - court.game.startedAt,
    teamA: teamA.map((player) => player.name),
    teamB: teamB.map((player) => player.name),
    scoreA: court.game.scoreA,
    scoreB: court.game.scoreB,
    winnerLabel
  });

  state.matchLog = state.matchLog.slice(0, 80);
}

function buildTeams(players) {
  const pairings = [
    [[players[0], players[1]], [players[2], players[3]]],
    [[players[0], players[2]], [players[1], players[3]]],
    [[players[0], players[3]], [players[1], players[2]]]
  ];

  let best = pairings[0];
  let bestScore = Infinity;
  pairings.forEach((pairing) => {
    const partnerScore = partnerCount(pairing[0][0], pairing[0][1]) + partnerCount(pairing[1][0], pairing[1][1]);
    const partnerStreakScore = sharedStreak(pairing[0][0], pairing[0][1]) + sharedStreak(pairing[1][0], pairing[1][1]);
    const lockedPairScore = lockedPairPenalty(pairing);
    const strengthScore = Math.abs(teamStrength(pairing[0]) - teamStrength(pairing[1]));
    const score = lockedPairScore + partnerScore * 10 + partnerStreakScore * 25 + strengthScore;
    if (score < bestScore) {
      best = pairing;
      bestScore = score;
    }
  });

  return { teamA: best[0], teamB: best[1] };
}

function crossPairReturnOrder(winners, losers) {
  return [winners[0], losers[0], winners[1], losers[1]];
}

function ensureStat(player) {
  if (!state.stats[player.id]) {
    state.stats[player.id] = {
      name: player.name,
      level: player.level,
      games: 0,
      wins: 0,
      opponentStrengthTotal: 0
    };
  }

  state.stats[player.id].name = player.name;
  state.stats[player.id].level = player.level;
  return state.stats[player.id];
}

function updateStats(teamA, teamB, winners) {
  const winnerIds = new Set(winners.map((player) => player.id));
  const strengthSnapshot = {};
  [...teamA, ...teamB].forEach((player) => {
    strengthSnapshot[player.id] = playerStrength(player);
  });

  teamA.forEach((player) => recordResult(player, teamB, winnerIds.has(player.id), strengthSnapshot));
  teamB.forEach((player) => recordResult(player, teamA, winnerIds.has(player.id), strengthSnapshot));
}

function recordResult(player, opponents, won, strengthSnapshot) {
  const stat = ensureStat(player);
  stat.games += 1;
  stat.wins += won ? 1 : 0;
  stat.opponentStrengthTotal += opponents.reduce((sum, opponent) => sum + strengthSnapshot[opponent.id], 0) / opponents.length;
}

function rememberPartners(team) {
  if (team.length < 2) return;
  const [a, b] = team;
  state.recentPartners[a.id] = state.recentPartners[a.id] || {};
  state.recentPartners[b.id] = state.recentPartners[b.id] || {};
  state.recentPartners[a.id][b.id] = (state.recentPartners[a.id][b.id] || 0) + 1;
  state.recentPartners[b.id][a.id] = (state.recentPartners[b.id][a.id] || 0) + 1;
}

function partnerCount(a, b) {
  return state.recentPartners[a.id]?.[b.id] || 0;
}

function rememberSharedMatchups(players) {
  const playerIds = players.map((player) => player.id);

  playerIds.forEach((playerId) => {
    state.matchupStreaks[playerId] = state.matchupStreaks[playerId] || {};
    Object.keys(state.matchupStreaks[playerId]).forEach((otherId) => {
      if (!playerIds.includes(otherId)) {
        state.matchupStreaks[playerId][otherId] = 0;
        if (state.matchupStreaks[otherId]) {
          state.matchupStreaks[otherId][playerId] = 0;
        }
      }
    });
  });

  pairCombinations(players).forEach(([a, b]) => {
    state.matchupStreaks[a.id] = state.matchupStreaks[a.id] || {};
    state.matchupStreaks[b.id] = state.matchupStreaks[b.id] || {};
    const nextStreak = Math.max(state.matchupStreaks[a.id][b.id] || 0, state.matchupStreaks[b.id][a.id] || 0) + 1;
    state.matchupStreaks[a.id][b.id] = nextStreak;
    state.matchupStreaks[b.id][a.id] = nextStreak;
  });
}

function sharedStreak(a, b) {
  return state.matchupStreaks[a.id]?.[b.id] || 0;
}

function wouldCreateThirdSharedGame(players) {
  return pairCombinations(players).some(([a, b]) => !sameParty(a, b) && sharedStreak(a, b) >= 2);
}

function splitsLockedParty(players) {
  const selectedIds = new Set(players.map((player) => player.id));
  const partyIds = new Set(players.map((player) => player.partyId).filter(Boolean));
  return [...partyIds].some((partyId) => {
    const waitingParty = state.players.filter((player) => player.partyId === partyId);
    return waitingParty.some((player) => !selectedIds.has(player.id));
  });
}

function lockedPairPenalty(pairing) {
  const teams = pairing.map((team) => new Set(team.map((player) => player.id)));
  const selected = pairing.flat();
  const partyIds = new Set(selected.map((player) => player.partyId).filter(Boolean));

  return [...partyIds].reduce((penalty, partyId) => {
    const partyPlayers = selected.filter((player) => player.partyId === partyId);
    if (partyPlayers.length !== 2) return penalty;
    const lockedTogether = teams.some((team) => partyPlayers.every((player) => team.has(player.id)));
    return lockedTogether ? penalty - 500 : penalty + 5000;
  }, 0);
}

function splitsLockedPairAcrossTeams(teamA, teamB) {
  const selected = [...teamA, ...teamB];
  const partyIds = new Set(selected.map((player) => player.partyId).filter(Boolean));

  return [...partyIds].some((partyId) => {
    const partyPlayers = selected.filter((player) => player.partyId === partyId);
    if (partyPlayers.length !== 2) return false;
    const teamAIds = new Set(teamA.map((player) => player.id));
    const teamBIds = new Set(teamB.map((player) => player.id));
    return !(partyPlayers.every((player) => teamAIds.has(player.id)) || partyPlayers.every((player) => teamBIds.has(player.id)));
  });
}

function sameParty(a, b) {
  return Boolean(a.partyId && a.partyId === b.partyId);
}

function pairCombinations(players) {
  const pairs = [];
  for (let first = 0; first < players.length; first += 1) {
    for (let second = first + 1; second < players.length; second += 1) {
      pairs.push([players[first], players[second]]);
    }
  }
  return pairs;
}

function teamStrength(team) {
  return team.reduce((sum, player) => sum + playerStrength(player), 0) / team.length;
}

function playerStrength(player) {
  const stat = state.stats[player.id];
  const levelBase = levelRank[player.level] || 2;
  if (!stat || stat.games === 0) return levelBase;
  return levelBase + stat.wins / stat.games;
}

function requeuePlayers(players) {
  players.forEach((player) => {
    state.players.push({ ...player, checkedInAt: Date.now() });
  });
}

function updateScore(courtId, side, value) {
  const court = state.courts.find((item) => item.id === courtId);
  if (!court || !court.game) return;
  court.game[side] = clamp(Number(value), 0, 30);
}

function render() {
  els.courtCount.value = state.settings.courtCount;
  els.sessionName.value = state.settings.sessionName || "Pickleball Queue";
  els.preferSkill.checked = state.settings.preferSkill;
  els.courtHint.textContent = "Live court timers";
  els.queueHint.textContent = state.settings.preferSkill ? "Balances first-up players by level" : "First in, first up";

  renderQueue();
  renderSitouts();
  renderCourts();
  renderUpNext();
  renderCustomMatchOptions();
  renderLeaderboard();
  renderStandings();
  renderMatchLog();
  renderMetrics();
  saveState();
  updateElapsedTimers();
}

function option(value, label, disabled = false) {
  const item = document.createElement("option");
  item.value = value;
  item.textContent = label;
  item.disabled = disabled;
  return item;
}

function renderCustomMatchOptions() {
  const openCourts = state.courts.filter((court) => !court.game);
  const playerSelects = [els.teamA1, els.teamA2, els.teamB1, els.teamB2];
  const previousCourt = els.customCourt.value;

  els.customCourt.replaceChildren();
  if (openCourts.length === 0) {
    els.customCourt.append(option("", "No open courts", true));
  } else {
    openCourts.forEach((court) => els.customCourt.append(option(court.id, `Court ${court.number}`)));
    els.customCourt.value = openCourts.some((court) => court.id === previousCourt) ? previousCourt : openCourts[0].id;
  }

  playerSelects.forEach((select, index) => {
    const previous = select.value;
    select.replaceChildren();
    select.append(option("", "Select player"));
    state.players.forEach((player) => {
      select.append(option(player.id, `${player.name} / ${player.level}`));
    });
    select.value = state.players.some((player) => player.id === previous) ? previous : state.players[index]?.id || "";
  });

  const selectedIds = playerSelects.map((select) => select.value).filter(Boolean);
  const hasDuplicates = new Set(selectedIds).size !== selectedIds.length;
  const playersById = new Map(state.players.map((player) => [player.id, player]));
  const selectedPlayers = selectedIds.map((id) => playersById.get(id)).filter(Boolean);
  const repeatsTooMuch = selectedPlayers.length === 4 && wouldCreateThirdSharedGame(selectedPlayers);
  const splitsParty = selectedPlayers.length === 4 && splitsLockedParty(selectedPlayers);
  const teamA = [els.teamA1.value, els.teamA2.value].map((id) => playersById.get(id)).filter(Boolean);
  const teamB = [els.teamB1.value, els.teamB2.value].map((id) => playersById.get(id)).filter(Boolean);
  const splitsPairAcrossTeams = teamA.length === 2 && teamB.length === 2 && splitsLockedPairAcrossTeams(teamA, teamB);
  els.customMatchForm.querySelector("button").disabled = openCourts.length === 0 || selectedIds.length !== 4 || hasDuplicates || repeatsTooMuch || splitsParty || splitsPairAcrossTeams;
}

function renderQueue() {
  els.queueList.replaceChildren();

  if (state.players.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No one is waiting. Add players as they check in.";
    els.queueList.append(empty);
    return;
  }

  state.players.forEach((player, index) => {
    const node = els.playerTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".player-name").textContent = `${index + 1}. ${player.name}`;
    node.querySelector(".player-meta").textContent = `${player.level}${player.partyId ? ` / ${player.partyLabel || "party"}` : ""}`;
    node.querySelector(".move-up").disabled = index === 0;
    node.querySelector(".move-down").disabled = index === state.players.length - 1;
    node.querySelector(".move-up").addEventListener("click", () => {
      movePlayer(player.id, -1);
      render();
    });
    node.querySelector(".move-down").addEventListener("click", () => {
      movePlayer(player.id, 1);
      render();
    });
    node.querySelector(".sit-out-player").addEventListener("click", () => {
      sitOutPlayer(player.id);
      render();
    });
    node.querySelector(".remove-player").addEventListener("click", () => {
      if (!confirm(`Remove ${player.name} from the queue?`)) return;
      removePlayer(player.id);
      render();
    });
    els.queueList.append(node);
  });
}

function renderSitouts() {
  els.sitoutList.replaceChildren();

  if (state.sitouts.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No one is sitting out.";
    els.sitoutList.append(empty);
    return;
  }

  state.sitouts.forEach((player) => {
    const node = document.createElement("article");
    node.className = "player-card sitout-card";
    node.innerHTML = `
      <div>
        <strong class="player-name"></strong>
        <span class="player-meta"></span>
      </div>
      <div class="card-actions">
        <button class="icon-button check-in-player" type="button">In</button>
        <button class="icon-button remove-sitout" type="button">X</button>
      </div>
    `;
    node.querySelector(".player-name").textContent = player.name;
    node.querySelector(".player-meta").textContent = `${player.level} / sitting out`;
    node.querySelector(".check-in-player").addEventListener("click", () => {
      checkInPlayer(player.id);
      render();
    });
    node.querySelector(".remove-sitout").addEventListener("click", () => {
      removeSitout(player.id);
      render();
    });
    els.sitoutList.append(node);
  });
}

function renderCourts() {
  els.courtsGrid.replaceChildren();

  state.courts.forEach((court) => {
    const node = els.courtTemplate.content.firstElementChild.cloneNode(true);
    const color = court.color || courtColors[(court.number - 1) % courtColors.length];
    node.style.setProperty("--court-color", color);
    node.querySelector("h3").textContent = `Court ${court.number}`;
    node.querySelector(".court-state").textContent = court.game ? "Playing" : "Open";

    if (court.game) {
      node.classList.add("playing");
      renderActiveCourt(node, court);
    } else {
      renderOpenCourt(node, court);
    }

    els.courtsGrid.append(node);
  });
}

function renderUpNext() {
  els.upNextList.replaceChildren();

  const previewQueue = state.players.map((player) => ({ ...player }));
  const previews = [];

  for (let index = 0; index < 2; index += 1) {
    const selected = selectNextFourFrom(previewQueue);
    if (selected.length < 4) break;
    const selectedIds = new Set(selected.map((player) => player.id));
    const teams = buildTeams(selected);
    previews.push(teams);
    for (let queueIndex = previewQueue.length - 1; queueIndex >= 0; queueIndex -= 1) {
      if (selectedIds.has(previewQueue[queueIndex].id)) previewQueue.splice(queueIndex, 1);
    }
  }

  if (previews.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state compact-empty";
    empty.textContent = "Add at least four waiting players.";
    els.upNextList.append(empty);
    return;
  }

  previews.forEach((teams, index) => {
    const card = document.createElement("article");
    card.className = "up-next-card";
    card.innerHTML = `
      <strong></strong>
      <span></span>
    `;
    card.querySelector("strong").textContent = `Stack ${index + 1}`;
    card.querySelector("span").textContent = `${teamLabel(teams.teamA)} vs ${teamLabel(teams.teamB)}`;
    els.upNextList.append(card);
  });
}

function teamLabel(team) {
  return team.map((player) => player.name).join(" / ");
}

function renderOpenCourt(node, court) {
  const body = node.querySelector(".court-body");
  const actions = node.querySelector(".court-actions");
  body.innerHTML = `<div class="empty-state">Ready for the next four.</div>`;

  const assignBtn = document.createElement("button");
  assignBtn.className = "primary-button";
  assignBtn.type = "button";
  assignBtn.textContent = "Assign Here";
  assignBtn.disabled = state.players.length < 4;
  assignBtn.addEventListener("click", () => {
    assignNextCourt(court.id);
    render();
  });
  actions.append(assignBtn);
}

function renderActiveCourt(node, court) {
  const body = node.querySelector(".court-body");
  const actions = node.querySelector(".court-actions");
  const [p1, p2] = court.game.teamA || court.game.players.slice(0, 2);
  const [p3, p4] = court.game.teamB || court.game.players.slice(2, 4);

  body.innerHTML = "";
  const timer = document.createElement("div");
  timer.className = "elapsed-timer";
  timer.dataset.startedAt = court.game.startedAt;
  timer.textContent = "00:00";
  body.append(timer);
  body.append(teamRow(`${p1.name} / ${p2.name}`, "vs", `${p3.name} / ${p4.name}`));

  const scores = document.createElement("div");
  scores.className = "score-controls";
  scores.innerHTML = `
    <label>Team A <input type="number" min="0" max="30" value="${court.game.scoreA}" data-side="scoreA" /></label>
    <label>Team B <input type="number" min="0" max="30" value="${court.game.scoreB}" data-side="scoreB" /></label>
  `;
  scores.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", () => {
      updateScore(court.id, input.dataset.side, input.value);
      render();
    });
  });
  body.append(scores);

  const quickResult = document.createElement("div");
  quickResult.className = "quick-result";

  const teamAWinBtn = document.createElement("button");
  teamAWinBtn.className = "primary-button team-a-win";
  teamAWinBtn.type = "button";
  teamAWinBtn.textContent = "Team A Win";
  teamAWinBtn.addEventListener("click", () => {
    finishGame(court.id, false, "A");
    render();
  });

  const teamBWinBtn = document.createElement("button");
  teamBWinBtn.className = "primary-button team-b-win";
  teamBWinBtn.type = "button";
  teamBWinBtn.textContent = "Team B Win";
  teamBWinBtn.addEventListener("click", () => {
    finishGame(court.id, false, "B");
    render();
  });

  quickResult.append(teamAWinBtn, teamBWinBtn);
  body.append(quickResult);

  const finishBtn = document.createElement("button");
  finishBtn.className = "primary-button";
  finishBtn.type = "button";
  finishBtn.textContent = "Finish By Score";
  finishBtn.addEventListener("click", () => {
    finishGame(court.id);
    render();
  });

  const clearBtn = document.createElement("button");
  clearBtn.className = "danger-button";
  clearBtn.type = "button";
  clearBtn.textContent = "Clear Court";
  clearBtn.addEventListener("click", () => {
    requeuePlayers(court.game.players);
    court.game = null;
    render();
  });

  actions.append(finishBtn, clearBtn);
}

function teamRow(left, middle, right) {
  const row = document.createElement("div");
  row.className = "team-row";
  row.innerHTML = `<span></span><strong class="versus"></strong><span></span>`;
  row.children[0].textContent = left;
  row.children[1].textContent = middle;
  row.children[2].textContent = right;
  return row;
}

function renderMetrics() {
  const playing = state.courts.filter((court) => court.game).length * 4;
  const openCourts = state.courts.filter((court) => !court.game).length;

  els.waitingMetric.textContent = state.players.length;
  els.playingMetric.textContent = playing;
  els.openCourtMetric.textContent = openCourts;
  els.gamesMetric.textContent = state.gamesRun;
  els.playerCount.textContent = `${state.players.length + state.sitouts.length + playing} players`;
}

function renderMatchLog() {
  els.matchLog.replaceChildren();

  if (state.matchLog.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Finished matches will appear here.";
    els.matchLog.append(empty);
    return;
  }

  state.matchLog.forEach((match) => {
    const row = document.createElement("article");
    row.className = "match-row";
    row.style.setProperty("--court-color", match.courtColor || courtColors[(match.courtNumber - 1) % courtColors.length]);
    row.innerHTML = `
      <div>
        <strong></strong>
        <span class="player-meta"></span>
      </div>
      <div class="match-score"></div>
    `;
    row.querySelector("strong").textContent = `Court ${match.courtNumber} / ${match.winnerLabel} won`;
    row.querySelector(".player-meta").textContent = `${match.teamA.join(" / ")} vs ${match.teamB.join(" / ")} / ${formatElapsed(match.elapsedMs)}`;
    row.querySelector(".match-score").textContent = `${match.scoreA}-${match.scoreB}`;
    els.matchLog.append(row);
  });
}

function updateElapsedTimers() {
  document.querySelectorAll(".elapsed-timer").forEach((timer) => {
    timer.textContent = formatElapsed(Date.now() - Number(timer.dataset.startedAt));
  });
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function renderLeaderboard() {
  els.leaderboard.replaceChildren();

  const rows = leaderboardRows();

  if (rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Finish games to build the leaderboard.";
    els.leaderboard.append(empty);
    return;
  }

  els.leaderboard.append(leaderRow(["Player", "Games", "Wins", "Win Rate", "Avg Opp Str"], true));
  rows.forEach((stat, index) => {
    els.leaderboard.append(leaderRow(formatStanding(stat, index)));
  });
}

function leaderboardRows() {
  return Object.values(state.stats)
    .filter((stat) => stat.games > 0)
    .sort((a, b) => b.wins / b.games - a.wins / a.games || b.games - a.games || a.name.localeCompare(b.name));
}

function medalFor(index) {
  return ["🥇", "🥈", "🥉"][index] || `${index + 1}.`;
}

function formatStanding(stat, index) {
  const winRate = `${Math.round((stat.wins / stat.games) * 100)}%`;
  const opponentStrength = (stat.opponentStrengthTotal / stat.games).toFixed(2);
  return [`${medalFor(index)} ${stat.name}`, stat.games, stat.wins, winRate, opponentStrength];
}

function generateStandings() {
  state.finalStandings = {
    sessionName: state.settings.sessionName || "Pickleball Queue",
    generatedAt: Date.now(),
    rows: leaderboardRows().map((stat, index) => ({
      rank: index + 1,
      medal: medalFor(index),
      name: stat.name,
      games: stat.games,
      wins: stat.wins,
      winRate: `${Math.round((stat.wins / stat.games) * 100)}%`,
      opponentStrength: (stat.opponentStrengthTotal / stat.games).toFixed(2)
    }))
  };
}

function renderStandings() {
  els.standingsBoard.replaceChildren();

  if (!state.finalStandings || state.finalStandings.rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Use Generate Standings/Leaderboard when the session is done.";
    els.standingsBoard.append(empty);
    els.standingsHint.textContent = "Create at session end";
    return;
  }

  els.standingsHint.textContent = `${state.finalStandings.sessionName || "Pickleball Queue"} / Generated ${new Date(state.finalStandings.generatedAt).toLocaleString()}`;
  els.standingsBoard.append(leaderRow(["Player", "Games", "Wins", "Win Rate", "Avg Opp Str"], true));
  state.finalStandings.rows.forEach((row) => {
    els.standingsBoard.append(leaderRow([`${row.medal} ${row.name}`, row.games, row.wins, row.winRate, row.opponentStrength]));
  });
}

function leaderRow(values, isHeader = false) {
  const row = document.createElement("div");
  row.className = `leader-row${isHeader ? " header" : ""}`;
  values.forEach((value, index) => {
    const cell = document.createElement(index === 0 && !isHeader ? "strong" : "span");
    cell.textContent = value;
    if (index > 0 && !isHeader) cell.className = "leader-stat";
    row.append(cell);
  });
  return row;
}

function resetSessionState() {
  state.players = [];
  state.sitouts = [];
  state.courts = [];
  state.settings = { courtCount: 4, preferSkill: true, sessionName: "Pickleball Queue" };
  state.stats = {};
  state.recentPartners = {};
  state.matchupStreaks = {};
  state.matchLog = [];
  state.finalStandings = null;
  state.gamesRun = 0;
  syncCourts();
}

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  addPlayersFromInput(els.playerName.value, els.playerLevel.value, els.partySize.value);
  els.playerName.value = "";
  els.playerName.focus();
  render();
});

els.courtCount.addEventListener("change", () => {
  state.settings.courtCount = clamp(Number(els.courtCount.value), 1, 12);
  syncCourts();
  render();
});

els.sessionName.addEventListener("input", () => {
  state.settings.sessionName = els.sessionName.value.trim() || "Pickleball Queue";
  saveState();
});

els.preferSkill.addEventListener("change", () => {
  state.settings.preferSkill = els.preferSkill.checked;
  render();
});

els.customMatchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const assigned = assignCustomMatch(els.customCourt.value, [els.teamA1.value, els.teamA2.value], [els.teamB1.value, els.teamB2.value]);
  if (!assigned) {
    alert("That stack either splits a checked-in party or repeats non-party players together for a third straight game. Choose a different mix.");
  }
  render();
});

[els.customCourt, els.teamA1, els.teamA2, els.teamB1, els.teamB2].forEach((select) => {
  select.addEventListener("change", renderCustomMatchOptions);
});

els.assignNextBtn.addEventListener("click", () => {
  assignNextCourt();
  render();
});

els.autoFillBtn.addEventListener("click", () => {
  autoFillCourts();
  render();
});

els.generateStandingsBtn.addEventListener("click", () => {
  generateStandings();
  render();
});

els.clearAllBtn.addEventListener("click", () => {
  if (!confirm("Clear the full session, match history, standings, and saved browser data?")) return;
  localStorage.removeItem(STORAGE_KEY);
  resetSessionState();
  render();
});

loadState();
render();
setInterval(updateElapsedTimers, 1000);
