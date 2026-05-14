import express from 'express';
import morgan from 'morgan';
import cors from "cors";
import helmet from "helmet";
import Route from '#routes/index.js';
import cookieParser from 'cookie-parser';
import "dotenv/config";
import { notFoundHandler, errorHandler } from '#middlewares/errorHandler.js';


const baseUrl = process.env.BASE_URL || '/api/v1';

//CORS Configuration
const corsOptions = {
  origin: [
    'https://tekbook.website',
    'https://www.tekbook.website',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Initialize Express app
const app = express();
app.set('trust proxy', 1);
// Apply security middleware
app.use(helmet({
  referrerPolicy: { policy: 'no-referrer' },
}));

app.use(morgan('common'));
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // GIS redirect POST form
app.set("json replacer", (key, value) =>
  typeof value === "bigint" ? value.toString() : value
);

// Mount the main router at the base URL
app.use(baseUrl, Route);

// 404 handler — catches any request that didn't match a route above
app.use(notFoundHandler);

// Global error handler — must be the LAST middleware (4 parameters required)
app.use(errorHandler);

export default app;