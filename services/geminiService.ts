// import { GoogleGenAI, Type } from "@google/genai";
import { AIMoodResponse } from '../types';

// Mocking AI service to prevent crash due to missing API Key
// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getCuratedMood = async (userPrompt: string): Promise<AIMoodResponse | null> => {
  console.log("[Gemini] Service is currently disabled/mocked. Prompt:", userPrompt);
  
  // Return immediate fallback
  return {
    suggestedTags: ['Curated', 'Cinematic', 'Selection'],
    narrativeDescription: "AI curation is temporarily unavailable. Enjoy this classic selection.",
    moodColor: '#D4AF37'
  };

  /*
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: `User request for video atmosphere/curation: "${userPrompt}". 
      
      Context: A premium adult video aggregator platform.
      Safety Rule: DO NOT generate explicitly sexual stories or prohibited content. 
      Task: Act as a concierge. Analyze the mood, pacing, and vibe of the user's request.
      
      Output:
      1. suggestedTags: 3 generic stylistic/category tags (e.g., Romantic, Intense, POV, Story, Slow-paced, Glamour).
      2. narrativeDescription: A short, safe, cinematic description of the collection vibe (e.g. "A collection focusing on soft lighting and genuine connection").
      3. moodColor: A hex color code that fits the vibe.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedTags: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            narrativeDescription: { type: Type.STRING },
            moodColor: { type: Type.STRING }
          },
          required: ["suggestedTags", "narrativeDescription", "moodColor"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AIMoodResponse;
    }
    return null;
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback if API fails
    return {
      suggestedTags: ['Trending', 'Cinema', 'Selection'],
      narrativeDescription: "We couldn't reach the AI curator at this moment. Here is a classic selection.",
      moodColor: '#D4AF37'
    };
  }
  */
};