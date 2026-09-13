import express from 'express';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask
} from '../controllers/tasks.controller.js';
import { verifyToken } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Project tasks
router.get('/projects/:id/tasks', getTasks);
router.post('/projects/:id/tasks', validate(schemas.createTask), createTask);

// Individual tasks
router.put('/:id', validate(schemas.updateTask), updateTask);
router.delete('/:id', deleteTask);

export default router;
