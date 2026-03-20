const LEVELS_PER_ROW = 3;
const TURN_LENGTH = 0;
const WORDS_PER_LEVEL = 1;

let HSK = [];
let revealIndex = 0;

async function loadHSK() {
  const res = await fetch("./data/result.json");
  HSK = await res.json();
}

const app = document.getElementById("app");

function router() {
  const hash = location.hash;
  const srsBtn = document.getElementById("srs-btn");


  if (!hash || hash === "#") {
    renderPath();
    if (srsBtn) {
      srsBtn.style.display = "block";
    }
    return;
  }

  if (hash === "#/srs") {
    renderSrs();
    return;
  }

  const levelMatch = hash.match(/^#\/level\/(\d+)(?:\/(\d+))?/);

  if (levelMatch) {
    const level = parseInt(levelMatch[1], 10);
    const index = parseInt(levelMatch[2] || "0", 10);
    renderLevel(level, index);
    if (srsBtn) srsBtn.style.display = "none";
    return;
  }
}

window.addEventListener("hashchange", router);

function getProgress() {
  return JSON.parse(localStorage.getItem("progress") || "{}");
}

function saveProgress(progress) {
  localStorage.setItem("progress", JSON.stringify(progress));
}

function markLevelCompleted(level) {
  const progress = getProgress();
  progress.completedLevels ||= {};
  progress.completedLevels[level] = true;
  saveProgress(progress);
}

function isLevelCompleted(level) {
  const progress = getProgress();
  return !!progress.completedLevels?.[level];
}

function renderPath() {
  const maxId = Math.max(...HSK.map(c => c.id));
  const totalLevels = Math.ceil(maxId / WORDS_PER_LEVEL);

  const visibleLevels = [];
  for (let lvl = 1; lvl <= totalLevels; lvl++) {
    visibleLevels.push(lvl);
  }
  app.innerHTML = `
    <div class="fixed-bottom">
      <button id='srs-btn' onclick='startSrsSession()'>SRS</button>
    </div>
    <div class='path' id='path'></div>
  `;

  const path = document.getElementById("path");

  let index = 0;
  let direction = "forward";

  while (index < visibleLevels.length) {
    const rowLevels = visibleLevels.slice(
      index,
      index + LEVELS_PER_ROW
    );

    createRowFromLevels(path, direction, rowLevels);
    index += rowLevels.length;

    if (index >= visibleLevels.length) break;

    if (TURN_LENGTH > 0) {
      const turnLevels = visibleLevels.slice(index, index + TURN_LENGTH);
      createTurnFromLevels(path, direction, turnLevels);
      index += turnLevels.length;
    }

    direction = direction === "forward" ? "backward" : "forward";
  }
}

function getCharsForLevel(level) {
  const startId = (level - 1) * WORDS_PER_LEVEL + 1;
  const endId = startId + WORDS_PER_LEVEL - 1;
  return HSK.filter(c => c.id >= startId && c.id <= endId);
}

function isLevelEmpty(level) {
  return getWordsPreviewForLevel(level).length === 0;
}

function getWordsPreviewForLevel(level) {
  let filtered = getCharsForLevel(level).filter(c => !isIgnoredFromSrs(c.id))

  return filtered.map((c, i) =>
      `${c.polish_word}`
    ).join("");
}

function createRowFromLevels(container, direction, levels) {
  const row = document.createElement("div");
  row.className = "row";

  const orderedLevels =
    direction === "forward"
      ? levels
      : [...levels].reverse();

  const count = orderedLevels.length;

  orderedLevels.forEach((lvl, index) => {
    const cell = document.createElement("div");
    cell.className = "cell";

    const btn = document.createElement("button");

    const levelNum = document.createElement("div");
    levelNum.className = "level-number";
    levelNum.textContent = getVerbPreviewForLevel(lvl);
    btn.appendChild(levelNum);

    if (isLevelCompleted(lvl)) {
      btn.classList.add("completed");
    }

    btn.onclick = () => {
      location.hash = `/level/${lvl}`;
      window.location.reload();
    };

    cell.appendChild(btn);
    row.appendChild(cell);
  });
  if (row.innerHTML) {
    container.appendChild(row);
  }
}

function getVerbPreviewForLevel(level) {

  let filtered = getCharsForLevel(level).filter(c => !isIgnoredFromSrs(c.hanzi))

  return filtered.map((c, i) => c.polish_word)
}

function getAllLearnedChars() {
  const progress = getProgress();
  const completedLevels = Object.keys(progress.completedLevels || {}).map(Number);

  const chars = [];
  completedLevels.forEach(level => {
    chars.push(...getCharsForLevel(level));
  });

  return chars.filter(c => !isIgnoredFromSrs(c.id));
}

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

function startSrsSession() {
  const limit = 9999999;
  const all = shuffle(getAllLearnedChars());
  const session = all.slice(0, limit);

  localStorage.setItem("srsSession", JSON.stringify({
    chars: session,
    index: 0
  }));

  location.hash = "#/srs";
}

function getCharsForLevel(level) {
  const startId = (level - 1) * WORDS_PER_LEVEL + 1;
  const endId = startId + WORDS_PER_LEVEL - 1;
  return HSK.filter(c => c.id >= startId && c.id <= endId);
}

function goBack(level, index) {
  if (index > 0) {
    location.hash = `#/level/${level}/${index - 1}`;
  } else {
    location.hash = "#";
  }
}

function finishAndGoNext(level) {
  markLevelCompleted(level);

  const nextLevel = level + 1;

  // если следующий уровень доступен — открыть его
  if (!isLevelEmpty(nextLevel)) {
    location.hash = `#/level/${nextLevel}`;
  } else {
    location.hash = "#";
  }

  window.location.reload();
}

function renderLevel(level, index = 0) {
  const chars = getCharsForLevel(level);
  const c = chars[index];

  const isLast = index >= chars.length - 1;

  app.innerHTML = `
    <div class="fixed-bottom">
      <button class="back-btn" onclick="goBack(${level}, ${index})">←</button>

      ${
        !isLast
          ? `<button class="next-btn" onclick="location.hash='#/level/${level}/${index + 1}'">→</button>`
          : `<button class="next-btn" onclick="finishAndGoNext(${level})">→</button>`
      }
    </div>

    <div class="char-card">
      <div class="verb">${c.polish_word} (${c.russian})</div>
      <div id="sentence-reveal"></div>
    </div>
  `;
  renderVerbReveal("sentence-reveal", c)
}
function createVerbRevealState(verb) {
  const cells = [];

  function push(tense, person, value, meta = {}) {
    cells.push({
      tense,
      person,
      value,
      revealedCount: 0,
      ...meta
    });
  }

  // PRESENT
  Object.entries(verb.present).forEach(([p, v]) => {
    push("present", p, v);
  });

  // PAST (m/f + ono отдельно)
  ["ja","ty","on","ona","my","wy","oni","one"].forEach(p => {
    push("past", p, verb.past.masculine[p], { gender: "m" });
    push("past", p, verb.past.feminine[p], { gender: "f" });
  });

  push("past", "ono", verb.past.neuter.ono, { gender: "n" });

  // FUTURE
  ["ja","ty","on","ona","my","wy","oni","one"].forEach(p => {
    push("future", p, verb.future.masculine[p], { gender: "m" });
    push("future", p, verb.future.feminine[p], { gender: "f" });
  });

  push("future", "ono", verb.future.neuter.ono, { gender: "n" });

  // CONDITIONAL
  ["ja","ty","on","ona","my","wy","oni","one"].forEach(p => {
    push("conditional", p, verb.conditional.masculine[p], { gender: "m" });
    push("conditional", p, verb.conditional.feminine[p], { gender: "f" });
  });

  push("conditional", "ono", verb.conditional.neuter.ono, { gender: "n" });

  // IMPERATIVE
  Object.entries(verb.imperative).forEach(([p, v]) => {
    push("imperative", p, v);
  });

  return {
    cells,
    index: 0
  };
}
function renderPresentMasked(state) {
  const t = "present";

  return `
    <h2 class="header-h2">Present</h2>
    <table class="verb-table">
      ${rowPresent(state, "ja")}
      ${rowPresent(state, "ty")}

      ${rowPresentCombined(state, ["on","ona","ono"], "on/ona/ono")}

      ${rowPresent(state, "my")}
      ${rowPresent(state, "wy")}

      ${rowPresentCombined(state, ["oni","one"], "oni/one")}
    </table>
  `;
}
function getPresentGroupCells(state, persons) {
  return persons
    .map(p => getCell(state, "present", p))
    .filter(Boolean);
}
function rowPresent(state, person) {
  const c = getCell(state, "present", person);

  return `
    <tr>
      <td>${person}</td>
      <td>${mask(c?.value, c?.revealedCount)}</td>
    </tr>
  `;
}
function rowPresentCombined(state, persons, label) {
  const cells = persons.map(p => getCell(state, "present", p));

  // берём первую (они одинаковые по значению)
  const c = cells[0];

  return `
    <tr>
      <td>${label}</td>
      <td>${mask(c?.value, c?.revealedCount)}</td>
    </tr>
  `;
}
function mask(val, revealedCount) {
  if (!val) return "-";

  return val
    .split("")
    .map((ch, i) => {
      if (ch === " ") return " ";
      return i < revealedCount ? ch : "*";
    })
    .join("");
}

function createRevealState(sentence) {
  const chars = sentence.split("").map((ch, i, arr) => {
    const prev = arr[i - 1];

    const isWordStart =
      i === 0 ||
      prev === " " ||
      prev === "," ||
      prev === "." ||
      prev === "?";

    return {
      original: ch,
      revealed:
        isWordStart &&
        ch !== " " &&
        ch !== "," &&
        ch !== "." &&
        ch !== "?"
    };
  });

  return {
    chars,
    index: 0
  };
}

function buildMaskedSentence(state) {
  return state.chars.map(ch => {
    if (ch.original === " " || ch.original === "," || ch.original === "." || ch.original === "?") {
      return ch.original;
    }

    return ch.revealed ? ch.original : "*";
  }).join("");
}

function isSeparator(ch) {
  return ch === " " || ch === "," || ch === "." || ch === "?";
}

function getWordBounds(state, fromIndex) {
  let start = fromIndex;

  // найти начало слова
  while (
    start > 0 &&
    !isSeparator(state.chars[start - 1].original)
  ) {
    start--;
  }

  let end = fromIndex;

  // найти конец слова
  while (
    end < state.chars.length &&
    !isSeparator(state.chars[end].original)
  ) {
    end++;
  }

  return { start, end };
}

function ignoreCurrentSrsChar() {
  const session = JSON.parse(localStorage.getItem("srsSession"));
  if (!session) return;

  const c = session.chars[session.index];

  ignoreCharFromSrs(c.id);

  session.chars.splice(session.index, 1);

  if (session.index >= session.chars.length) {
    finishSrsSession();
  } else {
    localStorage.setItem("srsSession", JSON.stringify(session));
    renderSrs();
  }
}

function renderSrs() {
  const session = JSON.parse(localStorage.getItem("srsSession"));
  if (!session) {
    app.innerHTML = "<p>No SRS session</p>";
    return;
  }

  const { chars, index } = session;
  const c = chars[index];

  if (!c) {
    return;
  }
  const isLast = index >= chars.length - 1;

  app.innerHTML = `
    <div class="fixed-bottom">
      <button class="back-btn" onclick="location.hash = '#';">←</button>
      <button class="ignore-btn" onclick="ignoreCurrentSrsChar()">
        -
      </button>
      <button class="next-srs-btn"  onclick="nextSrs()">
        ${isLast ? "✓" : "→"}
      </button>
    </div>

    <div class="char-card">
      <div class="progress" style="display: none">${index + 1} / ${chars.length}</div>
      <div class="verb">${c.polish_word} (${c.russian})</div>
      <div id="sentence-reveal"></div>
    </div>
  `;
  renderVerbReveal("sentence-reveal", c)
}

function nextSrs() {
  const session = JSON.parse(localStorage.getItem("srsSession"));
  markSrsSeen();
  session.index++;

  if (session.index >= session.chars.length) {
    finishSrsSession();
  } else {
    localStorage.setItem("srsSession", JSON.stringify(session));
    renderSrs();
  }
}
function markSrsSeen() {
  const today = new Date().toISOString().slice(0, 10);
  const progress = getProgress();

  progress.srsHistory ||= {};
  progress.srsHistory[today] ||= 0;
  progress.srsHistory[today]++;

  saveProgress(progress);
}

function finishSrsSession() {
  localStorage.removeItem("srsSession");
  location.hash = "#";
}

function ignoreCharFromSrs(id) {
  const progress = getProgress();
  progress.ignoredFromSrs ||= {};
  progress.ignoredFromSrs[id] = true;
  saveProgress(progress);
}

function isIgnoredFromSrs(id) {
  const progress = getProgress();
  return !!progress.ignoredFromSrs?.[id];
}

function renderVerbReveal(containerId, verb) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const state = createVerbRevealState(verb);

  function render() {
    container.innerHTML = `
      <div class="pl-row">
        <button id="reveal-one">+</button>
        <button id="reveal-row">++</button>
        <button id="reveal-all">+++</button>
      </div>

      ${renderPresentMasked(state)}
      ${renderPastCompactMasked(state)}
      ${renderFutureCompactMasked(state)}
      ${renderConditionalCompactMasked(state)}
      ${renderImperativeMasked(state)}
    `;

    document.getElementById("reveal-one").onclick = () => {
      revealOne(state);
      render();
    };

    document.getElementById("reveal-row").onclick = () => {
      revealWord(state);
      render();
    };

    document.getElementById("reveal-all").onclick = () => {
      revealAllVerb(state);
      render();
    };
  }

  render();
}
function rowMaskedCombined(state, tense, persons, label) {
  const m = getCell(state, tense, persons[0], "m");
  const f = getCell(state, tense, persons[1], "f");

  return `
    <tr>
      <td>${label}</td>
      <td>${mask(m?.value, m?.revealedCount)}</td>
      <td>${mask(f?.value, f?.revealedCount)}</td>
    </tr>
  `;
}
function revealWord(state) {
  const cell = state.cells.find(c =>
    c.value && c.revealedCount < c.value.length
  );

  if (!cell) return;

  // группы present
  if (cell.tense === "present" && ["on","ona","ono"].includes(cell.person)) {
    const group = getPresentGroupCells(state, ["on","ona","ono"]);

    group.forEach(c => {
      c.revealedCount = c.value.length;
    });

    return;
  }

  if (cell.tense === "present" && ["oni","one"].includes(cell.person)) {
    const group = getPresentGroupCells(state, ["oni","one"]);

    group.forEach(c => {
      c.revealedCount = c.value.length;
    });

    return;
  }

  // обычное
  cell.revealedCount = cell.value.length;
}
function renderPresent(present) {
  return `
    <h2 class="header-h2">Present</h2>
    <table class="verb-table">
      ${row("ja", present.ja)}
      ${row("ty", present.ty)}
      ${row("on", present.on)}
      ${row("ona", present.ona)}
      ${row("ono", present.ono)}
      ${row("my", present.my)}
      ${row("wy", present.wy)}
      ${row("oni", present.oni)}
      ${row("one", present.one)}
    </table>
  `;
}
function renderPastCompact(past) {
  return `
    <h2 class="header-h2">Past</h2>
    <table class="verb-table">
      <tr>
        <td></td>
        <td>m</td>
        <td>f</td>
      </tr>

      ${row2("ja", past.masculine.ja, past.feminine.ja)}
      ${row2("ty", past.masculine.ty, past.feminine.ty)}
      ${row2("on", past.masculine.on, "")}
      ${row2("ona", "", past.feminine.ona)}
      ${row2("my", past.masculine.my, past.feminine.my)}
      ${row2("wy", past.masculine.wy, past.feminine.wy)}
      ${row2("oni", past.masculine.oni, "")}
      ${row2("one", "", past.feminine.one)}
    </table>

    <div class="ono-block">
      ono: ${past.neuter.ono}
    </div>
  `;
}
function renderFutureCompact(future) {
  return `
    <h2 class="header-h2">Future</h2>
    <table class="verb-table">
      <tr>
        <td></td>
        <td>m</td>
        <td>f</td>
      </tr>

      ${row2("ja", future.masculine.ja, future.feminine.ja)}
      ${row2("ty", future.masculine.ty, future.feminine.ty)}
      ${row2("on", future.masculine.on, "")}
      ${row2("ona", "", future.feminine.ona)}
      ${row2("my", future.masculine.my, future.feminine.my)}
      ${row2("wy", future.masculine.wy, future.feminine.wy)}
      ${row2("oni", future.masculine.oni, "")}
      ${row2("one", "", future.feminine.one)}
    </table>

    <div class="ono-block">
      ono: ${future.neuter.ono}
    </div>
  `;
}
function renderConditionalCompact(conditional) {
  return `
    <h2 class="header-h2">Conditional</h2>
    <table class="verb-table">
      <tr>
        <td></td>
        <td>m</td>
        <td>f</td>
      </tr>

      ${row2("ja", conditional.masculine.ja, conditional.feminine.ja)}
      ${row2("ty", conditional.masculine.ty, conditional.feminine.ty)}
      ${row2("on", conditional.masculine.on, "")}
      ${row2("ona", "", conditional.feminine.ona)}
      ${row2("my", conditional.masculine.my, conditional.feminine.my)}
      ${row2("wy", conditional.masculine.wy, conditional.feminine.wy)}
      ${row2("oni", conditional.masculine.oni, "")}
      ${row2("one", "", conditional.feminine.one)}
    </table>

    <div class="ono-block">
      ono: ${conditional.neuter.ono}
    </div>
  `;
}

