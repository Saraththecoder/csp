const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(cors());
app.use(express.json());

// Serve built Vite static files in production
app.use(express.static(path.join(__dirname, 'dist')));

// Default Application State
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

// Helper: Read Database
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      writeDB(DEFAULT_STATE);
      return DEFAULT_STATE;
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading database file:', err);
    return DEFAULT_STATE;
  }
}

// Helper: Write Database
function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing to database file:', err);
  }
}

// API: GET /api/data - Get current state
app.get('/api/data', (req, res) => {
  const db = readDB();
  res.json(db);
});

// API: POST /api/action - Handle water reports or health logging
app.post('/api/action', (req, res) => {
  const db = readDB();
  const { action, payload } = req.body;

  if (action === 'report') {
    const { problems, targetSource } = payload;
    if (!db.sources[targetSource]) {
      return res.status(400).json({ error: 'Invalid water source' });
    }

    const s = db.sources[targetSource];
    s.complaints = [...new Set([...s.complaints, ...problems])];

    // Escalate risk states based on complaints
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
    
    writeDB(db);
    return res.json({ success: true, state: db });
  } 
  
  else if (action === 'sickness') {
    const { type, count } = payload; // count will be +1 or -1
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

    writeDB(db);
    return res.json({ success: true, state: db });
  }

  else if (action === 'reset') {
    writeDB(DEFAULT_STATE);
    return res.json({ success: true, state: DEFAULT_STATE });
  }

  res.status(400).json({ error: 'Invalid action' });
});

// Fallback: route client requests to index.html in production
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
