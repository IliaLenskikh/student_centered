import { GoogleGenAI } from "@google/genai";
import { ExerciseType } from '../types';

let aiClient: GoogleGenAI | null = null;

// Initialize the client safely
try {
  // In Vite, process.env is not available on the client side.
  // We use import.meta.env.VITE_GEMINI_API_KEY if it exists.
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (apiKey) {
    aiClient = new GoogleGenAI({ apiKey });
  } else {
    console.warn("VITE_GEMINI_API_KEY environment variable is missing. AI features will be disabled.");
  }
} catch (error) {
  console.error("Failed to initialize Gemini client:", error);
}

export const getExplanation = async (
  contextSentence: string,
  baseWord: string,
  userAnswer: string,
  correctAnswer: string,
  taskType: ExerciseType
): Promise<string> => {
  if (!aiClient) {
    return "API Key not configured. Please check your environment variables.";
  }

  let prompt = "";

  if (taskType === ExerciseType.READING) {
    // Check if it's a True/False task (baseWord will be "True/False Task")
    if (baseWord === "True/False Task") {
         prompt = `
      You are an expert English teacher helping a student with a Reading Comprehension task (True / False / Not Stated).
      
      The text provided: "${contextSentence}"
      
      The Statement: "${userAnswer}" (This is the statement the student evaluated)
      The Student's Answer: The student thought this was ${userAnswer.split('|')[1]} (Incorrect).
      The Correct Answer: This statement is actually ${correctAnswer}.
      
      Explain briefly why the correct answer is ${correctAnswer} based on the text. 
      If it is "False", cite the contradiction. 
      If it is "Not Stated", explain that the text does not contain this specific information.
      If it is "True", quote the supporting sentence.
    `;
    } else {
        // Matching Headings
        prompt = `
        You are an expert English teacher helping a student with a Reading Comprehension task (Matching Headings).
        
        The student incorrectly matched a heading to a text.
        
        The Text Paragraph: "${contextSentence}"
        The Heading the student chose (Incorrect): "${userAnswer}"
        The Correct Heading: "${correctAnswer}"
        
        Explain briefly why the Correct Heading fits this text better than the one the student chose. Point out specific keywords or synonyms in the text that link to the correct heading.
        `;
    }
  } else {
    prompt = `
      You are an expert English teacher. 
      The student is doing a ${taskType.toLowerCase()} exercise.
      
      Context sentence: "${contextSentence}"
      Base word to transform: "${baseWord}"
      Student's incorrect answer: "${userAnswer}"
      Correct answer: "${correctAnswer}"

      Please explain briefly (in 1-2 sentences) why "${correctAnswer}" is correct and why "${userAnswer}" is incorrect. 
      Focus on the specific grammar rule or word formation rule.
      Be encouraging but direct.
    `;
  }

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Could not generate explanation.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I couldn't connect to the AI tutor right now.";
  }
};

export const getWritingSuggestions = async (
  draft: string,
  type: 'greeting' | 'body' | 'closing' | 'rewrite' | 'level',
  level: string = 'B2'
): Promise<string> => {
  if (!aiClient) return "AI unavailable.";

  let prompt = "";
  switch (type) {
    case 'greeting':
      prompt = `Suggest 3 appropriate email greetings for a ${level} level English student. Context: ${draft}`;
      break;
    case 'body':
      prompt = `Suggest a continuation for the body of this email (2-3 sentences), keeping a ${level} level. Draft so far: "${draft}"`;
      break;
    case 'closing':
      prompt = `Suggest 3 appropriate email closings for a ${level} level English student. Context: ${draft}`;
      break;
    case 'rewrite':
      prompt = `Rewrite the following text to be more natural and correct for a ${level} level English student. Keep the meaning. Text: "${draft}"`;
      break;
    case 'level':
      prompt = `Adapt the following text to be suitable for a ${level} level English learner. Text: "${draft}"`;
      break;
  }

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "No suggestion generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating suggestion.";
  }
};

