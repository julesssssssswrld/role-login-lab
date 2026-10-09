const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let users = [];
let nextId = 1;

const findUserById    = (id)    => users.find(u => u.id === id);
const findUserByEmail = (email) => users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
const sanitizeUser    = (user)  => { const { password, ...safe } = user; return safe; };
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ============================================================
// USER CRUD ROUTES
// ============================================================

// GET /api/users — list all users (no passwords)
app.get('/api/users', (req, res) => {
  res.json(users.map(sanitizeUser));
});

// POST /api/users — admin creates a user with any role
app.post('/api/users', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  if (!emailRegex.test(email))
    return res.status(400).json({ error: 'Invalid email format.' });
  if (findUserByEmail(email))
    return res.status(409).json({ error: 'Email already registered.' });

  let normalizedRole = 'user';
  if (role === 'admin') normalizedRole = 'admin';
  else if (role === 'staff') normalizedRole = 'staff';

  const hashed  = await bcrypt.hash(password, 10);
  const newUser = { id: nextId++, name, email, password: hashed, role: normalizedRole };
  users.push(newUser);
  res.status(201).json(sanitizeUser(newUser));
});

// GET /api/users/:id — get one user
app.get('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid user ID.' });
  const user = findUserById(id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json(sanitizeUser(user));
});

// PUT /api/users/:id — update a user (admin)
app.put('/api/users/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid user ID.' });
  const { name, email, password, role } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required.' });
  if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format.' });

  const user = findUserById(id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const existing = findUserByEmail(email);
  if (existing && existing.id !== id) return res.status(409).json({ error: 'Email already registered.' });

  user.name  = name;
  user.email = email;
  if (password) user.password = await bcrypt.hash(password, 10);
  if (role === 'admin') user.role = 'admin';
  else if (role === 'staff') user.role = 'staff';
  else if (role === 'user')  user.role = 'user';

  res.json(sanitizeUser(user));
});

// DELETE /api/users/:id — delete a user
app.delete('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid user ID.' });
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return res.status(404).json({ error: 'User not found.' });
  users.splice(index, 1);
  res.status(204).send();
});

// ============================================================
// PUBLIC REGISTRATION
// ============================================================
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  if (!emailRegex.test(email))
    return res.status(400).json({ error: 'Invalid email format.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (findUserByEmail(email))
    return res.status(409).json({ error: 'Email already registered.' });

  const hashed  = await bcrypt.hash(password, 10);
  const newUser = { id: nextId++, name, email, password: hashed, role: 'user' };
  users.push(newUser);
  res.status(201).json({ message: 'Registration successful', user: sanitizeUser(newUser) });
});

// ============================================================
// LOGIN
// ============================================================
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required.' });

  const user = findUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

  let redirectTo = '/user.html';
  if (user.role === 'admin') redirectTo = '/admin.html';
  else if (user.role === 'staff') redirectTo = '/staff.html';

  res.json({ message: 'Login successful', user: sanitizeUser(user), redirectTo });
});

// ============================================================
// PROFILE UPDATE (self-service)
// ============================================================
app.put('/api/profile/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid user ID.' });

  const user = findUserById(id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const { name, email, currentPassword, newPassword } = req.body;
  if (!name || !email)
    return res.status(400).json({ error: 'Name and email are required.' });
  if (!emailRegex.test(email))
    return res.status(400).json({ error: 'Invalid email format.' });

  const existing = findUserByEmail(email);
  if (existing && existing.id !== id)
    return res.status(409).json({ error: 'Email already registered.' });

  if (newPassword) {
    if (!currentPassword)
      return res.status(400).json({ error: 'Current password is required to set a new password.' });
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match)
      return res.status(401).json({ error: 'Current password is incorrect.' });
    if (newPassword.length < 6)
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    user.password = await bcrypt.hash(newPassword, 10);
  }

  user.name  = name;
  user.email = email;

  res.json({ message: 'Profile updated successfully', user: sanitizeUser(user) });
});

// ============================================================
// START SERVER
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Login page:    http://localhost:${PORT}/login.html`);
  console.log(`Register page: http://localhost:${PORT}/register.html`);
});