const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Generates an XLSX buffer for a campaign
 * @param {Array} candidates - Array of objects { id, name, phoneNumber }
 * @returns {Buffer} The XLSX file buffer
 */
const generateCampaignAnalysisBuffer = (candidates) => {
  // Prepare data with empty fields for scores/experience
  const data = candidates.map(candidate => ({
    id: candidate.id,
    name: candidate.name,
    phone_number: candidate.phoneNumber,
    email: candidate.email || '',
    linkedin: candidate.linkedin || '',
    conversation_id: '',
    performance_metrics: '',
    field_experience: '',
    overall_analysis: '',
    overall_score: '',
    transcript: ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidates');

  // Generate buffer
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

/**
 * Updates an existing XLSX buffer with call analysis
 * @param {Buffer} existingBuffer - The current XLSX buffer
 * @param {string} candidateId - The ID of the candidate to update
 * @param {Object} analysisData - { candidate_score, experience, specific_score, transcript, analysis }
 * @returns {Buffer} The updated XLSX file buffer
 */
const updateCampaignAnalysisBuffer = (existingBuffer, candidateId, analysisData) => {
  const workbook = XLSX.read(existingBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert sheet to JSON for easier manipulation
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  // Find and update the candidate row
  const updatedData = data.map(candidate => {
    if (candidate.id === candidateId) {
      return {
        ...candidate,
        ...analysisData
      };
    }
    return candidate;
  });

  // Convert back to worksheet
  const newWorksheet = XLSX.utils.json_to_sheet(updatedData);
  workbook.Sheets[sheetName] = newWorksheet;

  // Generate new buffer
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

module.exports = {
  generateCampaignAnalysisBuffer,
  updateCampaignAnalysisBuffer,
};
