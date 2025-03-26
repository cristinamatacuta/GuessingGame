import { Hypothesis, SpeechStateExternalEvent } from "speechstate";
import { AnyActorRef } from "xstate";

export interface DMContext {
  spstRef: AnyActorRef;
  category: string | null,
  difficulty: string | null,
  intent: string | null;
  currentItem: any;
  currentClueIndex: number;
  clues: string[];
  score: number;
  answer: string |null;
  transcript: string|null;
  previousScore: number | null

}

export type DMEvents =
  | SpeechStateExternalEvent
  | { type: "CLICK" }
  | { type: "ASRTTS_READY" }
  | { type: "SPEAK_COMPLETE" }
  | { type: "RECOGNISED"; value: Hypothesis[]; nluValue?: any }
  | { type: "ASR_NOINPUT" }
  | { type: "LISTEN_COMPLETE" };

