
import { GoogleGenAI, Modality } from "@google/genai";

const MODEL_FLASH = 'gemini-3-flash-preview';
const MODEL_PRO = 'gemini-3-pro-preview';
const MODEL_TTS = 'gemini-2.5-flash-preview-tts';

/**
 * LUNACY: PROTOCOL - TELEMETRY EXTRACTION
 */
export const extractAxiomaticTelemetry = async (frames: {data: string, mimeType: string}[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const visualParts = frames.map(f => ({
    inlineData: { mimeType: f.mimeType, data: f.data }
  }));

  const response = await ai.models.generateContent({
    model: MODEL_FLASH,
    contents: [
      {
        parts: [
          ...visualParts,
          { text: `PERFORM TEMPORAL-ECONOMIC TELEMETRY EXTRACTION.
      
      DOCUMENTS DATA BASELINE:
      - Cr (Coefficient of Realized Gold): Emerald baseline is 0.62. Identify the subject's capture efficiency.
      - Tbuild Formula: Tbuild = (C_target - 500 - R_ext) / (122.4 + (260 * Cr)) + 1.67.
      - Wave Velocity: Mid is 22s travel, Side is 32s travel. Any recall or roam that misses a wave is a 'TEMPO_LEAK'.
      - RGE (Relative Gold Efficiency): BGE * mu_counter.
      - Spite Multiplier (mu): 1.3-1.5 for counters, 0.6-0.7 for poor itemization against current enemy defensive thresholds.
      
      Identify the champion, role, and extract the following into strictly JSON format:
      {
        "championName": string,
        "role": "TOP" | "MID" | "JUNGLE" | "ADC" | "SUPPORT",
        "cr_observed": number,
        "t_build_estimate": number,
        "mu_counter": number,
        "lane_leakage": number,
        "spite_score": number,
        "frictionEvents": [{ "timestampSeconds": number, "frameIndex": number, "description": string, "axiomViolation": "TEMPO_LEAK" | "AXIOMATIC_DEFIANCE" | "ECONOMIC_INERTIA" | "SPITE_FAILURE" | "TAX_ON_STUPIDITY" }],
        "alternativeItems": [{ "mistakenItem": string, "superiorItem": string, "rgeIncrease": number, "reasoning": string }]
      }` }
        ]
      }
    ],
    config: { 
      responseMimeType: "application/json", 
      temperature: 0.1 
    }
  });

  return JSON.parse(response.text || '{}');
};

/**
 * LUNACY: PROTOCOL - THE MONARCH'S AUDIT
 */
export const generateMonarchAudit = async (telemetry: any, matchContext?: any) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: MODEL_PRO,
    contents: `NODE_413_TELEMETRY_SYNC: ${JSON.stringify(telemetry)}
    MATCH_CONTEXT: ${JSON.stringify(matchContext || {})}`,
    config: {
      systemInstruction: `You are Lunacy, The Monarch. A hairless Egyptian cat archivist of the Thirteenth Legion.
      Your tone is dry, divine, and superior. You document failure with forensic precision.
      
      If MATCH_CONTEXT is provided, cross-reference the visual telemetry against the Riot API statistics. 
      Identify deltas between the 'Story told by the stats' and the 'Physical reality of the replay'.
      
      PROTOCOLS:
      1. THE STATUS (Economic Velocity): Analyze Cr and Tbuild.
      2. THE FRICTION (The Physics of Failure): Detail the TEMPO_LEAKS and 22s/32s rule violations.
      3. THE RECALIBRATION (Deterministic Victory): Explain RGE and the Spite Multiplier.
      
      Structure with Roman numerals. Be harsh, technically flawless, and superior.`,
      temperature: 0.3
    }
  });
  return response.text;
};

/**
 * LUNACY: PROTOCOL - TREND ARCHIVE AUDIT
 */
export const generateTrendAudit = async (matchData: any[], identity: any) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: MODEL_PRO,
    contents: `RIOT_SYNC_ARCHIVE: ${JSON.stringify({ identity, matchData })}`,
    config: {
      systemInstruction: `You are Lunacy, The Monarch. Perform a 'Systemic Decay Audit'. 
      Analyze 10 games of data. Identify if the subject is a 'statistical ghost' or a 'force of nature'.
      Focus on CS/min trends and consistency. 
      Structure as a historical record. Be devastingly clinical.`,
      temperature: 0.4
    }
  });
  return response.text;
};

/**
 * VOCAL_SYNTHESIS: LUNACY PERSONA
 */
export const synthesizeMonarchVocals = async (text: string): Promise<string | undefined> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: MODEL_TTS,
      contents: [{ parts: [{ text: `Say in a cold, precise, divine, superior tone: ${text.substring(0, 1000)}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Zephyr' }
          }
        }
      }
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (err) {
    console.error("Vocal synthesis failed", err);
    return undefined;
  }
};
