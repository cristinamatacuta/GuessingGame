import "./style.css";
import { dmActor } from "./game"; // Now we import the actor!

// DOM elements
const splashPage = document.getElementById("splash")!;
const gamePage = document.getElementById("game")!;
const startBtn = document.getElementById("start-button")!;

// Transition from splash → game
startBtn.addEventListener("click", () => {
  splashPage.classList.remove("active");
  gamePage.classList.add("active");

  dmActor.send({ type: "CLICK" });
});

// Update the UI live
dmActor.subscribe((state) => {
  const { score, category, difficulty } = state.context;
  document.getElementById("score")!.textContent = score.toString();
  document.getElementById("category")!.textContent = category ?? "N/A";
  document.getElementById("difficulty")!.textContent = difficulty ?? "N/A";

  console.group("State update");
  console.log("State value:", state.value);
  console.log("State context:", state.context);
  console.groupEnd();
});
