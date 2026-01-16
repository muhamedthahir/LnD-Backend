const Level = require('../models/Level');
const Status = require('../models/Status');
const QuestionType = require('../models/QuestionType');
const Language = require('../models/Language');
const Category = require('../models/Category');
const Tag = require('../models/Tag');
const UserRole = require('../models/UserRole');

class MasterDataController {
  // ==================== GET ALL ====================
  
  // Get all master data for dropdowns
  static async getAllMasterData(req, res) {
    try {
      const [levels, statuses, questionTypes, languages, categories, tags, userRoles] = await Promise.all([
        Level.getAll(),
        Status.getAll(),
        QuestionType.getAll(),
        Language.getAll(),
        Category.getAll(),
        Tag.getAll(),
        UserRole.getAll()
      ]);

      res.json({
        levels,
        statuses,
        questionTypes,
        languages,
        categories,
        tags,
        userRoles
      });
    } catch (error) {
      console.error('Get master data error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ==================== LEVELS ====================
  
  static async getLevels(req, res) {
    try {
      const levels = await Level.getAll();
      res.json({ levels });
    } catch (error) {
      console.error('Get levels error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getLevel(req, res) {
    try {
      const { id } = req.params;
      const level = await Level.findById(id);
      if (!level) {
        return res.status(404).json({ error: 'Level not found' });
      }
      res.json({ level });
    } catch (error) {
      console.error('Get level error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async createLevel(req, res) {
    try {
      const { name, description, rank } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Level name is required' });
      }
      const id = await Level.create({ name, description, rank: rank || 0 });
      const level = await Level.findById(id);
      res.status(201).json({ message: 'Level created successfully', level });
    } catch (error) {
      console.error('Create level error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  static async updateLevel(req, res) {
    try {
      const { id } = req.params;
      const { name, description, rank } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Level name is required' });
      }
      await Level.update(id, { name, description, rank });
      const level = await Level.findById(id);
      res.json({ message: 'Level updated successfully', level });
    } catch (error) {
      console.error('Update level error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  static async deleteLevel(req, res) {
    try {
      const { id } = req.params;
      await Level.delete(id);
      res.json({ message: 'Level deleted successfully' });
    } catch (error) {
      console.error('Delete level error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // ==================== STATUSES ====================
  
  static async getStatuses(req, res) {
    try {
      const statuses = await Status.getAll();
      res.json({ statuses });
    } catch (error) {
      console.error('Get statuses error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getStatus(req, res) {
    try {
      const { id } = req.params;
      const status = await Status.findById(id);
      if (!status) {
        return res.status(404).json({ error: 'Status not found' });
      }
      res.json({ status });
    } catch (error) {
      console.error('Get status error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async createStatus(req, res) {
    try {
      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Status name is required' });
      }
      const id = await Status.create({ name, description });
      const status = await Status.findById(id);
      res.status(201).json({ message: 'Status created successfully', status });
    } catch (error) {
      console.error('Create status error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  static async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Status name is required' });
      }
      await Status.update(id, { name, description });
      const status = await Status.findById(id);
      res.json({ message: 'Status updated successfully', status });
    } catch (error) {
      console.error('Update status error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  static async deleteStatus(req, res) {
    try {
      const { id } = req.params;
      await Status.delete(id);
      res.json({ message: 'Status deleted successfully' });
    } catch (error) {
      console.error('Delete status error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // ==================== QUESTION TYPES ====================
  
  static async getQuestionTypes(req, res) {
    try {
      const questionTypes = await QuestionType.getAll();
      res.json({ questionTypes });
    } catch (error) {
      console.error('Get question types error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getQuestionType(req, res) {
    try {
      const { id } = req.params;
      const questionType = await QuestionType.findById(id);
      if (!questionType) {
        return res.status(404).json({ error: 'Question type not found' });
      }
      res.json({ questionType });
    } catch (error) {
      console.error('Get question type error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async createQuestionType(req, res) {
    try {
      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Question type name is required' });
      }
      const id = await QuestionType.create({ name, description });
      const questionType = await QuestionType.findById(id);
      res.status(201).json({ message: 'Question type created successfully', questionType });
    } catch (error) {
      console.error('Create question type error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  static async updateQuestionType(req, res) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Question type name is required' });
      }
      await QuestionType.update(id, { name, description });
      const questionType = await QuestionType.findById(id);
      res.json({ message: 'Question type updated successfully', questionType });
    } catch (error) {
      console.error('Update question type error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  static async deleteQuestionType(req, res) {
    try {
      const { id } = req.params;
      await QuestionType.delete(id);
      res.json({ message: 'Question type deleted successfully' });
    } catch (error) {
      console.error('Delete question type error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // ==================== LANGUAGES ====================
  
  static async getLanguages(req, res) {
    try {
      const languages = await Language.getAll();
      res.json({ languages });
    } catch (error) {
      console.error('Get languages error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getLanguage(req, res) {
    try {
      const { id } = req.params;
      const language = await Language.findById(id);
      if (!language) {
        return res.status(404).json({ error: 'Language not found' });
      }
      res.json({ language });
    } catch (error) {
      console.error('Get language error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async createLanguage(req, res) {
    try {
      const { name, description, is_active, current_version } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Language name is required' });
      }
      const id = await Language.create({ name, description, is_active: is_active !== false, current_version });
      const language = await Language.findById(id);
      res.status(201).json({ message: 'Language created successfully', language });
    } catch (error) {
      console.error('Create language error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  static async updateLanguage(req, res) {
    try {
      const { id } = req.params;
      const { name, description, is_active, current_version } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Language name is required' });
      }
      await Language.update(id, { name, description, is_active, current_version });
      const language = await Language.findById(id);
      res.json({ message: 'Language updated successfully', language });
    } catch (error) {
      console.error('Update language error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  static async deleteLanguage(req, res) {
    try {
      const { id } = req.params;
      await Language.delete(id);
      res.json({ message: 'Language deleted successfully' });
    } catch (error) {
      console.error('Delete language error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // ==================== CATEGORIES ====================
  
  static async getCategories(req, res) {
    try {
      const categories = await Category.getAllWithHierarchy();
      res.json({ categories });
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getCategory(req, res) {
    try {
      const { id } = req.params;
      const category = await Category.findById(id);
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }
      res.json({ category });
    } catch (error) {
      console.error('Get category error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async createCategory(req, res) {
    try {
      const { name, description, parent_id, active } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Category name is required' });
      }
      const id = await Category.create({ name, description, parent_id, active: active !== false });
      const category = await Category.findById(id);
      res.status(201).json({ message: 'Category created successfully', category });
    } catch (error) {
      console.error('Create category error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  static async updateCategory(req, res) {
    try {
      const { id } = req.params;
      const { name, description, parent_id, active } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Category name is required' });
      }
      await Category.update(id, { name, description, parent_id, active });
      const category = await Category.findById(id);
      res.json({ message: 'Category updated successfully', category });
    } catch (error) {
      console.error('Update category error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  static async deleteCategory(req, res) {
    try {
      const { id } = req.params;
      await Category.delete(id);
      res.json({ message: 'Category deleted successfully' });
    } catch (error) {
      console.error('Delete category error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // ==================== TAGS ====================
  
  static async getTags(req, res) {
    try {
      const tags = await Tag.getAll();
      res.json({ tags });
    } catch (error) {
      console.error('Get tags error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getTag(req, res) {
    try {
      const { id } = req.params;
      const tag = await Tag.findById(id);
      if (!tag) {
        return res.status(404).json({ error: 'Tag not found' });
      }
      res.json({ tag });
    } catch (error) {
      console.error('Get tag error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

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
      res.status(201).json({ message: 'Tag created successfully', tag });
    } catch (error) {
      console.error('Create tag error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  static async updateTag(req, res) {
    try {
      const { id } = req.params;
      const { name, color } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Tag name is required' });
      }
      await Tag.update(id, { name, color });
      const tag = await Tag.findById(id);
      res.json({ message: 'Tag updated successfully', tag });
    } catch (error) {
      console.error('Update tag error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  static async deleteTag(req, res) {
    try {
      const { id } = req.params;
      await Tag.delete(id);
      res.json({ message: 'Tag deleted successfully' });
    } catch (error) {
      console.error('Delete tag error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // ==================== USER ROLES ====================
  
  static async getUserRoles(req, res) {
    try {
      const userRoles = await UserRole.getAll();
      res.json({ userRoles });
    } catch (error) {
      console.error('Get user roles error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getUserRole(req, res) {
    try {
      const { id } = req.params;
      const userRole = await UserRole.findById(id);
      if (!userRole) {
        return res.status(404).json({ error: 'User role not found' });
      }
      res.json({ userRole });
    } catch (error) {
      console.error('Get user role error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async createUserRole(req, res) {
    try {
      const { name, description, role_rank } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'User role name is required' });
      }
      const existing = await UserRole.findByName(name);
      if (existing) {
        return res.status(400).json({ error: 'User role with this name already exists' });
      }
      const id = await UserRole.create({ name, description, role_rank: role_rank || 0 });
      const userRole = await UserRole.findById(id);
      res.status(201).json({ message: 'User role created successfully', userRole });
    } catch (error) {
      console.error('Create user role error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  static async updateUserRole(req, res) {
    try {
      const { id } = req.params;
      const { name, description, role_rank } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'User role name is required' });
      }
      await UserRole.update(id, { name, description, role_rank });
      const userRole = await UserRole.findById(id);
      res.json({ message: 'User role updated successfully', userRole });
    } catch (error) {
      console.error('Update user role error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  static async deleteUserRole(req, res) {
    try {
      const { id } = req.params;
      // Prevent deletion of core roles
      const role = await UserRole.findById(id);
      if (role && ['primary_admin', 'college_admin', 'student'].includes(role.name)) {
        return res.status(400).json({ error: 'Cannot delete core system roles' });
      }
      await UserRole.delete(id);
      res.json({ message: 'User role deleted successfully' });
    } catch (error) {
      console.error('Delete user role error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}

module.exports = MasterDataController;
