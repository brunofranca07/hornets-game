const WORDS = [
  "LAMELO", "BALL", "KEMBA", "WALKER", "MUGGSY", "BOGUES",
  "ALONZO", "MOURNING", "DELL", "CURRY", "LARRY", "JOHNSON",
  "GLEN", "RICE", "GERALD", "WALLACE", "BATUM", "MILES",
  "BRIDGES", "TERRY", "ROZIER", "BRANDON", "MILLER", "MCGOWENS",
  "MICHAEL", "JORDAN", "JEFF", "PETERSON", "CHARLES", "LEE",
  "JCOLE", "COLE", "STEVE", "CLIFFORD", "JAMES", "BORREGO",
  "MITCH", "KUPCHAK", "HUGO", "HORNETS", "BUZZCITY",
  "MONK", "ZELLER", "KAMINSKY", "LAMB", "BIYOMBO", "HOWARD",
  "RICHARDS", "PLUMLEE", "MCDANIELS", "WASHINGTON", "OUBRE",
  "HAYWARD", "WILLIAMS", "SMITH", "THOR", "SALAUN", "DIABATE",
  "GREEN", "MANN", "MICIC", "NTILIKINA", "BERTANS", "BOUKNIGHT",
  "JONES", "CAREY", "GILCHRIST",
];
const MAX_GUESSES = 10;
const STORAGE_KEY = "buzzword-game-v1";
const STATISTICS_KEY = "buzzword-statistics-v1";
const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const KEY_STATES = { gray: 1, yellow: 2, green: 3 };

const board = document.querySelector("#board");
const keyboard = document.querySelector("#keyboard");
const message = document.querySelector("#message");
const helpButton = document.querySelector("#help-button");
const helpDialog = document.querySelector("#help-dialog");
const instructions = document.querySelector("#instructions");
const gameTab = document.querySelector("#game-tab");
const statsTab = document.querySelector("#stats-tab");
const gameView = document.querySelector("#game-view");
const statsView = document.querySelector("#stats-view");
const statsGrid = document.querySelector("#stats-grid");
const historyList = document.querySelector("#history-list");
const statsError = document.querySelector("#stats-error");

let targetWord = getDailyWord();
const wordLength = targetWord.length;
let guesses = [];
let currentGuess = Array(wordLength).fill("");
let currentPosition = 0;
let finished = false;
let keyboardStates = {};

function getLocalDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPreviousDateKey(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getStatistics() {
  try {
    const saved = localStorage.getItem(STATISTICS_KEY);
    if (!saved) return { games: [], error: "" };

    const data = JSON.parse(saved);
    if (!Array.isArray(data.games)) throw new Error("Formato de estatísticas inválido.");
    const games = data.games.filter((game) =>
      game &&
      /^\d{4}-\d{2}-\d{2}$/.test(game.date) &&
      /^[A-Z]+$/.test(game.word) &&
      typeof game.won === "boolean" &&
      Number.isInteger(game.attempts) &&
      game.attempts >= 1 &&
      game.attempts <= MAX_GUESSES
    );
    return { games, error: "" };
  } catch (error) {
    console.error("Não foi possível carregar as estatísticas.", error);
    return { games: [], error: "Não foi possível carregar as estatísticas salvas neste navegador." };
  }
}

function recordCompletedGame(won) {
  const statistics = getStatistics();
  if (statistics.error) return false;

  const today = getLocalDateKey();
  if (statistics.games.some((game) => game.date === today)) return true;

  statistics.games.push({
    date: today,
    word: targetWord,
    won,
    attempts: guesses.length,
  });

  try {
    localStorage.setItem(STATISTICS_KEY, JSON.stringify({ games: statistics.games }));
    return true;
  } catch (error) {
    console.error("Não foi possível salvar as estatísticas.", error);
    return false;
  }
}

function getCurrentStreak(games) {
  const byDate = new Map(games.map((game) => [game.date, game]));
  const today = getLocalDateKey();
  let date = byDate.has(today) ? today : getPreviousDateKey(today);
  let streak = 0;

  while (byDate.get(date)?.won) {
    streak += 1;
    date = getPreviousDateKey(date);
  }
  return streak;
}

function getBestStreak(games) {
  const ordered = [...games].sort((a, b) => a.date.localeCompare(b.date));
  let current = 0;
  let best = 0;
  let previousDate = "";

  for (const game of ordered) {
    if (!game.won) {
      current = 0;
    } else {
      current = previousDate && getPreviousDateKey(game.date) === previousDate
        ? current + 1
        : 1;
      best = Math.max(best, current);
    }
    previousDate = game.date;
  }
  return best;
}

function formatGameDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function renderStatistics() {
  const { games, error } = getStatistics();
  statsError.textContent = error;
  statsError.hidden = !error;
  statsGrid.replaceChildren();
  historyList.replaceChildren();

  const wins = games.filter((game) => game.won);
  const winRate = games.length ? Math.round((wins.length / games.length) * 100) : 0;
  const cards = [
    ["Partidas", games.length],
    ["Vitórias", wins.length],
    ["Aproveitamento", `${winRate}%`],
    ["Sequência atual", getCurrentStreak(games)],
    ["Melhor sequência", getBestStreak(games)],
  ];

  for (const [label, value] of cards) {
    const card = document.createElement("article");
    card.className = "stat-card";
    const number = document.createElement("strong");
    number.textContent = value;
    const caption = document.createElement("span");
    caption.textContent = label;
    card.append(number, caption);
    statsGrid.append(card);
  }

  if (wins.length === 0) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = "As palavras que você acertar aparecerão aqui.";
    historyList.append(empty);
    return;
  }

  wins.sort((a, b) => b.date.localeCompare(a.date));
  for (const game of wins) {
    const item = document.createElement("li");
    item.className = "history-item";
    const word = document.createElement("strong");
    word.textContent = game.word;
    const details = document.createElement("span");
    details.textContent = `${formatGameDate(game.date)} · ${game.attempts} ${game.attempts === 1 ? "tentativa" : "tentativas"}`;
    item.append(word, details);
    historyList.append(item);
  }
}

function celebrateWin() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const colors = ["#00788c", "#1d1160", "#72c9e6", "#ffffff"];

  for (const side of ["left", "right"]) {
    for (let index = 0; index < 18; index += 1) {
      const particle = document.createElement("span");
      particle.className = `confetti confetti-${side}`;
      particle.style.top = `${15 + Math.random() * 70}vh`;
      particle.style.setProperty("--confetti-color", colors[Math.floor(Math.random() * colors.length)]);
      particle.style.setProperty("--confetti-x", `${(170 + Math.random() * 220) * (side === "left" ? 1 : -1)}px`);
      particle.style.setProperty("--confetti-y", `${100 + Math.random() * 210}px`);
      particle.style.setProperty("--confetti-rotation", `${360 + Math.random() * 720}deg`);
      particle.style.setProperty("--confetti-delay", `${reduceMotion ? 0 : Math.random() * 220}ms`);
      particle.style.setProperty("--confetti-duration", reduceMotion ? "950ms" : "1500ms");
      particle.addEventListener("animationend", () => particle.remove(), { once: true });
      document.body.append(particle);
    }
  }
}

function selectTab(selected) {
  const showStats = selected === "stats";
  gameView.hidden = showStats;
  statsView.hidden = !showStats;
  gameTab.classList.toggle("active", !showStats);
  statsTab.classList.toggle("active", showStats);
  gameTab.setAttribute("aria-selected", String(!showStats));
  statsTab.setAttribute("aria-selected", String(showStats));
  gameTab.tabIndex = showStats ? -1 : 0;
  statsTab.tabIndex = showStats ? 0 : -1;
  if (showStats) renderStatistics();
}

function getDailyWord() {
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const yearStartUtc = Date.UTC(today.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((todayUtc - yearStartUtc) / 86400000) + 1;
  const yearOffset = (today.getFullYear() - 2025) * 3;
  return WORDS[((dayOfYear - 1 + yearOffset) % WORDS.length + WORDS.length) % WORDS.length];
}

function loadProgress() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;

  const progress = JSON.parse(saved);
  if (progress.date !== getLocalDateKey()) return;
  if (!Array.isArray(progress.guesses) || progress.guesses.length > MAX_GUESSES) return;
  if (!progress.guesses.every((guess) => /^[A-Z]+$/.test(guess) && guess.length === wordLength)) return;

  guesses = progress.guesses;
  finished = progress.finished === true;
  if (guesses.includes(targetWord)) finished = true;
  if (guesses.length === MAX_GUESSES) finished = true;
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      date: getLocalDateKey(),
      guesses,
      finished,
    }));
    return true;
  } catch (error) {
    console.error("Não foi possível salvar o progresso.", error);
    return false;
  }
}

