const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const campaignController = require('../controllers/campaignController');

const auth = require('../middleware/auth');

// User Routes
router.post('/register', userController.register);
router.post('/login', userController.login);

// Campaign Routes (Protected)
router.post('/campaigns', auth, campaignController.createCampaign);
router.get('/campaigns', auth, campaignController.getCampaigns);
router.get('/campaigns/:id', auth, campaignController.getCampaignById);

// Webhooks (Public)
router.post('/webhooks/elevenlabs', campaignController.handleElevenLabsWebhook);

module.exports = router;
