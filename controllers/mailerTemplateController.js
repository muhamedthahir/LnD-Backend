const MailerTemplate = require('../models/MailerTemplate');

class MailerTemplateController {
  /**
   * Get all templates with pagination and filters
   * GET /api/mailer-templates
   */
  static async getTemplates(req, res) {
    try {
      const { search, type, category, is_active, limit = 10, offset = 0 } = req.query;
      
      const limitInt = Math.max(1, Math.min(1000, parseInt(limit, 10) || 10));
      const offsetInt = Math.max(0, parseInt(offset, 10) || 0);
      
      const result = await MailerTemplate.getAllPaginated({
        search: search || null,
        type: type || null,
        category: category || null,
        is_active: is_active,
        limit: limitInt,
        offset: offsetInt
      });

      res.json({
        templates: result.templates,
        total: result.total,
        limit: limitInt,
        offset: offsetInt
      });
    } catch (error) {
      console.error('Get templates error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get all active templates (for dropdowns)
   * GET /api/mailer-templates/active
   */
  static async getActiveTemplates(req, res) {
    try {
      const templates = await MailerTemplate.getAllActive();
      res.json({ templates });
    } catch (error) {
      console.error('Get active templates error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get templates by type
   * GET /api/mailer-templates/type/:type
   */
  static async getTemplatesByType(req, res) {
    try {
      const { type } = req.params;
      const templates = await MailerTemplate.getByType(type);
      res.json({ templates });
    } catch (error) {
      console.error('Get templates by type error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get distinct categories
   * GET /api/mailer-templates/categories
   */
  static async getCategories(req, res) {
    try {
      const categories = await MailerTemplate.getCategories();
      res.json({ categories });
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get single template by ID
   * GET /api/mailer-templates/:id
   */
  static async getTemplate(req, res) {
    try {
      const { id } = req.params;
      const template = await MailerTemplate.findById(id);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      res.json({ template });
    } catch (error) {
      console.error('Get template error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get template by unique_id
   * GET /api/mailer-templates/unique/:uniqueId
   */
  static async getTemplateByUniqueId(req, res) {
    try {
      const { uniqueId } = req.params;
      const template = await MailerTemplate.findByUniqueId(uniqueId);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      res.json({ template });
    } catch (error) {
      console.error('Get template by unique ID error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Create new template
   * POST /api/mailer-templates
   */
  static async createTemplate(req, res) {
    try {
      const {
        unique_id,
        name,
        description,
        type,
        category,
        subject,
        preview_text,
        html_template,
        text_template,
        template_format,
        has_dynamic_variables,
        variables,
        default_sender_name,
        default_sender_email,
        default_reply_to,
        is_active,
        priority,
        tags
      } = req.body;

      // Validation
      if (!unique_id || !name || !type || !subject) {
        return res.status(400).json({ 
          error: 'unique_id, name, type, and subject are required' 
        });
      }

      // Check if unique_id already exists
      const existing = await MailerTemplate.findByUniqueId(unique_id);
      if (existing) {
        return res.status(400).json({ 
          error: 'Template with this unique ID already exists' 
        });
      }

      const templateId = await MailerTemplate.create({
        unique_id,
        name,
        description,
        type,
        category,
        subject,
        preview_text,
        html_template,
        text_template,
        template_format,
        has_dynamic_variables,
        variables,
        default_sender_name,
        default_sender_email,
        default_reply_to,
        is_active,
        priority,
        tags,
        created_by: req.user.id
      });

      const template = await MailerTemplate.findById(templateId);

      res.status(201).json({
        message: 'Template created successfully',
        template
      });
    } catch (error) {
      console.error('Create template error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Update template
   * PUT /api/mailer-templates/:id
   */
  static async updateTemplate(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const template = await MailerTemplate.findById(id);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // If changing unique_id, check it doesn't already exist
      if (updateData.unique_id && updateData.unique_id !== template.unique_id) {
        const existing = await MailerTemplate.findByUniqueId(updateData.unique_id);
        if (existing) {
          return res.status(400).json({ 
            error: 'Template with this unique ID already exists' 
          });
        }
      }

      await MailerTemplate.update(id, {
        ...updateData,
        updated_by: req.user.id
      });

      const updatedTemplate = await MailerTemplate.findById(id);

      res.json({
        message: 'Template updated successfully',
        template: updatedTemplate
      });
    } catch (error) {
      console.error('Update template error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Delete template
   * DELETE /api/mailer-templates/:id
   */
  static async deleteTemplate(req, res) {
    try {
      const { id } = req.params;

      const template = await MailerTemplate.findById(id);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      await MailerTemplate.delete(id);

      res.json({ message: 'Template deleted successfully' });
    } catch (error) {
      console.error('Delete template error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Toggle template active status
   * PATCH /api/mailer-templates/:id/toggle-active
   */
  static async toggleActive(req, res) {
    try {
      const { id } = req.params;
      const { is_active } = req.body;

      const template = await MailerTemplate.findById(id);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      await MailerTemplate.toggleActive(id, is_active, req.user.id);

      const updatedTemplate = await MailerTemplate.findById(id);

      res.json({
        message: `Template ${is_active ? 'activated' : 'deactivated'} successfully`,
        template: updatedTemplate
      });
    } catch (error) {
      console.error('Toggle active error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Duplicate a template
   * POST /api/mailer-templates/:id/duplicate
   */
  static async duplicateTemplate(req, res) {
    try {
      const { id } = req.params;
      const { new_unique_id } = req.body;

      if (!new_unique_id) {
        return res.status(400).json({ error: 'new_unique_id is required' });
      }

      const template = await MailerTemplate.findById(id);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Check if new unique_id already exists
      const existing = await MailerTemplate.findByUniqueId(new_unique_id);
      if (existing) {
        return res.status(400).json({ 
          error: 'Template with this unique ID already exists' 
        });
      }

      const newTemplateId = await MailerTemplate.duplicate(id, new_unique_id, req.user.id);
      const newTemplate = await MailerTemplate.findById(newTemplateId);

      res.status(201).json({
        message: 'Template duplicated successfully',
        template: newTemplate
      });
    } catch (error) {
      console.error('Duplicate template error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Preview rendered template with sample data
   * POST /api/mailer-templates/:id/preview
   */
  static async previewTemplate(req, res) {
    try {
      const { id } = req.params;
      const sampleData = req.body;

      const rendered = await MailerTemplate.getRenderedTemplate(id, sampleData);
      
      if (!rendered) {
        return res.status(404).json({ error: 'Template not found' });
      }

      res.json({
        subject: rendered.rendered_subject,
        html: rendered.rendered_html,
        text: rendered.rendered_text,
        variables: rendered.variables
      });
    } catch (error) {
      console.error('Preview template error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}

module.exports = MailerTemplateController;

