const UserDetails = require('../models/UserDetails');

class UserDetailsController {
  /**
   * Get current user's details
   */
  static async getMyDetails(req, res) {
    try {
      const userId = req.user.id;
      const details = await UserDetails.findByUserId(userId);

      res.json({
        details: details || null,
        hasDetails: !!details
      });
    } catch (error) {
      console.error('Get user details error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update current user's details
   */
  static async updateMyDetails(req, res) {
    try {
      const userId = req.user.id;
      const details = req.body;

      const updatedDetails = await UserDetails.upsert(userId, details);

      res.json({
        message: 'Personal details updated successfully',
        details: updatedDetails
      });
    } catch (error) {
      console.error('Update user details error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Check profile completion status
   */
  static async checkCompletion(req, res) {
    try {
      const userId = req.user.id;
      const completion = await UserDetails.checkProfileCompletion(userId);

      res.json(completion);
    } catch (error) {
      console.error('Check profile completion error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get user details by ID (admin only)
   */
  static async getDetailsByUserId(req, res) {
    try {
      const { userId } = req.params;
      const details = await UserDetails.findByUserId(userId);

      if (!details) {
        return res.status(404).json({ error: 'User details not found' });
      }

      res.json({ details });
    } catch (error) {
      console.error('Get user details by ID error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = UserDetailsController;

