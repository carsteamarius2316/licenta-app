const state = {
  subjects: [],
  questions: [],
  currentQuiz: [],
  currentIndex: 0,
  currentTarget: "#test-area",
  currentMode: "test",
  selected: {},
  results: load("licenta-results", []),
  mistakes: load("licenta-mistakes", {}),
};

const titles = {
  materii: ["Materii", "Alege materia si porneste un test scurt."],
  invatare: ["Invatare", "Citeste intrebarile impreuna cu raspunsurile corecte."],
  test: ["Test", "Exerseaza rapid una dintre materii."],
  simulare: ["Simulare", "Genereaza un examen amestecat din toate materiile."],
  greseli: ["Greseli", "Reia intrebarile la care ai raspuns gresit."],
  statistici: ["Statistici", "Urmareste progresul salvat in browser."],
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

async function api(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error("Cererea nu a reusit");
  return response.json();
}

function localQuestions() {
  return window.LICENTA_QUESTIONS || [];
}

function localSubjects() {
  const counts = localQuestions().reduce((acc, q) => {
    acc[q.materie] = (acc[q.materie] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([materie, total]) => ({ materie, total }));
}

function publicQuestion(question) {
  return {
    id: question.id,
    materie: question.materie,
    numar: question.numar,
    intrebare: question.intrebare,
    variante: question.variante,
  };
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function setView(view) {
  $$(".nav").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $$(".view").forEach((section) => section.classList.toggle("active", section.id === view));
  $("#view-title").textContent = titles[view][0];
  $("#view-subtitle").textContent = titles[view][1];
  if (view === "invatare") renderStudy();
  if (view === "greseli") renderMistakes();
  if (view === "statistici") renderStats();
}

function renderSubjects() {
  $("#total-questions").textContent = state.questions.length;
  $("#subject-grid").innerHTML = state.subjects
    .map(
      (subject) => `
        <article class="subject-card">
          <h2>${subject.materie}</h2>
          <strong>${subject.total}</strong>
          <p>intrebari disponibile</p>
          <button class="primary start-subject" data-subject="${subject.materie}">Test rapid</button>
        </article>
      `
    )
    .join("");

  $$(".start-subject").forEach((button) => {
    button.addEventListener("click", () => {
      $("#test-subject").value = button.dataset.subject;
      setView("test");
      startQuiz("test");
    });
  });
}

function fillSubjectSelect() {
  const options = state.subjects.map((s) => `<option value="${s.materie}">${s.materie} (${s.total})</option>`).join("");
  $("#test-subject").innerHTML = options;
  $("#study-subject").innerHTML = `<option value="__all__">Toate materiile (${state.questions.length})</option>${options}`;
}

async function startQuiz(mode, customQuestions) {
  state.currentMode = mode;
  state.selected = {};
  state.currentIndex = 0;
  if (mode === "test") {
    $("#exam-area").innerHTML = "";
  } else {
    $("#test-area").innerHTML = "";
  }

  if (customQuestions) {
    state.currentQuiz = customQuestions;
  } else if (mode === "test") {
    const subject = $("#test-subject").value;
    const pool = localQuestions().filter((q) => q.materie === subject);
    state.currentQuiz = shuffle(pool).map(publicQuestion);
  } else {
    const count = Number($("#exam-count").value || 50);
    state.currentQuiz = shuffle(localQuestions()).slice(0, count).map(publicQuestion);
  }

  renderQuiz(mode === "test" ? "#test-area" : "#exam-area");
}

function renderQuiz(targetSelector) {
  state.currentTarget = targetSelector;
  const target = $(targetSelector);
  if (!state.currentQuiz.length) {
    target.innerHTML = `<p class="muted">Nu exista intrebari pentru selectia curenta.</p>`;
    return;
  }

  renderCurrentQuestion(false);
}

function renderCurrentQuestion(shouldScroll = true) {
  const target = $(state.currentTarget);
  const question = state.currentQuiz[state.currentIndex];
  const answered = Object.keys(state.selected).length;
  const isLast = state.currentIndex === state.currentQuiz.length - 1;

  target.innerHTML = `
    <div class="quiz-status">
      <div>
        <strong>Intrebarea ${state.currentIndex + 1} din ${state.currentQuiz.length}</strong>
        <span>${answered} raspunsuri alese</span>
      </div>
      <div class="progress-track">
        <span style="width: ${((state.currentIndex + 1) / state.currentQuiz.length) * 100}%"></span>
      </div>
      ${state.currentMode === "test" ? renderQuestionSearch() : ""}
    </div>
    ${renderQuestion(question, state.currentIndex)}
    <div class="quiz-controls">
      <button class="ghost" id="prev-question" ${state.currentIndex === 0 ? "disabled" : ""}>Inapoi</button>
      <button class="primary" id="next-question">${isLast ? "Finalizeaza test" : "Urmatoarea"}</button>
    </div>
  `;

  target.querySelectorAll(".answer input").forEach((input) => {
    input.addEventListener("change", () => {
      state.selected[input.name] = input.value;
      revealQuestionFeedback(input.name, input.value);
      updateQuizStatus();
    });
  });

  target.querySelector("#prev-question").addEventListener("click", () => {
    if (state.currentIndex > 0) {
      state.currentIndex -= 1;
      renderCurrentQuestion();
    }
  });

  target.querySelector("#next-question").addEventListener("click", () => {
    if (isLast) {
      finishQuiz();
      return;
    }
    state.currentIndex += 1;
    renderCurrentQuestion();
  });

  if (shouldScroll) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const searchForm = target.querySelector("#question-search-form");
  if (searchForm) {
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      jumpToQuestionNumber();
    });
  }
}

function updateQuizStatus() {
  const status = document.querySelector(`${state.currentTarget} .quiz-status span`);
  if (status) status.textContent = `${Object.keys(state.selected).length} raspunsuri alese`;
}

function renderQuestionSearch() {
  return `
    <form class="question-search" id="question-search-form">
      <label for="question-search-input">Cauta nr. intrebare</label>
      <input id="question-search-input" type="number" min="1" placeholder="ex. 68" />
      <button class="ghost" type="submit">Cauta</button>
      <span class="jump-feedback" id="question-search-feedback"></span>
    </form>
  `;
}

function jumpToQuestionNumber() {
  const input = document.querySelector(`${state.currentTarget} #question-search-input`);
  const feedback = document.querySelector(`${state.currentTarget} #question-search-feedback`);
  const wantedNumber = Number(input?.value);
  if (!wantedNumber) {
    if (feedback) feedback.textContent = "Introdu un numar.";
    return;
  }

  const index = state.currentQuiz.findIndex((question) => question.numar === wantedNumber);
  if (index === -1) {
    if (feedback) feedback.textContent = "Nu exista in testul curent.";
    return;
  }

  state.currentIndex = index;
  renderCurrentQuestion();
}

function revealQuestionFeedback(questionId, selectedLetter) {
  const question = localQuestions().find((item) => item.id === questionId);
  if (!question) return;

  $$(`.answer[data-id="${questionId}"]`).forEach((answer) => {
    const letter = answer.dataset.letter;
    answer.classList.toggle("correct", letter === question.corect);
    answer.classList.toggle("wrong", letter === selectedLetter && selectedLetter !== question.corect);
  });
}

function renderQuestion(question, index) {
  const fullQuestion = localQuestions().find((item) => item.id === question.id);
  const selected = state.selected[question.id] || null;
  const answers = Object.entries(question.variante)
    .map(([letter, text]) => {
      const isCorrect = Boolean(selected && fullQuestion && letter === fullQuestion.corect);
      const isWrong = Boolean(selected && letter === selected && fullQuestion && selected !== fullQuestion.corect);
      return `
        <label class="answer ${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}" data-id="${question.id}" data-letter="${letter}">
          <input type="radio" name="${question.id}" value="${letter}" ${selected === letter ? "checked" : ""} />
          <span><strong>${letter.toUpperCase()}.</strong> ${text}</span>
        </label>
      `;
    })
    .join("");

  return `
    <article class="question-card" data-question="${question.id}">
      <div class="question-head">
        <span class="badge">${index + 1}</span>
        <span>${question.materie}</span>
        <span>nr. ${question.numar}</span>
      </div>
      <p class="question-text">${question.intrebare}</p>
      <div class="answers">${answers}</div>
    </article>
  `;
}

function renderStudy() {
  const subject = $("#study-subject").value;
  const search = $("#study-search").value.trim().toLowerCase();
  const questions = localQuestions().filter((question) => {
    const matchesSubject = subject === "__all__" || question.materie === subject;
    const text = `${question.intrebare} ${Object.values(question.variante).join(" ")}`.toLowerCase();
    return matchesSubject && (!search || text.includes(search));
  });

  $("#study-area").innerHTML = questions.length
    ? questions.map(renderStudyQuestion).join("")
    : `<p class="muted">Nu am gasit intrebari pentru filtrul ales.</p>`;
}

function renderStudyQuestion(question, index) {
  const answers = Object.entries(question.variante)
    .map(([letter, text]) => {
      const correct = letter === question.corect;
      return `
        <div class="answer ${correct ? "correct study-correct" : ""}">
          <span class="answer-letter">${letter.toUpperCase()}.</span>
          <span>${text}${correct ? ` <strong class="correct-label">Raspuns corect</strong>` : ""}</span>
        </div>
      `;
    })
    .join("");

  return `
    <article class="question-card">
      <div class="question-head">
        <span class="badge">${index + 1}</span>
        <span>${question.materie}</span>
        <span>nr. ${question.numar}</span>
      </div>
      <p class="question-text">${question.intrebare}</p>
      <div class="answers">${answers}</div>
    </article>
  `;
}

async function finishQuiz() {
  const answers = { ...state.selected };
  const byId = new Map(localQuestions().map((q) => [q.id, q]));
  const details = state.currentQuiz.map((item) => {
    const selected = answers[item.id] || null;
    const id = item.id;
    const question = byId.get(id);
    return {
      id,
      selected,
      corect: question?.corect,
      ok: Boolean(question && question.corect === selected),
    };
  });
  const result = {
    total: state.currentQuiz.length,
    correct: details.filter((item) => item.ok).length,
    details,
  };

  result.details.forEach((detail) => {
    const question = state.currentQuiz.find((item) => item.id === detail.id);
    document.querySelectorAll(`${state.currentTarget} .answer[data-id="${detail.id}"]`).forEach((answer) => {
      const letter = answer.dataset.letter;
      answer.classList.toggle("correct", letter === detail.corect);
      answer.classList.toggle("wrong", letter === detail.selected && !detail.ok);
    });

    if (!detail.ok && question) {
      state.mistakes[detail.id] = { ...question, corect: detail.corect, lastSelected: detail.selected || null };
    } else {
      delete state.mistakes[detail.id];
    }
  });

  state.results.push({
    date: new Date().toISOString(),
    mode: state.currentMode,
    total: result.total,
    correct: result.correct,
  });
  state.results = state.results.slice(-100);
  save("licenta-results", state.results);
  save("licenta-mistakes", state.mistakes);

  const percent = result.total ? Math.round((result.correct / result.total) * 100) : 0;
  $(state.currentTarget).innerHTML = `
    <div class="result-card">
      <strong>${result.correct}/${result.total} corecte (${percent}%)</strong>
      <p>Greselile au fost salvate automat pentru repetare.</p>
    </div>
  `;
}

function renderMistakes() {
  const mistakes = Object.values(state.mistakes);
  $("#mistakes-list").innerHTML = mistakes.length
    ? mistakes
        .map(
          (q) => `
            <article class="mistake-row">
              <strong>${q.materie} / nr. ${q.numar}</strong>
              <p>${q.intrebare}</p>
              <p class="muted">Corect: ${q.corect.toUpperCase()}${q.lastSelected ? `, ales: ${q.lastSelected.toUpperCase()}` : ""}</p>
            </article>
          `
        )
        .join("")
    : `<p class="muted">Nu ai greseli salvate.</p>`;
}

function renderStats() {
  const totalTests = state.results.length;
  const answered = state.results.reduce((sum, item) => sum + item.total, 0);
  const correct = state.results.reduce((sum, item) => sum + item.correct, 0);
  const percent = answered ? Math.round((correct / answered) * 100) : 0;
  const mistakes = Object.keys(state.mistakes).length;

  $("#stats-grid").innerHTML = [
    ["Teste finalizate", totalTests],
    ["Raspunsuri date", answered],
    ["Acuratete", `${percent}%`],
    ["Greseli active", mistakes],
  ]
    .map(([label, value]) => `<article class="stat-card"><h2>${label}</h2><strong>${value}</strong></article>`)
    .join("");
}

async function init() {
  state.questions = localQuestions();
  state.subjects = localSubjects();
  renderSubjects();
  fillSubjectSelect();

  $$(".nav").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $("#study-subject").addEventListener("change", renderStudy);
  $("#study-search").addEventListener("input", renderStudy);
  $("#start-test").addEventListener("click", () => startQuiz("test"));
  $("#start-exam").addEventListener("click", () => startQuiz("simulare"));
  $("#practice-mistakes").addEventListener("click", () => {
    const questions = shuffle(Object.values(state.mistakes)).slice(0, 50);
    setView("test");
    startQuiz("test", questions);
  });
  $("#clear-mistakes").addEventListener("click", () => {
    state.mistakes = {};
    save("licenta-mistakes", state.mistakes);
    renderMistakes();
  });
}

init().catch((error) => {
  document.body.innerHTML = `<main class="view active"><p>${error.message}</p></main>`;
});
