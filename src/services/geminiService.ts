import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function identifyFood(base64Image: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image,
              },
            },
            {
              text: "Identify the food in this image on a scale. Estimate the weight if possible and provide the approximate calories. Return ONLY a JSON object with the following structure: { \"foodName\": string, \"estimatedWeightGrams\": number, \"calories\": number, \"confidence\": number }",
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Error identifying food:", error);
    return null;
  }
}

export async function parseFoodText(text: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse this food entry: "${text}". Extract the food name, estimated weight in grams, and approximate calories. Return ONLY a JSON object: { "foodName": string, "estimatedWeightGrams": number, "calories": number }`,
      config: {
        responseMimeType: "application/json",
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Error parsing food text:", error);
    return null;
  }
}

export async function getHabitInsights(data: any) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on this user tracking data: ${JSON.stringify(data)}. Provide 3 short, actionable insights to help the user improve their habits (meditation, study, smoking, diet). Return as a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Error getting insights:", error);
    return [];
  }
}
