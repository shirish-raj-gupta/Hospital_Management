import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import doctorRouter from './routes/doctorRouter.js';
import serviceRouter from './routes/serviceRouter.js';
import {clerkMiddleware} from '@clerk/express';
import { connectDB } from './config/db.js';
import appointmentRouter from './routes/appointmentRouter.js';

const app=express();
const PORT=4000;

//Middleware
app.use(cors());
app.use(clerkMiddleware());
app.use(express.json({limit: '20mb'}));
app.use(express.urlencoded({limit: '20mb', extended: true}));


//DB
connectDB();


//Routes
app.get('/', (req,res)=>{
    res.send('Hello World!');
});

app.use('/api/doctors', doctorRouter);
app.use('/api/services', serviceRouter);
app.use('/api/appointments', appointmentRouter);


app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`);
});