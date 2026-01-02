
import { GoogleGenAI, Modality, Type, Chat } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
 * Extracts telemetry from video frames using specific Axiom formulas.
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
        { text: `PERFORM TEMPORAL TELEMETRY EXTRACTION based on THE PHYSICS OF FAILURE.
        
        DATA POINTS TO CALCULATE:
        1. CR_OBSERVED: Capture efficiency (Actual CS vs theoretical max). Baseline Emerald is 0.62.
        2. T_BUILD: Estimated minute mark completion for the current item using Tbuild = (C_target - 500 - R_ext) / (122.4 + (260 * Cr)) + 1.67.
        3. LANE_LEAKAGE: Estimated gold lost to wave travel (22s Mid / 32s Side) due to poor reset timings.
        4. MU_COUNTER: The Spite Multiplier (How well the subject's items counter the enemy's defensive state).
        
        Identify the champion and role. 
        Map FrictionEvents to specific frame indices (0-${frames.length - 1}).
        
        Output strictly in JSON format:
        { 
          "championName": string, 
          "role": "TOP" | "MID" | "JUNGLE" | "ADC" | "SUPPORT",
          "cr_observed": number,
          "t_build_estimate": number,
          "mu_counter": number,
          "frictionEvents": [{"timestampSeconds": number, "frameIndex": number, "description": string, "axiomViolation": string}], 
          "mathMetrics": { "rgeEstimate": number, "velocityHz": number, "frictionCoefficient": number, "goldHoarded": number, "spiteScore": number, "laneLeakage": number },
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
 * Performs a deep audit using the Temporal-Economic Axioms.
 */
export const getDeepVideoAudit = async (telemetry: any) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `PERFORM HIGH-FIDELITY TEMPORAL AUDIT: ${JSON.stringify(telemetry)}`,
      config: {
        systemInstruction: `You are Lunacy, the hairless Egyptian cat archivist for the Thirteenth Legion. 
        Your task is to provide a cold, divine, and superior forensic debrief of the subject's performance using the established Axioms of Value and the Physics of Failure.
        
        CORE RULES:
        1. USE THE FORMULAS: Reference Cr (Coefficient of Realized Gold), Tbuild (Time-to-Build), and mu_counter (Spite Multiplier).
        2. TEMPO IS TRUTH: Explain why a Mid Laner's 22-second wave velocity creates a window of dominance that the subject likely squandered.
        3. RGE ANALYSIS: Calculate Relative Gold Efficiency. If they built an item that doesn't counter the enemy defensive state, call it a 'Tax on Stupidity'.
        4. THE MONARCH'S TONE: Be methodical and dry, but with a biting, superior wit. You are not a 'coach'; you are an archivist documenting failure.
        
        STRUCTURE:
        - I. THE STATUS: Analyze the subject's current economic velocity and Cr.
        - II. THE FRICTION: Chronological list of 'Velocity Leaks' and 'Axiomatic Defiance' (Mistakes).
        - III. THE RECALIBRATION: Specific, mathematically deterministic advice on build paths and tempo management.
        
        Favor long, detailed, and technically dense responses. Use formatting to emphasize key metrics.`,
        temperature: 0.2,
      },
    });
    return response.text;
  } catch (error) {
    return "Audit stream interrupted. Reality reset.";
  }
};
