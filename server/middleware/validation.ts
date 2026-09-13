import type { NextFunction, Request, Response } from 'express';
import Joi, { type ObjectSchema, type ValidationError } from 'joi';

export const validate = (schema: ObjectSchema) => {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const validationError = error as ValidationError;

      const errors = validationError.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    req.body = value;
    next();
  };
};

export const schemas = {
  register: Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().email().lowercase().required(),
    password: Joi.string().min(8).max(100).required(),
  }),

  login: Joi.object({
    email: Joi.string().email().lowercase().required(),
    password: Joi.string().required(),
  }),

  createProject: Joi.object({
    title: Joi.string().trim().min(2).max(200).required(),
    description: Joi.string().allow('').max(2000).optional(),
  }),

  updateProject: Joi.object({
    name: Joi.string().trim().min(2).max(200).optional(),
    description: Joi.string().allow('').max(2000).optional(),
    clientId: Joi.string().uuid().optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    status: Joi.string()
      .valid('PLANNING', 'ACTIVE', 'COMPLETED', 'ON_HOLD')
      .optional(),
  }),

  createTask: Joi.object({
    title: Joi.string().trim().min(2).max(200).required(),
    description: Joi.string().allow('').max(5000).optional(),
    assignedDeveloperId: Joi.string().uuid().required(),
    status: Joi.string()
      .valid('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE')
      .optional(),
    priority: Joi.string()
      .valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
      .optional(),
    dueDate: Joi.date().iso().optional(),
  }),

  updateTask: Joi.object({
    title: Joi.string().trim().min(2).max(200).optional(),
    description: Joi.string().allow('').max(5000).optional(),
    assignedDeveloperId: Joi.string().uuid().optional(),
    status: Joi.string()
      .valid('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE')
      .optional(),
    priority: Joi.string()
      .valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
      .optional(),
    dueDate: Joi.date().iso().allow(null).optional(),
  }),
};

