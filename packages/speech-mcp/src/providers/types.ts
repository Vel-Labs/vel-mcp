export interface VoiceInfo {
  id: string;
  name: string;
  language?: string;
  local: boolean;
}
export interface SpeechProvider {
  id: string;
  listVoices(): Promise<VoiceInfo[]>;
  synthesize(input: { text: string; voice?: string; format: string; speed?: number }): Promise<{ artifactId: string; mimeType: string; durationMs?: number }>;
}
