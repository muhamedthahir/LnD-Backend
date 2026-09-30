const PlaygroundProject = require('../models/PlaygroundProject');

class PlaygroundController {
  /**
   * List current user's saved projects (with optional ?search=)
   * GET /api/playground
   */
  static async list(req, res) {
    try {
      const { search } = req.query;
      const projects = await PlaygroundProject.listByUser(req.user.id, search || null);
      res.json({ projects });
    } catch (error) {
      console.error('List playground projects error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get a single project owned by the current user
   * GET /api/playground/:id
   */
  static async getOne(req, res) {
    try {
      const project = await PlaygroundProject.findByIdForUser(req.params.id, req.user.id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json({ project });
    } catch (error) {
      console.error('Get playground project error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Create a new project for the current user
   * POST /api/playground
   */
  static async create(req, res) {
    try {
      const { title, html, css, js } = req.body;
      const { id, share_id } = await PlaygroundProject.create({
        title,
        html,
        css,
        js,
        created_by: req.user.id
      });
      res.status(201).json({ id, share_id });
    } catch (error) {
      console.error('Create playground project error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update an existing project (owner only)
   * PUT /api/playground/:id
   */
  static async update(req, res) {
    try {
      const { title, html, css, js } = req.body;
      const updated = await PlaygroundProject.updateForUser(req.params.id, req.user.id, {
        title,
        html,
        css,
        js
      });
      if (!updated) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Update playground project error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Delete a project (owner only)
   * DELETE /api/playground/:id
   */
  static async remove(req, res) {
    try {
      const deleted = await PlaygroundProject.deleteForUser(req.params.id, req.user.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Delete playground project error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get a project publicly by its share id (no authentication).
   * Returns code only - edits made by viewers are never persisted here.
   * GET /api/playground/public/:shareId
   */
  static async getPublic(req, res) {
    try {
      const project = await PlaygroundProject.findByShareId(req.params.shareId);
      if (!project) {
        return res.status(404).json({ error: 'Shared playground not found' });
      }
      res.json({
        project: {
          share_id: project.share_id,
          title: project.title,
          html: project.html,
          css: project.css,
          js: project.js
        }
      });
    } catch (error) {
      console.error('Get public playground project error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = PlaygroundController;
