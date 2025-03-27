import { StatementSync } from "node:sqlite";
import { dmActor } from "./game";
import { isValidCategory, isValidDifficulty } from "./helpers";

// ============== DOM ELEMENTS ==============
const splashLayout = document.getElementById("layout")!;
const splashPage = document.getElementById("splash")!;
const right = document.getElementById("right-side")!;
const startButton = document.getElementById("start-button")!;
const page2 = document.getElementById("page2")!;
const page3 = document.getElementById("page3")!;
const page4 = document.getElementById("page4")!;
const page5 = document.getElementById("page5")!;
const restartButton = document.getElementById("restart-button")!;
const viewStatus = document.getElementById("view-status");
const transcriptEl = document.getElementById("transcript")!;
const clueNum = document.getElementById("clue-number");
const clueText = document.getElementById("clue-text");
const scoreEl = document.getElementById("score");
const categoryEl = document.getElementById("category");
const difficultyEl = document.getElementById("difficulty");

// ============== STATE VARIABLES ==============
let page3Timeout: ReturnType<typeof setTimeout> | null = null;
let transitionedToPage4 = false;
let hasPlayedOnce = false;
let lastTranscript = "";
let cachedCategory: string | null = null;
let cachedDifficulty: string | null = null;

// ============== UTILITY FUNCTIONS ==============
function cleanTranscript(text: string): string {
  return text
    .toLowerCase()

    .replace(/(.)\1+/g, "$1")

    .replace(/(\s)\1+/g, "$1")
    .replace(/[^a-z0-9\s.,!?']/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function showTranscript(element: HTMLElement, text: string, speed = 30) {
  const contentEl = element.querySelector("#transcript-content")!;
  if (text === lastTranscript) return;

  lastTranscript = text;
  contentEl.textContent = "";
  let index = 0;

  const interval = setInterval(() => {
    contentEl.textContent += text.charAt(index);
    index++;
    if (index >= text.length) clearInterval(interval);
  }, speed);
}

// ============== SPEECH BUBBLE MANAGEMENT ==============
function updateSpeechBubbles(state: any) {
  const bubbles = [
    document.querySelector("#page2 .bubble-main"),
    document.querySelector("#page3 .bubble-main"),
    document.querySelector("#page4 .bubble-main"),
  ].filter(Boolean) as HTMLElement[];

  bubbles.forEach((bubble) => {
    bubble.innerHTML = "";
    bubble.className = "bubble bubble-main";
  });

  const stateHandlers = {
    speaking: () =>
      bubbles.forEach((bubble) => {
        bubble.textContent = "Speaking...";
        bubble.classList.add("speaking");
      }),

    listening: () =>
      bubbles.forEach((bubble) => {
        bubble.innerHTML = '<i class="fa fa-microphone"></i>';
        bubble.classList.add("pulsing");
      }),

    correct: () => {
      const page4Bubble = document.querySelector("#page4 .bubble-main");
      if (page4Bubble) {
        page4Bubble.textContent = "Correct!";
        page4Bubble.classList.add("correct-state");
      }
    },

    incorrect: () => {
      const page4Bubble = document.querySelector("#page4 .bubble-main");
      if (page4Bubble) {
        page4Bubble.textContent = "Incorrect!";
        page4Bubble.classList.add("incorrect-state");
      }
    },
  };

  if (
    state.matches({ PlayClue: "SayClue" }) ||
    state.matches({ GetGameSettings: "Speaking" }) ||
    state.matches({ CorrectAnswer: "SayCorrect" }) ||
    state.matches("Greeting") ||
    state.matches({ GetGameSettings: { GetCategory: "AskForCategory" } }) ||
    state.matches({ GetGameSettings: { GetDifficulty: "AskForDifficulty" } }) ||
    state.matches({ IncorrectAnswer: "HandleLastClue" }) ||
    state.matches({ IncorrectAnswer: "SayIncorrect" })
  ) {
    stateHandlers.speaking();
  } else if (
    state.matches({ PlayClue: "GetAnswer" }) ||
    state.matches({ GetGameSettings: "Listening" }) ||
    state.matches({ CorrectAnswer: "GetConfirmation" }) ||
    state.matches({ IncorrectAnswer: "GetAnswer" }) ||
    state.matches({ GetGameSettings: { GetCategory: "GetCat" } }) ||
    state.matches({ GetGameSettings: { GetDifficulty: "GetDif" } })
  ) {
    stateHandlers.listening();
  } else if (state.matches({ CorrectAnswer: "AskToRestart" })) {
    stateHandlers.correct();
  } else if (state.matches({ IncorrectAnswer: "AskNextClue" })) {
    stateHandlers.incorrect();
  }
}

// ============== EVENT LISTENERS ==============
window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    splashLayout.classList.remove("center");
    splashLayout.classList.add("split");
    right.classList.remove("hidden");
    right.classList.add("show");
  }, 1500);

  startButton.addEventListener("click", () => {
    dmActor.send({ type: "CLICK" });
    splashPage.classList.remove("active");
    page2.classList.add("active");
  });
});

