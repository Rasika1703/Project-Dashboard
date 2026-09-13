import express from 'express';
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject
} from '../controllers/projects.controller.js';
import { verifyToken } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

router.get('/', getProjects);
router.get('/:id', getProject);
router.post('/', validate(schemas.createProject), createProject);
router.put('/:id', validate(schemas.updateProject), updateProject);
router.delete('/:id', deleteProject);

export default router;
