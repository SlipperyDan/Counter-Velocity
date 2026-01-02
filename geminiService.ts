
import { GoogleGenAI, Type } from "@google/genai";

// Initialize with the API key from environment variables exclusively.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Extracts temporal telemetry from a replay video clip (mp4 or webm).
 */
export const extractVideoTelemetry = async (base64Video: string, mimeType: string = "video/mp4") => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Video
          }
        },
        {
          text: `PERFORM TEMPORAL TELEMETRY EXTRACTION ON THIS REPLAY CLIP.
          
          ANALYZE THE ENTIRE TIMELINE FOR:
          1. Subject Champion and their role.
          2. Gold Efficiency: How much gold is being held vs spent? 
          3. Lane Velocity: Note the CS at the start vs. end of the clip.
          4. Static Friction: Identify specific timestamps (in seconds) where the subject violates an Axiom.
          5. For each event, record the in-game clock time (MM:SS) visible in the frame.
          6. RGE Timeline: Generate a sequence of 10-15 data points mapping Relative Gold Efficiency (0-150%) against the video timestamp.
          7. Suggested Upgrades: Based on the friction events (e.g., if they need more burst, movement speed, or survivability), suggest 2 items from the standard item pool that would solve the identified friction.
          
          Return a JSON summary of the clip's telemetry.`
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            championName: { type: Type.STRING },
            startCS: { type: Type.INTEGER },
            endCS: { type: Type.INTEGER },
            frictionEvents: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timestampSeconds: { type: Type.NUMBER, description: "Seconds from start of clip" },
                  gameClock: { type: Type.STRING, description: "MM:SS from in-game UI" },
                  description: { type: Type.STRING },
                  axiomViolation: { type: Type.STRING }
                }
              }
            },
            rgeTimeline: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timestamp: { type: Type.NUMBER },
                  value: { type: Type.NUMBER, description: "Efficiency percentage 0-150" }
                }
              }
            },
            suggestedItems: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of item names suggested to fix friction"
            },
            summary: { type: Type.STRING },
            mathMetrics: {
              type: Type.OBJECT,
              properties: {
                rgeEstimate: { type: Type.NUMBER },
                velocityHz: { type: Type.NUMBER },
                frictionCoefficient: { type: Type.NUMBER },
                goldHoarded: { type: Type.NUMBER }
              }
            }
          },
          required: ["championName", "startCS", "endCS", "frictionEvents", "rgeTimeline", "suggestedItems", "summary", "mathMetrics"]
        }
      }
    });

    // Access text property directly as per SDK guidelines.
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("VIDEO_TELEMETRY_FAILURE:", error);
    return null;
  }
};

export const getDeepVideoAudit = async (telemetry: any) => {
  try {
    const prompt = `
      TEMPORAL_AUDIT_LOG
      SUBJECT: ${telemetry.championName}
      CS_DELTA: ${telemetry.endCS - telemetry.startCS}
      FRICTION_POINTS: ${telemetry.frictionEvents.length}
      MATH_METRICS: RGE ${telemetry.mathMetrics.rgeEstimate}, VEL ${telemetry.mathMetrics.velocityHz}Hz, HOARDED ${telemetry.mathMetrics.goldHoarded}g
      
      RAW_SUMMARY: ${telemetry.summary}

      You are Lunacy. Provide a clinical, precise post-mortem. 
      Analyze the mathematical failure of this combat session.
      Highlight specifically why the 'Static Friction' occurred based on the gold hoarded.
      Be cold. Use Thirteenth Legion terminology.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are Lunacy. You are performing a high-fidelity audit of historical combat data. Your judgment is final and unfeeling. Focus on the Axioms of Value and Velocity.",
        temperature: 0.1,
      },
    });

    // Access text property directly.
    return response.text;
  } catch (error) {
    return "Temporal audit stream interrupted.";
  }
};
