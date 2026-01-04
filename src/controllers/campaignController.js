const { Campaign, User } = require('../models');
const { v4: uuidv4 } = require('uuid');
const excelService = require('../services/excelService');
const elevenlabsService = require('../services/elevenlabsService');
const aiService = require('../services/aiService');
const cloudinaryService = require('../services/cloudinaryService');
const axios = require('axios');

exports.createCampaign = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      candidates, 
      phone_number_id, 
      scheduled_date, // e.g., "2026-01-01"
      scheduled_time  // e.g., "19:00"
    } = req.body;
    const creator_id = req.user.id;

    if (!title || !description || !candidates || !Array.isArray(candidates)) {
      return res.status(400).json({ error: 'Missing required fields or invalid candidates list' });
    }

    // 1. Calculate scheduled_time_unix from date and time strings
    let scheduledTimeUnix = null;
    if (scheduled_date && scheduled_time) {
      const dateTimeStr = `${scheduled_date}T${scheduled_time}:00`;
      const dateObj = new Date(dateTimeStr);
      if (!isNaN(dateObj.getTime())) {
        scheduledTimeUnix = Math.floor(dateObj.getTime() / 1000);
      }
    }

    // 2. Prepare candidates with UUIDs
    const candidatesWithIds = candidates.map(c => ({
      ...c,
      id: uuidv4(),
    }));

    // 3. Generate prompt
    const generatedPrompt = await aiService.generatePrompt(description);

    // 4. Create Excel Buffer & Upload to Cloudinary
    const campaignId = uuidv4();
    const excelBuffer = excelService.generateCampaignAnalysisBuffer(candidatesWithIds);
    const fileName = `campaign_${campaignId}_analysis.xlsx`;
    const cloudinaryUrl = await cloudinaryService.uploadXlsxToCloudinary(excelBuffer, fileName);

    // 5. Create Batch Call in ElevenLabs
    const campaignData = { 
      title, 
      description, 
      generatedPrompt, 
      // phoneNumberId: phone_number_id, 
      id: campaignId,
      scheduledTimeUnix: scheduledTimeUnix 
    };
    const batchCallResponse = await elevenlabsService.createBatchCall(campaignData, candidatesWithIds);

    // 5. Save to Database
    const campaign = await Campaign.create({
      id: campaignId,
      creator_id,
      title,
      description,
      status: 'scheduled',
      analysis_file_path: cloudinaryUrl,
      batch_call_id: batchCallResponse.id,
    });

    res.status(201).json({
      message: 'Campaign created successfully',
      campaign,
      elevenLabsResponse: batchCallResponse
    });

  } catch (error) {
    console.error('Create Campaign Error:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};


exports.handleElevenLabsWebhook = async (req, res) => {
  try {
    const payload = req.body;
    console.log('Received ElevenLabs Webhook:', JSON.stringify(payload, null, 2));

    // ElevenLabs sends the data in different formats depending on the event
    // We are looking for the 'call_ended' or similar event that contains analysis
    // Usually it includes the recipient_id we provided and our custom metadata
    
    const { data, metadata } = payload;
    if (!data) return res.status(200).json({ status: 'ignored' });

    // Format transcript to only include role and message
    let transcript = '';
    if (Array.isArray(data.transcript)) {
      transcript = data.transcript
        .map(entry => `${entry.role}: ${entry.message}`)
        .join('\n');
    } else {
      transcript = data.transcript || '';
    }
    // console.log("ACTUAL TRANSCRIPT", transcript);
    const candidateId = data.user_id; // This matches the UUID we sent
    const conversationId = data.call_id || data.conversation_id; // ElevenLabs usually provides this
    const campaignId = data.conversation_initiation_client_data.custom_llm_extra_body?.campaign_id;
    // console.log("CAMPAIGN ID", campaignId);
    // console.log("CANDIDATE ID", candidateId);

    if (!campaignId || !candidateId) {
      console.warn('Webhook missing campaignId or candidateId');
      return res.status(200).json({ status: 'ignored' });
    }

    // 1. Get Campaign from DB
    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign || !campaign.analysis_file_path) {
      console.error('Campaign or Excel file not found');
      return res.status(404).json({ error: 'Campaign not found' });
    }
    // console.log("CAMPAIGN", campaign);
    // 2. Perform AI Analysis on transcript
    const analysisResults = await aiService.analyzeTranscript(campaign.description, transcript);
    
    // Store objects as strings for Excel compatibility
    const finalDataForExcel = {
      performance_metrics: JSON.stringify(analysisResults.performance_metrics),
      field_experience: JSON.stringify(analysisResults.field_experience),
      overall_analysis: analysisResults.overall_analysis,
      overall_score: analysisResults.overall_score,
      transcript: transcript,
      conversation_id: conversationId
    };
    // console.log("FINAL DATA", finalDataForExcel);
    // 3. Download the current XLSX from Cloudinary
    const response = await axios.get(campaign.analysis_file_path, { responseType: 'arraybuffer' });
    const currentBuffer = Buffer.from(response.data);
    // console.log("CURRENT BUFFER", currentBuffer);
    // 4. Update the XLSX buffer
    const updatedBuffer = excelService.updateCampaignAnalysisBuffer(currentBuffer, candidateId, finalDataForExcel);
    // console.log("UPDATED BUFFER", updatedBuffer);
    // 5. Upload back to Cloudinary
    const fileName = `campaign_${campaignId}_analysis.xlsx`; // Keep same filename to overwrite or append
    const updatedUrl = await cloudinaryService.uploadXlsxToCloudinary(updatedBuffer, fileName);
    // console.log("UPDATED URL", updatedUrl);
    // 6. Update campaign status if needed or just update the file path
    // If you want to keep the same URL, Cloudinary might need time to invalidate cache
    // but usually, secure_url changes if public_id is different. 
    // Here we use the same public_id, so we might need to update the URL in DB.
    campaign.analysis_file_path = updatedUrl;
    await campaign.save();
    // console.log("CAMPAIGN", campaign);
    res.json({ message: 'Webhook processed successfully', updatedUrl });

  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

exports.getCampaignById = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({
      where: { 
        id: req.params.id,
        creator_id: req.user.id 
      }
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(campaign);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.findAll({
      where: { creator_id: req.user.id },
      include: [{ model: User, attributes: ['full_name', 'email'] }]
    });
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
