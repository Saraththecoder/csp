const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// In-Memory Database Fallback for Stateless Vercel Environment
const DEFAULT_STATE = {
  globalWaterStatus: 'safe', // 'safe', 'careful', 'risk'
  sources: {
    ro: { status: 'safe', trust: 5, complaints: [] },
    tank: { status: 'safe', trust: 4, complaints: [] },
    school: { status: 'careful', trust: 3, complaints: ['Bad Taste'] },
    temple: { status: 'risk', trust: 1, complaints: ['Dirty Color', 'Family Sick'] }
  },
  sicknessCases: {
    diarrhea: 0,
    vomiting: 0,
    fever: 0
  }
};

let vercelState = { ...DEFAULT_STATE };
const DB_FILE = '/tmp/database.json'; // Use Vercel's temp writable folder

// Helper: Sync State
function getState() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      vercelState = JSON.parse(data);
    }
  } catch (err) {
    // Fail silently in cloud environments
  }
  return vercelState;
}

function saveState(state) {
  vercelState = state;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    // Fail silently in cloud environments
  }
}

// API: GET /api/data
app.get('/api/data', (req, res) => {
  const state = getState();
  res.json(state);
});

// API: POST /api/action
app.post('/api/action', (req, res) => {
  const db = getState();
  const { action, payload } = req.body;

  if (action === 'report') {
    const { problems, targetSource } = payload;
    if (!db.sources[targetSource]) {
      return res.status(400).json({ error: 'Invalid water source' });
    }

    const s = db.sources[targetSource];
    s.complaints = [...new Set([...s.complaints, ...problems])];

    if (problems.includes('Family Sick')) {
      s.status = 'risk';
      s.trust = Math.max(1, s.trust - 2);
      db.globalWaterStatus = 'risk';
    } else {
      s.status = 'careful';
      s.trust = Math.max(1, s.trust - 1);
      if (db.globalWaterStatus !== 'risk') {
        db.globalWaterStatus = 'careful';
      }
    }
    
    saveState(db);
    return res.json({ success: true, state: db });
  } 
  
  else if (action === 'sickness') {
    const { type, count } = payload;
    if (db.sicknessCases[type] === undefined) {
      return res.status(400).json({ error: 'Invalid sickness category' });
    }

    db.sicknessCases[type] = Math.max(0, db.sicknessCases[type] + count);

    // Recalculate ASHA risk
    const total = db.sicknessCases.diarrhea + db.sicknessCases.vomiting + db.sicknessCases.fever;
    if (total <= 2) {
      if (db.globalWaterStatus === 'risk') {
        db.globalWaterStatus = 'careful';
      }
    } else if (total <= 5) {
      if (db.globalWaterStatus !== 'risk') {
        db.globalWaterStatus = 'careful';
      }
    } else {
      db.globalWaterStatus = 'risk';
    }

    saveState(db);
    return res.json({ success: true, state: db });
  }

  else if (action === 'reset') {
    saveState(DEFAULT_STATE);
    return res.json({ success: true, state: DEFAULT_STATE });
  }

  res.status(400).json({ error: 'Invalid action' });
});

module.exports = app;
