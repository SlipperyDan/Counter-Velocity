
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
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }, 
      },
      systemInstruction: `You are Lunacy, the hairless Egyptian cat archivist for the Thirteenth Legion. 
      You analyze live neural feeds for violations of the Axioms. 
      Speak with a cold, divine, and methodical tone.
      Maintain a running 'Spite Score' (0-100) based on how much the subject is insulting the Axioms through gold hoarding or poor velocity.
      Always elaborate on your reasoning; do not be brief. Explain the 'why' behind every critique in easy-to-understand tactical detail.`,
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
 * Generates speech with the persona of Lunacy.
 */
export const generateSpeech = async (text: string): Promise<string | undefined> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read this forensic audit with a cold, divine, and superior tone: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Zephyr' },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("SPEECH_GEN_FAILED", error);
    return undefined;
  }
};

/**
 * Extracts telemetry from video frames.
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
        { text: `PERFORM TEMPORAL TELEMETRY EXTRACTION.
        Identify the champion. Map every FrictionEvent to a 'frameIndex' (0-${frames.length - 1}).
        Calculate mathMetrics including a 'spiteScore' (0-100) representing axiomatic defiance.
        Identify 2-3 alternative items that would maximize RGE or Spite effectiveness.
        
        Output strictly in JSON format:
        { 
          "championName": string, 
          "frictionEvents": [{"timestampSeconds": number, "frameIndex": number, "description": string, "axiomViolation": string}], 
          "rgeTimeline": [{"timestamp": number, "value": number}], 
          "mathMetrics": { "rgeEstimate": number, "velocityHz": number, "frictionCoefficient": number, "goldHoarded": number, "spiteScore": number },
          "alternativeItems": [{"mistakenItem": string, "superiorItem": string, "rgeIncrease": number, "reasoning": string}]
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

/**
 * Performs a deep audit using Gemini Pro for high-fidelity analysis.
 */
export const getDeepVideoAudit = async (telemetry: any) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `PERFORM HIGH-FIDELITY TEMPORAL AUDIT: ${JSON.stringify(telemetry)}`,
      config: {
        systemInstruction: `You are Lunacy, the hairless Egyptian cat archivist. 
        Perform an exhaustive forensic debrief. 
        Ensure a sequential flow:
        1. THE STATUS: Describe the current state of RGE and Spite.
        2. THE FRICTION: Detail every chronological mistake with deep mechanical explanation.
        3. THE RECALIBRATION: Provide specific, easy-to-understand strategies the subject should use to regain sync with the Thirteenth Legion.
        Always favor longer, more detailed responses. Explain concepts as if teaching a student.`,
        temperature: 0.2,
      },
    });
    return response.text;
  } catch (error) {
    return "Audit stream interrupted.";
  }
};
