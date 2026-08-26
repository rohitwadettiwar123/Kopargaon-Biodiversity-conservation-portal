const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

/**
 * Checks image authenticity against Sightengine GenAI model
 * @param {string} filePath - Absolute or relative path to the image file
 * @returns {Promise<Object>} Normalized result object
 */
async function checkImageAuthenticity(filePath) {
  const user = process.env.SIGHTENGINE_API_USER;
  const secret = process.env.SIGHTENGINE_API_SECRET;

  if (!user || !secret) {
    console.log('[ImageAuth] Sightengine credentials are not configured.');
    return {
      success: false,
      status: 'CHECK_UNAVAILABLE',
      requiresReview: true,
      message: 'Image authenticity verification is currently unavailable. Manual review is required.'
    };
  }

  const LOW_THRESHOLD = parseFloat(process.env.AI_IMAGE_LOW_THRESHOLD || '0.30');
  const HIGH_THRESHOLD = parseFloat(process.env.AI_IMAGE_HIGH_THRESHOLD || '0.70');

  console.log('[ImageAuth] Checking uploaded image: ' + filePath);

  try {
    const data = new FormData();
    data.append('media', fs.createReadStream(filePath));
    data.append('models', 'genai');
    data.append('api_user', user);
    data.append('api_secret', secret);

    const response = await axios({
      method: 'post',
      url: 'https://api.sightengine.com/1.0/check.json',
      data: data,
      headers: data.getHeaders(),
      timeout: 15000 // 15 seconds timeout
    });

    console.log('[ImageAuth] Sightengine request successful');
    const result = response.data;
    
    if (result.status === 'success' && result.type && result.type.ai_generated !== undefined) {
      const probability = result.type.ai_generated;
      const percentage = Math.round(probability * 100);
      
      let status = 'REVIEW';
      let requiresReview = true;

      console.log('[ImageAuth] AI probability: ' + probability);

      if (probability < LOW_THRESHOLD) {
        status = 'LOW_RISK';
        requiresReview = false;
        console.log('[ImageAuth] Image flagged as likely authentic');
      } else if (probability >= HIGH_THRESHOLD) {
        status = 'HIGH_RISK';
        requiresReview = true;
        console.log('[ImageAuth] Image flagged for review (high risk)');
      } else {
        console.log('[ImageAuth] Image flagged for review (medium risk)');
      }

      return {
        success: true,
        aiGeneratedProbability: probability,
        aiGeneratedPercentage: percentage,
        status: status,
        requiresReview: requiresReview
      };
    } else {
      throw new Error(result.error?.message || 'Malformed Sightengine response');
    }

  } catch (error) {
    console.error('[ImageAuth] Error checking image authenticity:', error.message);
    // Graceful fallback
    return {
      success: false,
      status: 'CHECK_UNAVAILABLE',
      requiresReview: true,
      message: 'Image authenticity check is temporarily unavailable. Manual verification is required.'
    };
  }
}

module.exports = {
  checkImageAuthenticity
};