function renderPast(title, data) {
  if (!data) return "";

  return `
    <h2 class="header-h2">${title}</h2>
    <table class="verb-table">
      ${Object.entries(data)
        .map(([k, v]) => row(k, v))
        .join("")}
    </table>
  `;
}

function renderImperative(data) {
  return `
    <h2 class="header-h2">Imperative</h2>
    <table class="verb-table">
      ${row("ty", data.ty)}
      ${row("my", data.my)}
      ${row("wy", data.wy)}
    </table>
  `;
}
function row(label, value) {
  return `
    <tr>
      <td>${label}</td>
      <td>${value || "-"}</td>
    </tr>
  `;
}
function row2(label, m, f) {
  return `
    <tr>
      <td>${label}</td>
      <td>${m || "-"}</td>
      <td>${f || "-"}</td>
    </tr>
  `;
}
function row3(label, m, f, n) {
  return `
    <tr>
      <td>${label}</td>
      <td>${m || "-"}</td>
      <td>${f || "-"}</td>
      <td>${n || "-"}</td>
    </tr>
  `;
}
function revealOne(state) {
  // ищем первую не раскрытую ячейку
  const cell = state.cells.find(c =>
    c.value && c.revealedCount < c.value.length
  );

  if (!cell) return;

  // если это present и входит в группу
  if (cell.tense === "present" && ["on","ona","ono"].includes(cell.person)) {
    const group = getPresentGroupCells(state, ["on","ona","ono"]);

    group.forEach(c => {
      if (c.revealedCount < c.value.length) {
        c.revealedCount++;
      }
    });

    return;
  }

  if (cell.tense === "present" && ["oni","one"].includes(cell.person)) {
    const group = getPresentGroupCells(state, ["oni","one"]);

    group.forEach(c => {
      if (c.revealedCount < c.value.length) {
        c.revealedCount++;
      }
    });

    return;
  }

  // обычное поведение
  cell.revealedCount++;
}
function getCell(state, tense, person, gender) {
  return state.cells.find(c =>
    c.tense === tense &&
    c.person === person &&
    (gender ? c.gender === gender : true)
  );
}
function renderPastCompactMasked(state) {
  const t = "past";

  return `
    <h2 class="header-h2">Past</h2>
    <table class="verb-table">
      <tr>
        <td></td>
        <td>m</td>
        <td>f</td>
      </tr>

      ${rowMasked2(state, t, "ja")}
      ${rowMasked2(state, t, "ty")}

      ${rowMaskedCombined(state, t, ["on","ona"], "on/ona")}

      ${rowMasked2(state, t, "my")}
      ${rowMasked2(state, t, "wy")}

      ${rowMaskedCombined(state, t, ["oni","one"], "oni/one")}
    </table>

    <div class="ono-block">
      ono: ${mask(
        getCell(state, t, "ono", "n")?.value,
        getCell(state, t, "ono", "n")?.revealedCount
      )}
    </div>
  `;
}
function renderFutureCompactMasked(state) {
  const t = "future";

  return `
    <h2 class="header-h2">Future</h2>
    <table class="verb-table">
      <tr>
        <td></td>
        <td>m</td>
        <td>f</td>
      </tr>

      ${rowMasked2(state, t, "ja")}
      ${rowMasked2(state, t, "ty")}

      ${rowMaskedCombined(state, t, ["on","ona"], "on/ona")}

      ${rowMasked2(state, t, "my")}
      ${rowMasked2(state, t, "wy")}

      ${rowMaskedCombined(state, t, ["oni","one"], "oni/one")}
    </table>

    <div class="ono-block">
      ono: ${mask(
        getCell(state, t, "ono", "n")?.value,
        getCell(state, t, "ono", "n")?.revealedCount
      )}
    </div>
  `;
}
function renderConditionalCompactMasked(state) {
  const t = "conditional";

  return `
    <h2 class="header-h2">Conditional</h2>
    <table class="verb-table">
      <tr>
        <td></td>
        <td>m</td>
        <td>f</td>
      </tr>

      ${rowMasked2(state, t, "ja")}
      ${rowMasked2(state, t, "ty")}

      ${rowMaskedCombined(state, t, ["on","ona"], "on/ona")}

      ${rowMasked2(state, t, "my")}
      ${rowMasked2(state, t, "wy")}

      ${rowMaskedCombined(state, t, ["oni","one"], "oni/one")}
    </table>

    <div class="ono-block">
      ono: ${mask(
        getCell(state, t, "ono", "n")?.value,
        getCell(state, t, "ono", "n")?.revealedCount
      )}
    </div>
  `;
}
function renderImperativeMasked(state) {
  const t = "imperative";

  return `
    <h2 class="header-h2">Imperative</h2>
    <table class="verb-table">
      ${["ty","my","wy"].map(p => {
        const c = getCell(state, t, p);
        return `
          <tr>
            <td>${p}</td>
            <td>${mask(c?.value, c?.revealedCount)}</td>
          </tr>
        `;
      }).join("")}
    </table>
  `;
}
function rowMasked2(state, tense, person) {
  const m = getCell(state, tense, person, "m");
  const f = getCell(state, tense, person, "f");

  return `
    <tr>
      <td>${person}</td>
      <td>${mask(m?.value, m?.revealedCount)}</td>
      <td>${mask(f?.value, f?.revealedCount)}</td>
    </tr>
  `;
}
function revealAllVerb(state) {
  // найти первую незакрытую ячейку
  const target = state.cells.find(c =>
    c.value && c.revealedCount < c.value.length
  );

  if (!target) return;

  const targetTense = target.tense;

  state.cells.forEach(c => {
    if (c.tense === targetTense && c.value) {
      c.revealedCount = c.value.length;
    }
  });
}
(async function init() {
  await loadHSK();
  router();
})();
