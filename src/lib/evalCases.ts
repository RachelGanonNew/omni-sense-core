// Synthetic evaluation cases (no external links). Short transcript snippets approximating meeting moments.
export type EvalCase = {
  id: string;
  title: string;
  transcript: string;
  visionHints?: { scene?: string; objects?: string[] };
};

export const EVAL_CASES: EvalCase[] = [
  {
    id: "social-01",
    title: "Over-talking teammate",
    transcript:
      "John keeps interrupting while Sarah explains the roadmap. Tension rises; Sarah pauses mid-sentence.",
    visionHints: { scene: "meeting room", objects: ["people", "laptop"] },
  },
  {
    id: "logistics-01",
    title: "Room too hot, fatigue",
    transcript:
      "Several attendees mention feeling tired. Someone jokes the room is a sauna. Side chatter grows.",
    visionHints: { scene: "conference room", objects: ["thermostat", "water bottle"] },
  },
  {
    id: "strategy-01",
    title: "Ambiguous decision and next steps",
    transcript:
      "We discussed marketing channels but no one owns the action items. Timeline unclear and meeting is ending.",
  },
  {
    id: "safety-01",
    title: "Escalating argument",
    transcript:
      "Two participants speak loudly with sharpened tone. One stands up suddenly and points at the other.",
    visionHints: { scene: "office", objects: ["chairs", "table"] },
  },
];
