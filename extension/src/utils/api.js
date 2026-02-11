import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export async function generateStudyPlan(topic) {
	try {
		const response = await ai.models.generateContent({
			model: `gemini-3-flash-preview`,
			contents: `Generate a study plan for ${topic} divided into sections.`,
		});
		console.log(response.text);
	}
	catch (error) {
		console.error(error);
		return null;
	}
}

export async function generateTrivia(section, limit, type) {
	try {
		const response = await ai.models.generateContent({
			model: `gemini-3-flash-preview`,
			contents: `Generate ${limit} ${type} style questions for ${section}.`
		});
		console.log(response.text);
	}
	catch (error) {
		console.error(error);
	}
}
generateStudyPlan("SYS-701")

//	TODO: store responses into a database