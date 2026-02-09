import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv'
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY });

export async function generateStudyPlan(topic) {
	try {
		const response = await ai.models.generateContent({
			model: `gemini-3-flash-preview`,
			contents: `Generate a study plan for ${topic} in numerical order`,
		});
		console.log(response.text);
	}
	catch (error) {
		console.error(error);
		return null;
	}
}
await generateStudyPlan('SYS-701');
