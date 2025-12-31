const Level = require('../models/Level');
const Status = require('../models/Status');
const QuestionType = require('../models/QuestionType');
const Language = require('../models/Language');
const Category = require('../models/Category');
const Tag = require('../models/Tag');

class MasterDataController {
  // Get all master data for dropdowns
  static async getAllMasterData(req, res) {
    try {
      const [levels, statuses, questionTypes, languages, categories, tags] = await Promise.all([
        Level.getAll(),
        Status.getAll(),
        QuestionType.getAll(),
        Language.getAll(),
        Category.getAll(),
        Tag.getAll()
      ]);

      res.json({
        levels,
        statuses,
        questionTypes,
        languages,
        categories,
        tags
      });
    } catch (error) {
      console.error('Get master data error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get levels
  static async getLevels(req, res) {
    try {
      const levels = await Level.getAll();
      res.json({ levels });
    } catch (error) {
      console.error('Get levels error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get statuses
  static async getStatuses(req, res) {
    try {
      const statuses = await Status.getAll();
      res.json({ statuses });
    } catch (error) {
      console.error('Get statuses error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get question types
  static async getQuestionTypes(req, res) {
    try {
      const questionTypes = await QuestionType.getAll();
      res.json({ questionTypes });
    } catch (error) {
      console.error('Get question types error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get languages
  static async getLanguages(req, res) {
    try {
      const languages = await Language.getAll();
      res.json({ languages });
    } catch (error) {
      console.error('Get languages error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get categories
  static async getCategories(req, res) {
    try {
      const categories = await Category.getAllWithHierarchy();
      res.json({ categories });
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get tags
  static async getTags(req, res) {
    try {
      const tags = await Tag.getAll();
      res.json({ tags });
    } catch (error) {
      console.error('Get tags error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Create tag
  static async createTag(req, res) {
    try {
      const { name, color } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Tag name is required' });
      }

      const existing = await Tag.findByName(name);
      if (existing) {
        return res.status(400).json({ error: 'Tag with this name already exists' });
      }

      const id = await Tag.create({ name, color });
      const tag = await Tag.findById(id);

      res.status(201).json({
        message: 'Tag created successfully',
        tag
      });
    } catch (error) {
      console.error('Create tag error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // Create category
  static async createCategory(req, res) {
    try {
      const { name, description, parent_id } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Category name is required' });
      }

      const id = await Category.create({ name, description, parent_id });
      const category = await Category.findById(id);

      res.status(201).json({
        message: 'Category created successfully',
        category
      });
    } catch (error) {
      console.error('Create category error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}

module.exports = MasterDataController;

