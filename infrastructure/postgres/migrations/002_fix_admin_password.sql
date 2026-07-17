-- Fix admin password to: admin123
-- Run in pgAdmin Query Tool if login fails with 401

UPDATE users
SET password_hash = '$2a$10$YCRbKDzvwIiw39vHo9HDP.I6cP2i3WC/pZ86UdDF.U57KZWM9zKE2'
WHERE email = 'admin@enterprise.com';
