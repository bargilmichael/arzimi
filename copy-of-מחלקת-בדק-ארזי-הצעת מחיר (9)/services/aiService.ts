
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const translateToHebrew = async (text: string, fromLang: 'ru' | 'ar'): Promise<string> => {
  if (!text.trim()) return '';
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Translate the following ${fromLang === 'ru' ? 'Russian' : 'Arabic'} text to Hebrew: "${text}". Return only the translated text.`,
    });
    
    return response.text?.trim() || text;
  } catch (error) {
    console.error("Translation error:", error);
    return text; // Fallback to original text
  }
};