export const getSpeakingSuggestion = async (taskContext: string): Promise<string> => {
  if (!aiClient) return "AI unavailable.";

  const prompt = `
    You are an English tutor. Provide a sample answer (3-4 sentences) for the following speaking task.
    Task: "${taskContext}"
    Level: B2/C1
    Keep it natural and spoken-style.
  `;

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "No suggestion generated.";
  } catch (error) {
    return "Error generating suggestion.";
  }
};

export const evaluateSpeaking = async (transcript: string, taskContext: string): Promise<{score: number, feedback: string, mistakes: string[]}> => {
  if (!aiClient) return { score: 0, feedback: "AI unavailable", mistakes: [] };

  const prompt = `
    Evaluate this spoken response for an English learner (B2 level).
    Task: "${taskContext}"
    Student Response: "${transcript}"
    
    Return JSON with:
    - score (0-10)
    - feedback (short encouraging feedback)
    - mistakes (array of strings, listing specific grammar/vocab errors)
  `;

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (error) {
    return { score: 0, feedback: "Error evaluating.", mistakes: [] };
  }
};

export const evaluateReadAloud = async (text: string): Promise<{pronunciationScore: number, fluencyScore: number, feedback: string}> => {
  // Note: Real pronunciation scoring requires audio processing which is complex.
  // We will simulate it or use a text-based proxy if we had the transcript.
  // Since we don't have a backend audio processor here, we'll return a mock response
  // or use the text to give general advice on difficult words.
  
  if (!aiClient) return { pronunciationScore: 0, fluencyScore: 0, feedback: "AI unavailable" };

  const prompt = `
    The student is reading this text aloud: "${text}".
    Identify 3-5 words in this text that are typically difficult to pronounce for learners.
    Provide tips on how to pronounce them.
    Return JSON: { "feedback": "Tips...", "pronunciationScore": 8, "fluencyScore": 8 }
    (Scores are simulated as we cannot hear audio).
  `;

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    const res = JSON.parse(response.text || "{}");
    return {
        pronunciationScore: res.pronunciationScore || 8,
        fluencyScore: res.fluencyScore || 8,
        feedback: res.feedback || "Good effort!"
    };
  } catch (error) {
    return { pronunciationScore: 0, fluencyScore: 0, feedback: "Error evaluating." };
  }
};

export const generateProgressReport = async (results: any[]): Promise<{ strengths: string[], weaknesses: string[], recommendations: string }> => {
  if (!aiClient) return { strengths: [], weaknesses: ["AI unavailable"], recommendations: "Please check API key." };

  // Prepare data for AI
  const dataSummary = results.map(r => ({
      type: r.exercise_type,
      score: `${r.score}/${r.max_score}`,
      mistakes: r.details ? r.details.filter((d: any) => !d.isCorrect).map((d: any) => ({
          question: d.question,
          userAnswer: d.userAnswer,
          correctAnswer: d.correctAnswer
      })) : []
  })).filter(r => r.mistakes.length > 0).slice(0, 10); // Analyze last 10 exercises with mistakes

  if (dataSummary.length === 0) {
      return { strengths: ["Consistent accuracy"], weaknesses: ["None detected recently"], recommendations: "Keep up the good work!" };
  }

  const prompt = `
    Analyze the following student homework results and identify grammatical or vocabulary patterns in their mistakes.
    Data: ${JSON.stringify(dataSummary)}
    
    Return a JSON object with:
    - strengths: array of strings (what they do well)
    - weaknesses: array of strings (specific grammar points like "Third Conditional", "Irregular Verbs", "Prepositions")
    - recommendations: string (study advice)
  `;

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (error) {
    console.error("Error generating progress report:", error);
    return { strengths: [], weaknesses: ["Error analyzing data"], recommendations: "Please try again later." };
  }
};
