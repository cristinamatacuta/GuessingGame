import { assign, createActor, setup, transition } from "xstate";
import { Settings, speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY, NLU_KEY } from "./azure.ts";
import { DMContext, DMEvents } from "./types.ts";
import { isValidCategory, isValidDifficulty, extractEntity} from "./helpers.ts";
;




interface NLUValue {
  entities: any;
  topIntent: string;
  text?: string; // Ensure this is included
}

const inspector = createBrowserInspector();

const azureCredentials = {
  endpoint: "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const azureLanguageCredentials = {
  endpoint: "https://language-lab4.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2024-11-15-preview",
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

import data from './game.json';

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
    "resetGame": assign({
      currentItem: null,
      currentClueIndex: 0,
      clues: [],
      answer: null,
    }),
    "assignPoints": assign({
  previousScore: ({ context }) => context.score, // 💾 Save current score
  score: ({ context }) => context.score + Math.max(10 - context.currentClueIndex, 1),
}),

    "resetIntent": assign({
      intent: null, // Reset intent to null
    }),
    "assignAnswer": assign(({ event }) => {
      const answer = 'nluValue' in event ? extractEntity(event.nluValue?.entities, "guess") : null;
      console.log("Extracted Answer:", answer); // Debugging log
      return { answer: answer?.toLowerCase() }; // Convert answer to lowercase
    }),
    "incrementClueIndex": assign({
      currentClueIndex: ({ context }) => context.currentClueIndex + 1,
    }),
      "saveTranscript": assign({
        transcript: (_, event: DMEvents) => ('nluValue' in event && event.nluValue?.text ? event.nluValue.text : "")
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
          transcript: ""
        }),
        // Speak the welcome message
        {
          type: "spst.speak",
          params: { utterance: "Welcome to Trivaso! Choose a category and a difficulty." }
        }
      ],
      on: { SPEAK_COMPLETE: "GetGameSettings" },
    },

   
    GetGameSettings: {
      entry: assign({ intent: null, category: null, difficulty: null }),
      initial: "Listening",
      on: {
        LISTEN_COMPLETE: [
          {
            target: "#DM.StartGame",
            guard: ({ context }) =>
              context.intent === "selectGameSettings" &&
              isValidCategory(context.category?.toLowerCase() ?? null) && // Convert to lowercase
              isValidDifficulty(context.difficulty?.toLowerCase() ?? null), // Convert to lowercase
          },
          {
            target: ".GetCategory",
            guard: ({ context }) =>
              context.intent === "selectGameSettings" &&
              !isValidCategory(context.category?.toLowerCase() ?? null), // Convert to lowercase
          },
          {
            target: ".GetDifficulty",
            guard: ({ context }) =>
              context.intent === "selectGameSettings" &&
              !isValidDifficulty(context.difficulty?.toLowerCase() ?? null), // Convert to lowercase
          },
          {
            target: ".NoInput",
            guard: ({ context }) =>
              context.intent === null || context.intent==="guessedAnswer" || context.intent==="confirm"&&
              !isValidCategory(context.category?.toLowerCase() ?? null) && // Convert to lowercase
              !isValidDifficulty(context.difficulty?.toLowerCase() ?? null), // Convert to lowercase
          },
          {
            target: "#DM.GameOver",
            guard: ({ context }) => context.intent === "cancel"
          },
        ],
      },
      states: {
        Listening: {
          entry: "spst.listen",
          on: {
            RECOGNISED: {
              actions: [
                
                assign(({ event }) => {
                  return {
                    intent: event.nluValue?.topIntent,
                    category: extractEntity(event.nluValue?.entities, "category")?.toLowerCase(), // Convert to lowercase
                    difficulty:extractEntity(event.nluValue?.entities, "difficulty")?.toLowerCase(),
                  };
                }),
              ],
            },
            ASR_NOINPUT: {
              actions: assign({ intent: null, category: null, difficulty: null }),
            },
          },
        },
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: "I'm sorry, I didn't get that. Please select a category and difficulty." },
          },
          on: { SPEAK_COMPLETE: "Listening" },
        },
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
            GetCat: {
              entry: "spst.listen",
              on: {
                RECOGNISED: {
                  actions: assign(({ event }) => {
                    const category = extractEntity(event.nluValue?.entities, "category")?.toLowerCase() ?? null;
                
                    return {
                      intent: category ? "selectGameSettings" : event.nluValue?.topIntent,
                      category,
                    };
                  }),
                },
                ASR_NOINPUT:{
                  actions:assign({category:null})
                },
                
              },
            },
          },
        },
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
            GetDif: {
              entry: "spst.listen",
              on: {
                RECOGNISED: {
                  actions: assign(({ event }) => {
                    const difficulty = extractEntity(event.nluValue?.entities, "difficulty")?.toLowerCase() ?? null;
                
                    return {
                      intent: difficulty ? "selectGameSettings" : event.nluValue?.topIntent,
                      difficulty,
                    };
                  }),
                },
                ASR_NOINPUT:{
                  actions:assign({difficulty:null})
                },
                
                
              },
            },
          },
        },
      },
    },
 

    StartGame: {
      entry: [
        "resetGame",
        assign(({ context }) => {
          const selectedCategory = categories[context.category!];
          const filteredItems = selectedCategory.filter(
            (item) => item.difficulty === context.difficulty
          );
    
          // Make sure we dont get the same item twice in a row
          let newItem;
          do {
            newItem = filteredItems[Math.floor(Math.random() * filteredItems.length)];
          } while (newItem === context.currentItem && filteredItems.length > 1);
    
          return {
            currentItem: newItem,
            clues: newItem.clues,
            currentClueIndex: 0,
          };
        }),
        "resetIntent",
      ],
      always: "#DM.PlayClue"
    },
    
