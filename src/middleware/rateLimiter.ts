import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: 'Too many requests. Please wait and try again.' },
});

export const assessLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  message: { error: 'Too many AI requests. Please slow down.' },
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  message: { error: 'Too many uploads. Please wait.' },
});
