import { GoogleGenAI } from "@google/genai";
import { Client } from "pg";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
const client = new Client({
  connectionString: import.meta.env.VITE_DATABASE_URL,
});

// TODO: MAKE prompt more precise, specify structure in order to store in database.
export async function generateStudyPlan(topic) {
  const STUDY_PLAN_PROMPT = `You are an expert curriculum designer for software developers. Generate a comprehensive study plan based on the user's topic. Return your response as a JSON object with the following EXACT structure:
	{
		"title": "string",
		"sections" :
		{
			"section_title": "string",
		}],
	}
		User Topic: ${topic}`;
  try {
    const response = await ai.models.generateContent({
      model: `gemini-3-flash-preview`,
      contents: `${STUDY_PLAN_PROMPT}`,
    });
    console.log(response.text);
  } catch (error) {
    console.error(error);
    return null;
  } finally {
  }
}

export async function generateTriviaQuestion(topic, section) {
  try {
    // TODO: add date to question generation
    const TRIVIA_QUESTION_PROMPT = `You are an expert curriculum designer for software developers. Generate a trivia question based on the user's topic and section. Return your object as a JSON object with the following EXACT structure:
		{
			"question": "string",
			"answer": "string",
		}
			User Topic: ${topic},
			Topic Section: ${section}`;
    const response = await ai.models.generateContent({
      model: `gemini-3-flash-preview`,
      contents: `Generate ${limit} ${type} style questions for ${section}.`,
    });
    console.log(response.text);
  } catch (error) {
    console.error(error);
  }
}

// TODO: Create a function that creates a user with password encryption
// TODO: Create email validation function
// TODO: Create password validation function
// TODO: Create user authentication
