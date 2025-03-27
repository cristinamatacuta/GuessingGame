import { assign, createActor, setup, transition } from "xstate";
import { Settings, speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY, NLU_KEY } from "./azure.ts";
import { DMContext, DMEvents } from "./types.ts";
import {
  isValidCategory,
  isValidDifficulty,
  extractEntity,
} from "./helpers.ts";
import data from "./game.json";


const inspector = createBrowserInspector();

const azureCredentials = {
  endpoint:
    "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const azureLanguageCredentials = {
  endpoint:
    "https://language-lab4.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2024-11-15-preview",
  key: NLU_KEY,
  deploymentName: "game",
  projectName: "GuessingGame",
};

const settings: Settings = {
  azureLanguageCredentials,
  azureCredentials,
  azureRegion: "northeurope",
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-GB",
  ttsDefaultVoice: "en-GB-SoniaNeural",
};



interface Item {
  name: string;
  difficulty: string;
  clues: string[];
}

interface Categories {
  [key: string]: Item[];
}

const categories: Categories = data.categories;

const dmMachine = setup({
  types: {
    context: {} as DMContext,
    events: {} as DMEvents,
  },
  actions: {
    "spst.speak": ({ context }, params: { utterance: string }) =>
      context.spstRef.send({
        type: "SPEAK",
        value: { utterance: params.utterance },
      }),
    "spst.listen": ({ context }) =>
      context.spstRef.send({ type: "LISTEN", value: { nlu: true } }),
    //Shortcuts for actions

    // Reset all relevant context properties
    resetGame: assign({
      currentItem: null,
      currentClueIndex: 0,
      clues: [],
      answer: null,
    }),
    // Assign points to the player
    assignPoints: assign({
      previousScore: ({ context }) => context.score, 
      score: ({ context }) =>
        context.score + Math.max(10 - context.currentClueIndex, 1),
    }),
    // Set intent to null
    resetIntent: assign({
      intent: null, 
    }),
 
    // Increment the clue index
    incrementClueIndex: assign({
      currentClueIndex: ({ context }) => context.currentClueIndex + 1,
    }),
    // Save user input
    saveTranscript: assign({
      transcript: (_, event: DMEvents) =>
        "nluValue" in event && event.nluValue?.text ? event.nluValue.text : "",
    }),
  },
}).createMachine({
  id: "DM",
  initial: "Prepare",
  context: ({ spawn }) => ({
    spstRef: spawn(speechstate, { input: settings }),
    category: null,
    difficulty: null,
    intent: null,
    currentItem: null,
    currentClueIndex: 0,
    clues: [],
    score: 0,
    answer: null,
    transcript: "",
    previousScore: 0,
  }),
  states: {
    Prepare: {
      entry: ({ context }) => context.spstRef.send({ type: "PREPARE" }),
      on: { ASRTTS_READY: "WaitToStart" },
    },
    WaitToStart: {
      entry: assign({ category: null, difficulty: null, intent: null }),
      on: { CLICK: "Greeting" },
    },
    Greeting: {
      entry: [
        // Reset all relevant context properties
        assign({
          category: null,
          difficulty: null,
          intent: null,
          score: 0,
          previousScore: 0,
          currentItem: null,
          currentClueIndex: 0,
          clues: [],
          answer: null,
          transcript: "",
        }),

        {
          type: "spst.speak",
          params: {
            utterance:
              "Welcome to Trivaso! Choose a category and a difficulty.",
          },
        },
      ],
      on: { SPEAK_COMPLETE: "GetGameSettings" },
    },
    
    // State that listens for the user to select a category and difficulty
    // Child and granchild states that listen and retrive category and difficulty if not recognized or selected initially
    GetGameSettings: {
      // Reset to null when entering this state
      entry: assign({ intent: null, category: null, difficulty: null }),
      initial: "Listening",
      on: {
        LISTEN_COMPLETE: [
          {
            target: "#DM.StartGame",
            guard: ({ context }) =>
              isValidCategory(context.category?.toLowerCase() ?? null) && // Convert to lowercase so it matched the category
              isValidDifficulty(context.difficulty?.toLowerCase() ?? null), // Convert to lowercase so it matches thd difficulty
          },
          {
            target: ".GetCategory",
            guard: ({ context }) =>
              !isValidCategory(context.category?.toLowerCase() ?? null), 
          },
          {
            target: ".GetDifficulty",
            guard: ({ context }) =>
              !isValidDifficulty(context.difficulty?.toLowerCase() ?? null), 
          },
          {
            target: ".NoInput",
            guard: ({ context }) =>
              !isValidCategory(context.category?.toLowerCase() ?? null) && 
              !isValidDifficulty(context.difficulty?.toLowerCase() ?? null), 
          },
          {
            target: "#DM.GameOver",
            guard: ({ context }) => context.intent === "cancel",
          },
        ],
      },
      states: {
        // State that listens to the user input and extract category, intent, and difficulty
        Listening: {
          entry: "spst.listen",
          on: {
            RECOGNISED: {
              actions: [
                assign(({ event }) => {
                  return {
                    intent: event.nluValue?.topIntent,
                    category: extractEntity(
                      event.nluValue?.entities,
                      "category",
                    )?.toLowerCase(), // Convert to lowercase
                    difficulty: extractEntity(
                      event.nluValue?.entities,
                      "difficulty",
                    )?.toLowerCase(),
                  };
                }),
              ],
            },
            ASR_NOINPUT: {
              actions: assign({
                intent: null,
                category: null,
                difficulty: null,
              }),
            },
          },
        },
        // Helping state that speaks when no input is detected
        NoInput: {
          entry: {
            type: "spst.speak",
            params: {
              utterance:
                "I'm sorry, I didn't get that. Please select a category and difficulty.",
            },
          },
          on: { SPEAK_COMPLETE: "Listening" },
        },
        // Child state that listens for the category if difficulty exists
        GetCategory: {
          initial: "AskForCategory",
          states: {
            AskForCategory: {
              entry: {
                type: "spst.speak",
                params: { utterance: "Please select a category." },
              },
              on: { SPEAK_COMPLETE: "GetCat" },
            },
            // State that retrives the category
            // Contains fallback in case the intent does not match the right intent
            // Tries to extract from raw text 
            GetCat: {
              entry: "spst.listen",
              on: {
                RECOGNISED: {
                  actions: assign(({ event }) => {
                    const rawText = event.nluValue?.text?.toLowerCase() ?? "";
                    const category =
                      extractEntity(
                        event.nluValue?.entities,
                        "category",
                      )?.toLowerCase() ?? null;

                    // Fallback: if no entity, try matching the raw text directly
                    const fallbackCategory =
                      category || (isValidCategory(rawText) ? rawText : null);
                    const fallbackIntent = fallbackCategory
                      ? "selectGameSettings"
                      : event.nluValue?.topIntent;

                    return {
                      intent: fallbackIntent,
                      category: fallbackCategory,
                    };
                  }),
                },

                ASR_NOINPUT: {
                  actions: assign({ category: null }),
                },
              },
            },
          },
        },
        // Child state that listens for the difficulty if category exists
        GetDifficulty: {
          initial: "AskForDifficulty",
          states: {
            AskForDifficulty: {
              entry: {
                type: "spst.speak",
                params: { utterance: "Please select a difficulty." },
              },
              on: { SPEAK_COMPLETE: "GetDif" },
            },
            // State that retrives the difficulty
            // Contains fallback in case the intent does not match the right intent
            // Tries to extract from raw text
            GetDif: {
              entry: "spst.listen",
              on: {
                RECOGNISED: {
                  actions: assign(({ event }) => {
                    const rawText = event.nluValue?.text?.toLowerCase() ?? "";
                    const difficulty =
                      extractEntity(
                        event.nluValue?.entities,
                        "difficulty",
                      )?.toLowerCase() ?? null;

                    // Fallback: If no entity, try matching the raw text directly
                    const fallbackDifficulty =
                      difficulty ||
                      (isValidDifficulty(rawText) ? rawText : null);
                    const fallbackIntent = fallbackDifficulty
                      ? "selectGameSettings"
                      : event.nluValue?.topIntent;

                    return {
                      intent: fallbackIntent,
                      difficulty: fallbackDifficulty,
                    };
                  }),
                },
                ASR_NOINPUT: {
                  actions: assign({ difficulty: null }),
                },
              },
            },
          },
        },
      },
    },
    // Brain of the game, it initially resets properties for when the user decides to play two rounds in a row
    // It filters the json file and extracts only the items from the selected category and difficulty
    // It then selects a random item from the filtered items
    // It makes sure the same item is not selected twice in a row
    // It then sets the current item, clues, and current clue index
    StartGame: {
      entry: [
        "resetGame",
        assign(({ context }) => {
          const selectedCategory = categories[context.category!];
          const filteredItems = selectedCategory.filter(
            (item) => item.difficulty === context.difficulty,
          );

          // Make sure we dont get the same item twice in a row
          let newItem;
          do {
            newItem =
              filteredItems[Math.floor(Math.random() * filteredItems.length)];
          } while (newItem === context.currentItem && filteredItems.length > 1);

          return {
            currentItem: newItem,
            clues: newItem.clues,
            currentClueIndex: 0,
          };
        }),
        "resetIntent",
      ],
      always: "#DM.PlayClue",
    },
    
    // Clue state, it first says the clue, and then listens for the user's answer
    // IMPORTANT!! Due to NLU issues, the program might encounter issues when trying to extract the user's answer is answer is only one word
    PlayClue: {
      initial: "SayClue",
      states: {
        SayClue: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `Here is your clue: ${context.clues[context.currentClueIndex]}`,
            }),
          },
          on: { SPEAK_COMPLETE: "GetAnswer" },
        },
        // State that gets the answer
        // It overrides the intent if the user's answer is only one word as a fallback, however, it is not 100% reliable
        GetAnswer: {
          entry: "spst.listen",
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                const guess = extractEntity(
                  event.nluValue?.entities,
                  "guess",
                )?.toLowerCase();
                return {
                  answer: guess,
                  intent: guess ? "guessedAnswer" : event.nluValue?.topIntent,
                  transcript: event.value?.[0]?.utterance ?? "",
                };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ answer: null }),
            },
          },
        },
      },
      // Depending on the answer, the program will either go to the correct answer state, the incorrect answer state, or the game over state
      // Or play the next Clue, by staing in the same state, and increesing the index
      on: {
        LISTEN_COMPLETE: [
          {
            target: "#DM.CorrectAnswer",
            guard: ({ context }) =>
              context.answer?.toLowerCase() ===
                context.currentItem?.name.toLowerCase() &&
              context.intent === "guessedAnswer",
          },
          {
            target: "#DM.IncorrectAnswer",
            guard: ({ context }) =>
              (context.intent === "guessedAnswer" &&
                context.answer?.toLowerCase() !==
                  context.currentItem?.name.toLowerCase()) ||
              (context.currentClueIndex >= context.clues.length - 1 &&
                (context.answer === null || context.intent === "nextClue")),
          },
          {
            target: "#DM.GameOver",
            guard: ({ context }) => context.intent === "cancel",
          },
          {
            target: "#DM.PlayClue",
            guard: ({ context }) =>
              (context.intent === "nextClue" || context.answer === null) &&
              context.currentClueIndex < context.clues.length - 1,
            actions: ["incrementClueIndex"],
          },
        ],
      },
    },
    CorrectAnswer: {
      entry: assign({ intent: null }), // Reset intent when entering this state
      initial: "DelayBeforeSpeak", // Create a delay state before speaking
      on: {
        LISTEN_COMPLETE: [
          {
            target: "#DM.StartGame",
            guard: ({ context }) =>
              context.intent === "restart" ||
              context.intent === "confirm" ||
              context.intent === "selectGameSettings",
          },
          {
            target: "#DM.GameOver",
            guard: ({ context }) =>
              context.intent === "cancel" || context.intent === null,
          },
        ],
      },
      states: {
        DelayBeforeSpeak: {
          after: {
            3000: "AskToRestart",
          },
        },
        AskToRestart: {
          entry: [
            { type: "assignPoints" },
            {
              type: "spst.speak",
              params: ({ context }) => ({
                utterance: `Correct! You earned ${Math.max(
                  10 - context.currentClueIndex,
                  1,
                )} points. Your total score is ${context.score}. Would you like to play again? Please state the category and difficulty if different.`,
              }),
            },
          ],
          on: { SPEAK_COMPLETE: "GetConfirmation" },
        },
        GetConfirmation: {
          entry: "spst.listen", 
          on: {
            RECOGNISED: {
              actions: [
                assign(({ context, event }) => {
                  const intent = event.nluValue?.topIntent;

                  // If the intent is selectGameSettings, extract and update category/difficulty
                  if (intent === "selectGameSettings") {
                    const newCategory = extractEntity(
                      event.nluValue?.entities,
                      "category",
                    )?.toLowerCase();
                    const newDifficulty = extractEntity(
                      event.nluValue?.entities,
                      "difficulty",
                    )?.toLowerCase();

                    return {
                      intent,
                      category: newCategory || context.category, // Use new category if provided, else keep existing
                      difficulty: newDifficulty || context.difficulty, // Use new difficulty if provided, else keep existing
                    };
                  }

                  return { intent };
                }),
              ],
            },
            ASR_NOINPUT: {
              actions: assign({ intent: null }),
            },
          },
        },
      },
    },

    IncorrectAnswer: {
      entry: assign({ intent: null }),
      initial: "DelayBeforeNextClue",
      on: {
        LISTEN_COMPLETE: [
          {
            target: "#DM.PlayClue",
            guard: ({ context }) =>
              context.intent === "confirm" &&
              context.currentClueIndex < context.clues.length - 1,
            actions: ["incrementClueIndex"],
          },
          {
            target: "#DM.StartGame",
            guard: ({ context }) =>
              context.intent === "restart" ||
              context.intent === "confirm" ||
              context.intent === "selectGameSettings",
          },
          {
            target: "#DM.GameOver",
            guard: ({ context }) => context.intent === "cancel",
          },
          {
            target: ".HandleLastClue",
            guard: ({ context }) =>
              context.currentClueIndex >= context.clues.length - 1,
          },
          {
            target: ".AskNextClue",
            guard: ({ context }) =>
              context.intent === null &&
              context.currentClueIndex < context.clues.length - 1,
          },
        ],
      },
      states: {
        DelayBeforeNextClue: { // Delay state for UI purposes
          after: {
            3000: [
              // Depeding on the number of clues left, the program will either ask for the next clue or handle the last clue
              {  
                target: "HandleLastClue",
                guard: ({ context }) =>
                  context.currentClueIndex >= context.clues.length - 1,
              },
              {
                target: "AskNextClue",
              },
            ],
          },
        },
        // State reached if the number of clues left is zero and no answer was given or the answer was incorrect
        HandleLastClue: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: context.answer
                ? `Incorrect! The correct answer was ${context.currentItem?.name}. Would you like to play again? Please state the category and difficulty if different.`
                : `You've reached the last clue. The correct answer was ${context.currentItem?.name}. Would you like to play again?  Please state the category and difficulty if different.`,
            }),
          },
          on: { SPEAK_COMPLETE: "GetAnswer" },
        },
        // If answer is incorrect and there are still clues left, the program will ask if the user wants to continue with the next clue
        AskNextClue: {
          entry: {
            type: "spst.speak",
            params: ({ context }: { context: DMContext }) => ({
              utterance: context.answer
                ? "Incorrect answer. Would you like to continue with the next clue?"
                : "Incorrect answer. Would you like to continue with the next clue?",
            }),
          },
          on: { SPEAK_COMPLETE: "GetAnswer" },
        },
        GetAnswer: {
          entry: "spst.listen",
          on: {
            RECOGNISED: {
              actions: assign(({ event, context }) => {
                const intent = event.nluValue?.topIntent;

                if (intent === "selectGameSettings") {
                  const newCategory = extractEntity(
                    event.nluValue?.entities,
                    "category",
                  )?.toLowerCase();
                  const newDifficulty = extractEntity(
                    event.nluValue?.entities,
                    "difficulty",
                  )?.toLowerCase();

                  return {
                    intent,
                    category: newCategory || context.category,
                    difficulty: newDifficulty || context.difficulty,
                  };
                }

                return { intent };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ intent: null }),
            },
          },
        },
      },
    },
    GameOver: {
      entry: {
        type: "spst.speak",
        params: ({ context }) => ({
          utterance: `Game over! Your final score is ${context.score}. Please press on Start if you want to play again`,
        }),
      },
      on: { SPEAK_COMPLETE: "#DM.Done" },
    },
    Done: {
      on: { CLICK: "#DM.Greeting" },
    },
  },
});

const dmActor = createActor(dmMachine, {
  inspect: inspector.inspect,
});

dmActor.start();

export { dmActor };