function evaluateGuess(guess, answer) {
  const result = Array(guess.length).fill("gray");
  const remaining = {};

  for (let index = 0; index < guess.length; index += 1) {
    if (guess[index] === answer[index]) {
      result[index] = "green";
    } else {
      remaining[answer[index]] = (remaining[answer[index]] || 0) + 1;
    }
  }

  for (let index = 0; index < guess.length; index += 1) {
    if (result[index] === "green") continue;
    const letter = guess[index];
    if (remaining[letter] > 0) {
      result[index] = "yellow";
      remaining[letter] -= 1;
    }
  }

  return result;
}

function setMessage(text) {
  message.textContent = text;
}

function renderBoard() {
  board.replaceChildren();
  board.style.width = `min(100%, ${Math.min(wordLength * 50 + (wordLength - 1) * 5, 440)}px)`;
  board.setAttribute("aria-label", `Tabuleiro de tentativas, palavra com ${wordLength} letras`);

  for (let rowIndex = 0; rowIndex < MAX_GUESSES; rowIndex += 1) {
    const row = document.createElement("div");
    row.className = "board-row";
    row.setAttribute("aria-label", `Tentativa ${rowIndex + 1}`);

    row.style.gridTemplateColumns = `repeat(${wordLength}, minmax(0, 1fr))`;
    for (let columnIndex = 0; columnIndex < wordLength; columnIndex += 1) {
      const tile = document.createElement("button");
      tile.className = "tile";
      tile.type = "button";
      let letter = "";

      if (rowIndex < guesses.length) {
        letter = guesses[rowIndex][columnIndex];
        tile.classList.add(evaluateGuess(guesses[rowIndex], targetWord)[columnIndex]);
        if (guesses[rowIndex] === targetWord) tile.classList.add("correct");
      } else if (rowIndex === guesses.length) {
        letter = currentGuess[columnIndex];
        if (letter) tile.classList.add("filled");
        if (columnIndex === currentPosition && !finished) tile.classList.add("selected");
        tile.addEventListener("click", () => {
          if (finished) return;
          currentPosition = columnIndex;
          renderBoard();
        });
      }

      tile.textContent = letter;
      tile.setAttribute("aria-label", `Posição ${columnIndex + 1}: ${letter || "vazia"}`);
      row.append(tile);
    }

    board.append(row);
  }
}

function renderKeyboard() {
  keyboard.replaceChildren();

  KEY_ROWS.forEach((letters, rowIndex) => {
    const row = document.createElement("div");
    row.className = "keyboard-row";

    if (rowIndex === 2) {
      row.append(createKey("ENTER", "wide", submitGuess));
    }

    for (const letter of letters) {
      const key = createKey(letter, "", () => addLetter(letter));
      const state = keyboardStates[letter];
      if (state) key.classList.add(state);
      row.append(key);
    }

    if (rowIndex === 2) {
      row.append(createKey("⌫", "wide", removeLetter));
    }

    keyboard.append(row);
  });
}

function createKey(label, extraClass, action) {
  const button = document.createElement("button");
  button.className = `key ${extraClass}`.trim();
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-label", label === "⌫" ? "Apagar letra" : label);
  button.addEventListener("click", action);
  return button;
}

function addLetter(letter) {
  if (finished) return;
  let position = currentPosition;
  if (currentGuess[position]) {
    position = currentGuess.findIndex((value) => !value);
    if (position === -1) return;
  }
  currentGuess[position] = letter;
  currentPosition = currentGuess.findIndex((value, index) => !value && index > position);
  if (currentPosition === -1) currentPosition = currentGuess.findIndex((value) => !value);
  if (currentPosition === -1) currentPosition = position;
  renderBoard();
}

