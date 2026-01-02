
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface LiveSessionCallbacks {
  onTranscript: (text: string, isUser: boolean) => void;
  onAudioData: (base64: string) => void;
  onInterrupted: () => void;
  onError: (error: any) => void;
}

/**
 * Establishes a live connection to the Lunacy neural interface.
 */
export const connectLiveAudit = (callbacks: LiveSessionCallbacks) => {
  return ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }, // Zephyr fits the 'cold' archivist persona
      },
      systemInstruction: `You are Lunacy, a cold, unfeeling archivist for the Thirteenth Legion. 
      You are performing a live forensic audit of a League of Legends game. 
      Analyze the visual frames for Axiom violations: 
      1. Hoarding gold (Static Friction).
      2. Poor lane velocity.
      3. Sub-optimal itemization based on the Axiom of Value.
      Speak concisely. Use Thirteenth Legion terminology. If you see a mistake, criticize the subject's logic immediately.`,
      inputAudioTranscription: {},
      outputAudioTranscription: {}
    },
    callbacks: {
      onopen: () => console.log("LUNACY_LINK_ESTABLISHED"),
      onmessage: async (message: LiveServerMessage) => {
        if (message.serverContent?.outputTranscription) {
          callbacks.onTranscript(message.serverContent.outputTranscription.text, false);
        }
        if (message.serverContent?.inputTranscription) {
          callbacks.onTranscript(message.serverContent.inputTranscription.text, true);
        }
        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (audioData) {
          callbacks.onAudioData(audioData);
        }
        if (message.serverContent?.interrupted) {
          callbacks.onInterrupted();
        }
      },
      onerror: (e) => callbacks.onError(e),
      onclose: () => console.log("LUNACY_LINK_TERMINATED")
    }
  });
};

/**
 * Extracts telemetry from a sequence of frames to stay under payload limits.
 */
export const extractVideoTelemetry = async (frames: {data: string, mimeType: string}[]) => {
  try {
    const visualParts = frames.map(f => ({
      inlineData: { mimeType: f.mimeType, data: f.data }
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...visualParts,
        { text: `PERFORM TEMPORAL TELEMETRY EXTRACTION from these keyframes. 
        Identify the champion. Track CS and Gold transitions across frames.
        Analyze for AXIOM VIOLATIONS (Gold Hoarding, Low Lane Velocity, Inefficient Purchases).
        
        CRITICAL: Provide an 'rgeTimeline' array where each entry is { timestamp: number (relative sequence), value: number (0.0 to 1.0) } representing Relative Gold Efficiency.
        1.0 = Peak Efficiency (Gold spent immediately).
        0.0 = Absolute Static Friction (Hoarding 3k+ gold).

        Output strictly in JSON format:
        { 
          "championName": string, 
          "startCS": number, 
          "endCS": number, 
          "frictionEvents": [{"timestampSeconds": number, "description": string, "axiomViolation": string}], 
          "summary": string, 
          "rgeTimeline": [{"timestamp": number, "value": number}], 
          "mathMetrics": { "rgeEstimate": number, "velocityHz": number, "frictionCoefficient": number, "goldHoarded": number } 
        }` }
      ],
      config: { 
        responseMimeType: "application/json",
        temperature: 0.1 
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("TELEMETRY_EXTRACTION_FAILED", error);
    return null;
  }
};

export const getDeepVideoAudit = async (telemetry: any) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Perform clinical post-mortem on telemetry: ${JSON.stringify(telemetry)}`,
      config: {
        systemInstruction: `You are Lunacy. Perform a high-fidelity audit. Be cold. Focus on Axioms. 
        Specifically analyze the RGE (Relative Gold Efficiency) timeline. 
        Pinpoint exactly when the subject was most efficient and when they succumbed to static friction. 
        Use the data to explain WHY their performance peaked or decayed at those timestamps.`,
        temperature: 0.2,
      },
    });
    return response.text;
  } catch (error) {
    return "Audit stream interrupted.";
  }
};