// ============== STATE MANAGEMENT ==============
dmActor.subscribe((state) => {
  const {
    score,
    previousScore,
    category,
    difficulty,
    currentItem,
    currentClueIndex,
    clues,
    transcript,
  } = state.context;
  updateSpeechBubbles(state);

  if (category && isValidCategory(category)) cachedCategory = category;
  if (difficulty && isValidDifficulty(difficulty))
    cachedDifficulty = difficulty;

  document.querySelectorAll(".option").forEach((el) => {
    const type = el.getAttribute("data-type");
    const value = el.getAttribute("data-value")?.toLowerCase();

    const isSelected =
      (type === "difficulty" &&
        value === cachedDifficulty?.toLowerCase() &&
        isValidDifficulty(value ?? null)) ||
      (type === "category" &&
        value === cachedCategory?.toLowerCase() &&
        isValidCategory(value ?? null));

    el.classList.toggle("selected", isSelected);
  });

  // Update clue number and text
  if (clueNum && currentClueIndex != null) {
    clueNum.textContent = (currentClueIndex + 1).toString();
  }

  if (clueText && clues?.length > 0) {
    clueText.textContent = clues[currentClueIndex];
  }

  // Update transcript
  if (transcript && transcriptEl) {
    showTranscript(transcriptEl, cleanTranscript(transcript));
  }

  // Update score, category, and difficulty displays
  if (scoreEl) scoreEl.textContent = score?.toString() ?? "0";
  if (categoryEl) categoryEl.textContent = cachedCategory ?? "N/A";
  if (difficultyEl) difficultyEl.textContent = cachedDifficulty ?? "N/A";

  // ===== PAGE TRANSITIONS =====
  // Transition to game page when category/difficulty are selected
  if (
    cachedCategory &&
    cachedDifficulty &&
    isValidCategory(cachedCategory) &&
    isValidDifficulty(cachedDifficulty) &&
    !page3Timeout
  ) {
    page3Timeout = setTimeout(() => {
      page2.classList.remove("active");
      page3.classList.add("active");
    }, 500);
  }

  // ===== HANDLE CORRECT ANSWER =====
  if (state.matches({ CorrectAnswer: "AskToRestart" })) {
    if (!transitionedToPage4) {
      transitionedToPage4 = true;
      page3.classList.remove("active");
      page4.classList.add("active");
      page4.classList.remove("incorrect");
    }

    // Update transcript in page4
    const page4Transcript = page4.querySelector("#transcript") as HTMLElement;
    if (transcript && page4Transcript) {
      showTranscript(page4Transcript, cleanTranscript(transcript));
    }

    // Show score animation (previous + bonus)
    const newPoints = score - (previousScore ?? 0);
    const page4ScoreEl = page4.querySelector("#score");
    if (page4ScoreEl) {
      page4ScoreEl.innerHTML = `${previousScore ?? 0} <span class="score-bonus">+${newPoints}</span>`;
      setTimeout(() => {
        page4ScoreEl.textContent = score?.toString() ?? "0";
      }, 3000);
    }

    // Update clue info
    const page4ClueNum = page4.querySelector("#clue-number");
    if (page4ClueNum)
      page4ClueNum.textContent = (currentClueIndex + 1).toString();

    const page4ClueText = page4.querySelector("#clue-text");
    if (page4ClueText) page4ClueText.textContent = clues[currentClueIndex];

    // Update category/difficulty
    const page4CategoryEl = page4.querySelector("#category");
    const page4DifficultyEl = page4.querySelector("#difficulty");
    if (page4CategoryEl) page4CategoryEl.textContent = cachedCategory ?? "N/A";
    if (page4DifficultyEl)
      page4DifficultyEl.textContent = cachedDifficulty ?? "N/A";
  }

  // ===== HANDLE INCORRECT ANSWER (NORMAL CASE) =====
  else if (state.matches({ IncorrectAnswer: "AskNextClue" })) {
    if (!transitionedToPage4) {
      transitionedToPage4 = true;
      page3.classList.remove("active");
      page4.classList.add("active", "incorrect");
    }

    // Update transcript
    const page4Transcript = page4.querySelector("#transcript") as HTMLElement;
    if (transcript && page4Transcript) {
      showTranscript(page4Transcript, cleanTranscript(transcript));
    }

    // Update score (no bonus animation)
    const page4ScoreEl = page4.querySelector("#score");
    if (page4ScoreEl) page4ScoreEl.textContent = score?.toString() ?? "0";

    // Update clue info
    const page4ClueNum = page4.querySelector("#clue-number");
    if (page4ClueNum)
      page4ClueNum.textContent = (currentClueIndex + 1).toString();

    const page4ClueText = page4.querySelector("#clue-text");
    if (page4ClueText) page4ClueText.textContent = clues[currentClueIndex];

    // Update category/difficulty
    const page4CategoryEl = page4.querySelector("#category");
    const page4DifficultyEl = page4.querySelector("#difficulty");
    if (page4CategoryEl) page4CategoryEl.textContent = cachedCategory ?? "N/A";
    if (page4DifficultyEl)
      page4DifficultyEl.textContent = cachedDifficulty ?? "N/A";
  }

  // ===== HANDLE LAST CLUE CASE =====
  else if (state.matches({ IncorrectAnswer: "HandleLastClue" })) {
    if (!transitionedToPage4) {
      transitionedToPage4 = true;
      page3.classList.remove("active");
      page4.classList.add("active");
      page4.classList.remove("incorrect");
    }

    // Use showTranscript instead of direct textContent
    const page4Transcript = page4.querySelector("#transcript") as HTMLElement;
    const page4TranscriptContent = page4Transcript.querySelector(
      "#transcript-content",
    );
    if (page4TranscriptContent) {
      page4TranscriptContent.textContent = `No more clues! The answer was ${currentItem?.name}.`;
    }

    // Show score with bonus animation (like CorrectAnswer)
    const newPoints = Math.max(10 - currentClueIndex, 1);
    const page4ScoreEl = page4.querySelector("#score");
    if (page4ScoreEl) {
      page4ScoreEl.innerHTML = `${score - newPoints} <span class="score-bonus">+${newPoints}</span>`;
      setTimeout(() => {
        page4ScoreEl.textContent = score?.toString() ?? "0";
      }, 3000);
    }

    // Update clue info to show last clue
    const page4ClueNum = page4.querySelector("#clue-number");
    if (page4ClueNum) page4ClueNum.textContent = clues.length.toString();

    // Update category/difficulty
    const page4CategoryEl = page4.querySelector("#category");
    const page4DifficultyEl = page4.querySelector("#difficulty");
    if (page4CategoryEl) page4CategoryEl.textContent = cachedCategory ?? "N/A";
    if (page4DifficultyEl)
      page4DifficultyEl.textContent = cachedDifficulty ?? "N/A";
  }

  // ===== ANALYZING STATE =====
  if (
    (state.matches("CorrectAnswer") &&
      !state.matches({ CorrectAnswer: "AskToRestart" })) ||
    (state.matches("IncorrectAnswer") &&
      !(
        state.matches({ IncorrectAnswer: "AskNextClue" }) ||
        state.matches({ IncorrectAnswer: "HandleLastClue" })
      ))
  ) {
    const bubble = document.querySelector("#page3 .bubble-main");
    if (bubble) {
      bubble.textContent = "Analyzing...";
      bubble.classList.add("analyzing");
    }
  } else {
    const bubble = document.querySelector("#page3 .bubble-main");
    if (bubble) bubble.classList.remove("analyzing");
  }

  if (
    (state.matches("StartGame") || state.matches("PlayClue")) &&
    hasPlayedOnce &&
    !page3.classList.contains("active")
  ) {
    transitionedToPage4 = false;
    page4.classList.remove("active", "incorrect");
    page3.classList.add("active");

    const transcriptEl = page3.querySelector("#transcript-content");
    if (transcriptEl) transcriptEl.textContent = "";
  }

  // ===== GAME OVER FROM ANYWHERE =====
  if (state.matches("GameOver")) {
    // Force transition to page5 regardless of current page
    page2.classList.remove("active");
    page3.classList.remove("active");
    page4.classList.remove("active");
    page5.classList.add("active");

    // Reset cached settings
    cachedCategory = null;
    cachedDifficulty = null;

    // Clear any selected options
    document.querySelectorAll(".option").forEach((el) => {
      el.classList.remove("selected");
    });

    // Update final score
    const finalScoreEl = document.getElementById("final-score");
    if (finalScoreEl)
      finalScoreEl.textContent = state.context.score?.toString() ?? "0";
  }

  // Mark as played once when reaching these states
  if (
    state.matches({ CorrectAnswer: "AskToRestart" }) ||
    state.matches({ IncorrectAnswer: "AskNextClue" }) ||
    state.matches({ IncorrectAnswer: "HandleLastClue" })
  ) {
    hasPlayedOnce = true;
  }
});

restartButton.addEventListener("click", () => {
  cachedCategory = null;
  cachedDifficulty = null;

  // RESET PAGE3 TIMEOUT
  if (page3Timeout) {
    clearTimeout(page3Timeout);
    page3Timeout = null;
  }

  document.querySelectorAll(".option").forEach((el) => {
    el.classList.remove("selected");
  });

  dmActor.send({ type: "CLICK" });
  page5.classList.remove("active");
  page2.classList.add("active");
});
