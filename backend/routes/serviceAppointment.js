import express from 'express';
import {clerkMiddleware, clerkAuth} from '@clerk/express';
import{
  createServiceAppointment,
  confirmServicePayment,
  getServiceAppointments,
  getServiceAppointmentById,
  updateServiceAppointmentStatus,
  cancelServiceAppointment,
  getServiceAppointmentStats,
  getServiceAppointmentsByPatient,
} from '../controllers/serviceAppointmentController.js';

const serviceAppointmentRouter = express.Router();

serviceAppointmentRouter.get('/',  getServiceAppointments);
serviceAppointmentRouter.get('/confirm', confirmServicePayment);
serviceAppointmentRouter.get('/stats/summary', getServiceAppointmentStats);
serviceAppointmentRouter.post('/', clerkMiddleware(), clerkAuth(), createServiceAppointment);
serviceAppointmentRouter.get('/me', clerkMiddleware(), clerkAuth(), getServiceAppointmentsByPatient);
serviceAppointmentRouter.get('/:id', getServiceAppointmentById);
serviceAppointmentRouter.put('/:id', updateServiceAppointmentStatus);
serviceAppointmentRouter.delete('/:id/cancel', cancelServiceAppointment);

export default serviceAppointmentRouter;