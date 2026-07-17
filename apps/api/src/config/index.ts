import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'call_log_sync',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  security: {
    apiKeySalt: process.env.API_KEY_SALT || 'api-key-salt-change-me',
  },
  cors: {
    // Use * when dashboard + API share the same URL (ngrok)
    origin: process.env.CORS_ORIGIN || '*',
  },
  publicUrl: process.env.PUBLIC_URL || 'http://localhost:3000',
};
