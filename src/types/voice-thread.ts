export type VoiceThreadMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
};