function removeLetter() {
  if (finished) return;
  let position = currentGuess[currentPosition] ? currentPosition : currentPosition - 1;
  while (position >= 0 && !currentGuess[position]) position -= 1;
  if (position < 0) return;
  currentGuess[position] = "";
  currentPosition = position;
  renderBoard();
}

function submitGuess() {
  if (finished) return;
  if (currentGuess.some((letter) => !letter)) {
    setMessage("Preencha todas as posições antes de enviar o palpite.");
    return;
  }

  const guess = currentGuess.join("");
  guesses.push(guess);
  updateKeyboard(guess, evaluateGuess(guess, targetWord));
  currentGuess = Array(wordLength).fill("");
  currentPosition = 0;

  if (guesses[guesses.length - 1] === targetWord) {
    finished = true;
    setMessage(`Mandou bem! A palavra era ${targetWord}. Volte amanhã para outro desafio.`);
    celebrateWin();
  } else if (guesses.length === MAX_GUESSES) {
    finished = true;
    setMessage(`Fim de jogo! A palavra de hoje era ${targetWord}. Volte amanhã.`);
  } else {
    const remaining = MAX_GUESSES - guesses.length;
    setMessage(`Ainda não! Você tem ${remaining} ${remaining === 1 ? "tentativa" : "tentativas"}.`);
  }

  if (finished && !recordCompletedGame(guesses.includes(targetWord))) {
    setMessage(`${message.textContent} Não foi possível salvar suas estatísticas.`);
  }

  const saved = saveProgress();
  if (!saved) setMessage(`${message.textContent} O progresso pode não ser preservado.`);
  renderBoard();
  renderKeyboard();
}

function updateKeyboard(guess, result) {
  for (let index = 0; index < guess.length; index += 1) {
    const letter = guess[index];
    const state = result[index];
    const previous = keyboardStates[letter];
    if (!previous || KEY_STATES[state] > KEY_STATES[previous]) {
      keyboardStates[letter] = state;
    }
  }
}

function handleKeydown(event) {
  if (event.ctrlKey || event.metaKey || event.altKey || helpDialog.open || gameView.hidden) return;

  if (event.key === "Enter") {
    submitGuess();
  } else if (event.key === "Backspace") {
    removeLetter();
  } else if (event.key === "ArrowLeft") {
    currentPosition = Math.max(0, currentPosition - 1);
    renderBoard();
  } else if (event.key === "ArrowRight") {
    currentPosition = Math.min(wordLength - 1, currentPosition + 1);
    renderBoard();
  } else if (/^[a-zA-Z]$/.test(event.key)) {
    addLetter(event.key.toUpperCase());
  }
}

function startGame() {
  instructions.textContent = `Descubra a palavra de ${wordLength} letras em até ${MAX_GUESSES} tentativas.`;

  try {
    loadProgress();
    guesses.forEach((guess) => updateKeyboard(guess, evaluateGuess(guess, targetWord)));
    if (guesses.includes(targetWord)) recordCompletedGame(true);
  } catch (error) {
    console.error("Não foi possível carregar o progresso salvo.", error);
    setMessage("Não foi possível acessar o salvamento local. O jogo ainda pode ser jogado nesta página.");
  }

  if (finished) {
    if (guesses.includes(targetWord)) {
      setMessage(`Você já acertou hoje: ${targetWord}. Volte amanhã para outro desafio!`);
    } else {
      setMessage(`Você já usou suas 10 tentativas. A palavra era ${targetWord}.`);
    }
  } else if (guesses.length > 0) {
    setMessage(`Progresso recuperado: ${MAX_GUESSES - guesses.length} tentativas restantes.`);
  } else {
    setMessage("Digite seu palpite e pressione Enter.");
  }

  renderBoard();
  renderKeyboard();
}

helpButton.addEventListener("click", () => helpDialog.showModal());
gameTab.addEventListener("click", () => selectTab("game"));
statsTab.addEventListener("click", () => selectTab("stats"));
document.querySelector('[role="tablist"]').addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const nextTab = event.target === gameTab ? statsTab : gameTab;
  nextTab.focus();
  selectTab(nextTab === statsTab ? "stats" : "game");
});
document.addEventListener("keydown", handleKeydown);

startGame();