PlayClue: {
  initial: "SayClue",
  states: {
    SayClue: {
      entry: {
        type: "spst.speak",
        params: ({ context }) => ({
          utterance: `Here is your clue: ${context.clues[context.currentClueIndex]}`
        }),
      },
      on: { SPEAK_COMPLETE: "GetAnswer" }
    },
    GetAnswer: {
      entry: "spst.listen",
      on: {
        RECOGNISED: {
          actions: assign(({ event }) => {
            const guess = extractEntity(event.nluValue?.entities, "guess")?.toLowerCase();
            return {
              answer: guess,
              intent: guess ? "guessedAnswer" : event.nluValue?.topIntent,
              transcript: event.value?.[0]?.utterance ?? ""
            };
          })
        },
        ASR_NOINPUT: {
          actions: assign({ answer: null })
        },
      }
    }
  },
  on: {
    LISTEN_COMPLETE: [
      {
        target: "#DM.CorrectAnswer",
        guard: ({ context }) =>
          context.answer?.toLowerCase() === context.currentItem?.name.toLowerCase() &&
          context.intent === "guessedAnswer",
      },
      {
        target: "#DM.IncorrectAnswer",
        guard: ({ context }) =>
          (context.intent === "guessedAnswer" &&
          context.answer?.toLowerCase() !== context.currentItem?.name.toLowerCase()) ||
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
            guard: ({ context }) => context.intent === "cancel" || context.intent === null
          },
          
        ],
      },
      states: {
        DelayBeforeSpeak: {
          after: {
            7000: "AskToRestart", 
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
                  1
                )} points. Your total score is ${context.score}. Would you like to play again? Please state the category and difficulty if different.`
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
                    const newCategory = extractEntity(event.nluValue?.entities, "category")?.toLowerCase();
                    const newDifficulty = extractEntity(event.nluValue?.entities, "difficulty")?.toLowerCase();
    
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
            ASR_NOINPUT:{
              actions:assign({intent:null})
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
        DelayBeforeNextClue: {
          after: {
            7000: [
              {
                target: "HandleLastClue",
                guard: ({ context }) => 
                  context.currentClueIndex >= context.clues.length - 1,
              },
              {
                target: "AskNextClue",
              }
            ]
          }
        },
        HandleLastClue: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: context.answer 
                ? `Incorrect! The correct answer was ${context.currentItem?.name}. Would you like to play again? Please state the category and difficulty if different.`
                : `You've reached the last clue. The correct answer was ${context.currentItem?.name}. Would you like to play again?  Please state the category and difficulty if different.`
            }),
          },
          on: { SPEAK_COMPLETE: "GetAnswer" },
        },
        AskNextClue: {
          entry: {
            type: "spst.speak",
            params: ({ context }: { context: DMContext }) => ({ 
              utterance: context.answer 
                ? "Incorrect answer. Would you like to continue with the next clue?"
                : "Inorrect answer. Would you like to continue with the next clue?"
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
                  const newCategory = extractEntity(event.nluValue?.entities, "category")?.toLowerCase();
                  const newDifficulty = extractEntity(event.nluValue?.entities, "difficulty")?.toLowerCase();
                  
                  return {
                    intent,
                    category: newCategory || context.category,
                    difficulty: newDifficulty || context.difficulty
                  };
                }
                
                return { intent };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ intent: null })
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