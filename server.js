import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';  
import connectDB from './db/ConnectDB.js'; 
import adminRoute from './routes/admin.js'; 
import userRoute from './routes/user.js'
import session from 'express-session';
import nocache from 'nocache';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Access .env variables
const PORT = process.env.PORT || 5000;
const DB_URL = process.env.DB_URL;
const JWT_SECRET = process.env.JWT_SECRET;
app.use(nocache())
app.use(session({
    secret:'topsecret',
    resave: false,
    saveUninitialized: false
}))
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use("/uploads", express.static("uploads"));
app.use(express.static('public'));
app.use(express.urlencoded({extended:true}))
app.use(express.json()); 

app.use('/user',userRoute)
app.use('/admin', adminRoute);


connectDB();

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  } else if (err) {
    return res.status(404).json({ error: err.message });
  }
  next();
}); 

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
