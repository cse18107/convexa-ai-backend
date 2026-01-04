const { ElevenLabsClient } = require("@elevenlabs/elevenlabs-js");
require('dotenv').config();

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

/**
 * Creates a batch call for a campaign
 * @param {Object} campaignData - The campaign details
 * @param {Array} recipients - List of recipients with phone numbers
 * @returns {Promise<Object>} The ElevenLabs response
 */
const createBatchCall = async (campaignData, recipients) => {
  try {
    const response = await client.conversationalAi.batchCalls.create({
      callName: campaignData.title,
      agentId: "agent_1601kdw1tj7ge0zbre6k9pjyr11s",
      scheduledTimeUnix: campaignData.scheduledTimeUnix,
      agentPhoneNumberId: "phnum_3701kdw278hee73bx6e3cj49qhxb", // Using the ID from your example or from request
      recipients: recipients.map(rec => ({
        id: rec.id, // This matches the recipient ID we store in Excel
        phoneNumber: rec.phoneNumber,
        conversationInitiationClientData: {
          conversationConfigOverride: {
            // turn: {
            //   softTimeoutConfig: {
            //     message: "Please hold on a moment while I process your response.",
            //   },
            // },
            // tts: {
            //   voiceId: "cjVigY5qzO86Huf0OWal",
            //   stability: 0.7,
            //   speed: 1,
            //   similarityBoost: 0.85,
            // },
            // conversation: {
            //   textOnly: false,
            // },
            agent: {
              firstMessage: `Hello ${rec.name}, thank you for taking the time to speak with us today!`,
              language: "en",
              prompt: {
                prompt: campaignData.generatedPrompt,
                llm: "gpt-4o-mini",
              },
            },
          },
          // User requested these specific fields in their example
          customLlmExtraBody: {
            "campaign_id": campaignData.id,
            "priority": "high",
          },
          userId: rec.id,
          sourceInfo: {
            source: "twilio",
            version: "1.4.2",
          },
          dynamicVariables: {
            "customer_name": rec.name,
          },
        },
      })),
    });
    return response;
  } catch (error) {
    console.error('ElevenLabs Batch Call Error:', error);
    throw error;
  }
};

module.exports = {
  createBatchCall,
};
