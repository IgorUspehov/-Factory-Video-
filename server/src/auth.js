import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { config, pricing } from './config.js';
import { HttpError } from './errors.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const publicUser = (u) => ({ id: u.id, email: u.email, plan: u.plan, credits: u.credits, renewsAt: u.renewsAt });

function credentials(body) {
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');
  if (!EMAIL.test(email)) throw new HttpError(400, 'invalid_email');
  if (password.length < 6) throw new HttpError(400, 'weak_password');
  return { email, password };
}

const issue = (user) => jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: '30d' });

export async function register(db, body) {
  const { email, password } = credentials(body);
  if (db.findOne('users', (u) => u.email === email)) throw new HttpError(409, 'exists');
  const user = {
    id: `usr_${randomUUID()}`,
    email,
    passwordHash: await bcrypt.hash(password, 10),
    plan: 'free',
    credits: pricing.freeCredits,
    renewsAt: null,
    createdAt: new Date().toISOString(),
  };
  await db.insert('users', user);
  return { token: issue(user) };
}

export async function login(db, body) {
  const { email, password } = credentials(body);
  const user = db.findOne('users', (u) => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'invalid_credentials');
  return { token: issue(user) };
}

export function requireAuth(db) {
  return (req, _res, next) => {
    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    try {
      const { sub } = jwt.verify(token, config.jwtSecret);
      const user = db.get('users', sub);
      if (!user) throw new Error('unknown user');
      req.user = user;
      next();
    } catch {
      next(new HttpError(401, 'unauthorized'));
    }
  };
}
