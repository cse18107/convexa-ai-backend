/**
 * Simple service to "generate" a prompt.
 * In a real app, this would call OpenAI or another LLM.
 * For now, it will augment the job description.
 */
const generatePrompt = async (jobDescription) => {
  // Mock AI generation logic
  return `You are a friendly assistant conducting an interview for the following position: ${jobDescription}. 
  Ask candidate about their experience, technical skills and interest in the role. 
  Keep the conversation professional and engaging.`;
};

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyzes a conversation transcript using OpenAI.
 * @param {string} jobDescription - The job description for context
 * @param {string} transcript - The conversation transcript
 * @returns {Promise<Object>} Analysis results
 */
const analyzeTranscript = async (jobDescription, transcript) => {
  try {
    const prompt = `
      You are an expert HR recruiter and technical interviewer. Analyze the following conversation transcript between an AI interviewer and a candidate for a job role.
      
      Job Description:
      ${jobDescription}
      
      Transcript:
      ${transcript}
      
      Task:
      1. Analyze candidate's performance metrics (0-100 score).
      2. Identify specific skills/fields mentioned, the self-rated score (out of 10) if mentioned, and years of experience.
      3. Provide an overall detailed analysis of the candidate's fit for the role.
      4. Provide an overall score (0-100) based on the analysis.
      
      Return the response STRICTLY as a JSON object with the following structure:
      {
        "performance_metrics": {
           "field_knowledge": <number percentage>,
           "attitude": <number percentage>,
           "voice_tone": <number percentage>,
           "willingness": <number percentage>
         },
         "field_experience": [
           {
             "field_name": "<string>",
             "score": <number>,
             "year_of_experience": "<string>"
           }
         ],
         "overall_analysis": "<string>",
         "overall_score": <number percentage>
      }
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a specialized AI recruitment analyst. You extract structured data from interview transcripts." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('OpenAI Analysis Error:', error);
    // Fallback structure in case of error
    return {
      performance_metrics: { field_knowledge: 0, attitude: 0, voice_tone: 0, willingness: 0 },
      field_experience: [],
      overall_analysis: "Error during analysis: " + error.message,
      overall_score: 0
    };
  }
};

module.exports = {
  generatePrompt,
  analyzeTranscript,
};
