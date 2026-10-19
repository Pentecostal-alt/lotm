const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'local-development-only-change-me';

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  name: 'pentecostal.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

const campaign = {
  countdownEndsAt: Date.now() + 13 * 24 * 60 * 60 * 1000,
  loopTruth: 'The truth of the loop has not yet been recorded.',
  characters: [
    {
      id: 'lumian-lee', name: 'Lumian Lee', role: 'Hunter', sequence: '8 — Provoker',
      hp: '0/10', status: 'Unconscious', notes: 'A Hunter of the Red Priest pathway.'
    },
    {
      id: 'aurore', name: 'Aurore', role: 'Unknown', sequence: 'Unknown',
      hp: 'Unknown', status: 'Unknown', notes: 'Current status and whereabouts are unknown.'
    },
    {
      id: 'companion', name: 'Companion', role: 'Companion', sequence: 'Unknown',
      hp: '8/10', status: 'Stable', notes: 'Stable. Keep watch for any change in condition.'
    }
  ]
};

const gmUsername = process.env.GM_USERNAME || 'gm';
const gmPasswordHash = bcrypt.hash(process.env.GM_PASSWORD || 'change-me-now', 12);

function renderPage(res, view, locals = {}) {
  res.render(view, locals, (err, html) => {
    if (err) return res.status(500).send('Unable to render page.');
    res.render('layout', { ...locals, body: html }, (layoutErr, page) => {
      if (layoutErr) return res.status(500).send('Unable to render page.');
      res.send(page);
    });
  });
}

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireGM(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'GM') return res.redirect('/login');
  next();
}

function getCountdownDays() {
  return Math.max(0, Math.ceil((campaign.countdownEndsAt - Date.now()) / (24 * 60 * 60 * 1000)));
}

app.get('/', (req, res) => renderPage(res, 'index', { title: 'The Archive' }));

app.get('/roster', (req, res) => renderPage(res, 'roster', {
  title: 'The Roster', characters: campaign.characters
}));

app.get('/login', (req, res) => renderPage(res, 'login', {
  title: 'Enter the Archive', error: null
}));

app.post('/login', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const hash = await gmPasswordHash;
  const valid = username === gmUsername && await bcrypt.compare(password, hash);
  if (!valid) {
    return renderPage(res.status(401), 'login', {
      title: 'Enter the Archive', error: 'The credentials were not recognized.'
    });
  }
  req.session.regenerate((err) => {
    if (err) return res.status(500).send('Unable to start a session.');
    req.session.user = { username, role: 'GM' };
    res.redirect('/console');
  });
});

app.post('/logout', requireLogin, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('pentecostal.sid');
    res.redirect('/');
  });
});

app.get('/console', requireGM, (req, res) => renderPage(res, 'console', {
  title: 'Master Console', daysRemaining: getCountdownDays(), loopTruth: campaign.loopTruth,
  saved: req.query.saved === '1'
}));

app.post('/console', requireGM, (req, res) => {
  const days = Number.parseInt(req.body.daysRemaining, 10);
  const truth = String(req.body.loopTruth || '').trim().slice(0, 5000);
  if (Number.isInteger(days) && days >= 0 && days <= 3650) {
    campaign.countdownEndsAt = Date.now() + days * 24 * 60 * 60 * 1000;
  }
  campaign.loopTruth = truth;
  res.redirect('/console?saved=1');
});

app.get('/vaults', requireLogin, (req, res) => renderPage(res, 'vaults', {
  title: 'Character Vaults', characters: campaign.characters
}));

app.get('/vaults/:id', requireLogin, (req, res) => {
  const character = campaign.characters.find((item) => item.id === req.params.id);
  if (!character) return res.status(404).send('Vault not found.');
  renderPage(res, 'vault', { title: character.name, character });
});

app.use((req, res) => res.status(404).send('This page is absent from the archive.'));

app.listen(PORT, () => {
  console.log(`The Pentecostal Archives is listening on port ${PORT}`);
});
