# 🎙️ Trivaso - Voice-Based Trivia Game 🎮  

Trivaso is an interactive voice-controlled trivia game where players answer questions from different categories and difficulty levels. The game provides clues, listens for responses, and reacts dynamically based on the user’s answers.  

> **Important:** Minimal errors might occur if your answer is given as a *single word* due to NLU (Natural Language Understanding) limitations.

## 🚀 Features  
- 🎤 **Voice-controlled gameplay** - Speak your answers instead of typing.  
- 🌍 **Two categories:** *Languages* and *Countries*.  
- 🎚 **Three difficulty levels:** *Easy, Medium, Hard* (supports synonyms like "Beginner" for Easy and "Extreme" for Hard).  
- 🏆 **Dynamic scoring system** - Earn **10 points** if you guess from the **first clue**, **9 points** from the second, and so on.  
- ❌ **Game cancelation** - Exit at any time by saying phrases like *"Cancel the game."*  
- 🔄 **Replay options** - Continue with the same or different settings.  
- 🔎 **Correct answer reveal** - If the player reaches the **last clue** and **doesn’t answer or is incorrect**, the system **reveals the correct answer** and asks if they want to play again.  

---

## 📖 How to Play  
1️⃣ **Start the game** - Click "Start" on the splash screen.  
2️⃣ **Choose category & difficulty** - Select *Languages* or *Countries*, and a difficulty level.  
3️⃣ **Listen to clues** - The game plays an audio clue.  
4️⃣ **Answer aloud** - Speak your answer.  
   - ✅ **Correct?** 🎉 You score points and can choose to continue.  
   - ❌ **Wrong?** The game asks if you want to try again.  
   - ⏳ **No answer?** The game moves to the next clue.  
5️⃣ **Reaching the Last Clue:**  
   - If the **last clue is reached and no answer is given**, the correct answer is **revealed**.  
   - If the **last clue is reached and the answer is incorrect**, the correct answer is **revealed**.  
   - The system then **asks if you want to play again** (same or different settings).  
6️⃣ **Replay or exit** - After a correct answer or game over, decide if you want to continue playing.  

---

## 🎯 Scoring System  
| **Clue Number** | **Points Awarded** |  
|-----------------|--------------------|  
| 1st Clue       | 10 Points 🎯 |  
| 2nd Clue       | 9 Points  |  
| 3rd Clue       | 8 Points  |  
| 4th Clue       | 7 Points  |  
| 5th Clue       | 6 Points  |  
| 6th Clue       | 5 Points  |  
| 7th Clue       | 4 Points  |  
| 8th Clue       | 3 Points  |  
| 9th Clue       | 2 Points  |  
| 10th Clue      | 1 Point  |  

---

## 🎭 Voice Commands  
| **Command** | **Effect** |  
|------------|-----------|  
| `"Cancel the game"` | Ends the game immediately. |    
| `"Beginner" / "Extreme"` | Recognized as Easy / Hard difficulty. |  
| `"Yes, same settings"` | Starts a new round with the same category & difficulty. |  
| `"No"` | Cancels replay. |  

---

## 🛠️ Technologies Used  
- 🎭 **XState** - Manages game state.  
- 🟦 **TypeScript** - Strongly typed JavaScript.  
- 🎨 **HTML & CSS** - Game interface.  
- 🎙️ **Web Speech API** - Voice recognition.  

---
## 📂 Project Structure  

```

Code
├── index.html         # The game’s main HTML structure
└── src
    ├── game3.ts       # The main state machine managing game logic
    ├── helpers.ts     # Utility functions used in the game logic
    ├── splash.ts      # Handles the splash screen animations and interactions
    ├── types.ts       # Defines TypeScript types used in the project
    └── style.css      # The main styling file for the UI



