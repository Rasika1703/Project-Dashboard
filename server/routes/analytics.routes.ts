import express from 'express';
import {
  getProjectSummary,
  getUserActivity,
  getProjectSnapshot
} from '../controllers/analytics.controller.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

router.get('/projects/:id/summary', getProjectSummary);
router.get('/projects/:id/snapshot', getProjectSnapshot);
router.get('/users/:id/activity', getUserActivity);

export default router;
