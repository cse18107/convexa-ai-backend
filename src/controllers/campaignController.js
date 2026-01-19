const supabase = require('../config/supabase');
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
      scheduled_date,
      scheduled_time
    } = req.body;
    const creator_id = req.user.id;

    if (!title || !description || !candidates || !Array.isArray(candidates)) {
      return res.status(400).json({ error: 'Missing required fields or invalid candidates list' });
    }

    let scheduledTimeUnix = null;
    if (scheduled_date && scheduled_time) {
      // Append +05:30 to force IST interpretation
      const dateTimeStr = `${scheduled_date}T${scheduled_time}:00+05:30`;
      const dateObj = new Date(dateTimeStr);
      if (!isNaN(dateObj.getTime())) {
        scheduledTimeUnix = Math.floor(dateObj.getTime() / 1000);
      }
    }

    const candidatesWithIds = candidates.map(c => ({
      ...c,
      id: uuidv4(),
    }));

    const generatedPrompt = await aiService.generatePrompt(description);

    const campaignId = uuidv4();
    const excelBuffer = excelService.generateCampaignAnalysisBuffer(candidatesWithIds);
    const fileName = `campaign_${campaignId}_analysis.xlsx`;
    const cloudinaryUrl = await cloudinaryService.uploadXlsxToCloudinary(excelBuffer, fileName);

    const campaignData = { 
      title, 
      description, 
      generatedPrompt, 
      id: campaignId,
      scheduledTimeUnix: scheduledTimeUnix 
    };
    const batchCallResponse = await elevenlabsService.createBatchCall(campaignData, candidatesWithIds);

    // Save to Supabase
    const { data: campaign, error: insertError } = await supabase
      .from('campaigns')
      .insert([
        {
          id: campaignId,
          creator_id,
          title,
          description,
          status: 'scheduled',
          analysis_file_path: cloudinaryUrl,
          batch_call_id: batchCallResponse.id,
        }
      ])
      .select()
      .single();

    if (insertError) throw insertError;

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
    const { data } = payload;
    if (!data) return res.status(200).json({ status: 'ignored' });

    let transcript = '';
    if (Array.isArray(data.transcript)) {
      transcript = data.transcript
        .map(entry => `${entry.role}: ${entry.message}`)
        .join('\n');
    } else {
      transcript = data.transcript || '';
    }

    const candidateId = data.user_id;
    const conversationId = data.call_id || data.conversation_id;
    const campaignId = data.conversation_initiation_client_data.custom_llm_extra_body?.campaign_id;

    if (!campaignId || !candidateId) {
      return res.status(200).json({ status: 'ignored' });
    }

    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (!campaign || !campaign.analysis_file_path) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const analysisResults = await aiService.analyzeTranscript(campaign.description, transcript);
    
    const finalDataForExcel = {
      performance_metrics: JSON.stringify(analysisResults.performance_metrics),
      field_experience: JSON.stringify(analysisResults.field_experience),
      overall_analysis: analysisResults.overall_analysis,
      overall_score: analysisResults.overall_score,
      transcript: transcript,
      conversation_id: conversationId
    };

    const response = await axios.get(campaign.analysis_file_path, { responseType: 'arraybuffer' });
    const currentBuffer = Buffer.from(response.data);
    const updatedBuffer = excelService.updateCampaignAnalysisBuffer(currentBuffer, candidateId, finalDataForExcel);

    const fileName = `campaign_${campaignId}_analysis.xlsx`;
    const updatedUrl = await cloudinaryService.uploadXlsxToCloudinary(updatedBuffer, fileName);

    const { error: updateError } = await supabase
      .from('campaigns')
      .update({ analysis_file_path: updatedUrl })
      .eq('id', campaignId);

    if (updateError) throw updateError;

    res.json({ message: 'Webhook processed successfully', updatedUrl });

  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

exports.getCampaignById = async (req, res) => {
  try {
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', req.params.id)
      .eq('creator_id', req.user.id)
      .single();

    if (error || !campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(campaign);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getCampaigns = async (req, res) => {
  try {
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('*, users:creator_id (full_name, email)')
      .eq('creator_id', req.user.id);

    if (error) throw error;
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
