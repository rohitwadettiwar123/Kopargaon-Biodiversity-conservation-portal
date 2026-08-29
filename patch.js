const fs = require('fs');

// 1. Update backend/server.js
let serverJs = fs.readFileSync('backend/server.js', 'utf8');

// Inject the recovery modules into the citizen report endpoint
const target1 = `const verification_status = 'Pending';

      await dbRun(`;
const replacement1 = `const verification_status = 'Pending';
      
      const opQueue = require('./recovery/operation-queue');
      const recState = require('./recovery/recovery-state');
      
      if (recState.getState() === 'BLACKOUT') {
        opQueue.addOperation({
          operation_id: report_id,
          type: 'CITIZEN_REPORT',
          status: 'PENDING',
          created_at: submitted_at,
          payload: { user_id, species, lat, lng, desc, village_id, report_time, count, image_auth_status, image_ai_probability, image_auth_requires_review, report_date, submitted_at }
        });
        return res.status(201).json({ success: true, report_id, message: 'System blackout detected. Your operation has been safely queued and will be synchronized when the system is restored.' });
      }

      opQueue.addOperation({
        operation_id: report_id,
        type: 'CITIZEN_REPORT',
        status: 'PENDING',
        created_at: submitted_at,
        payload: { user_id, species, lat, lng, desc, village_id, report_time, count, image_auth_status, image_ai_probability, image_auth_requires_review, report_date, submitted_at }
      });

      try {
        await dbRun(`;

serverJs = serverJs.replace(target1, replacement1);

const target2Regex = /image_auth_status \? submitted_at : null, image_auth_requires_review \? 1 : 0\]\s*\);\s*\/\/ Award 10 points/;
const replacement2 = `image_auth_status ? submitted_at : null, image_auth_requires_review ? 1 : 0]
        );
        opQueue.updateOperationStatus(report_id, 'COMPLETED');
      } catch (err) { throw err; }

      // Award 10 points`;

serverJs = serverJs.replace(target2Regex, replacement2);

// Inject API routes before app.listen
const target3 = `app.listen(PORT, () => {`;
const replacement3 = `require('./recovery/api')(app, db, authenticateToken, adminOnly);
  app.listen(PORT, () => {`;

serverJs = serverJs.replace(target3, replacement3);

fs.writeFileSync('backend/server.js', serverJs, 'utf8');

// 2. Update Frontend/js/app.js
let appJs = fs.readFileSync('Frontend/js/app.js', 'utf8');

const targetApp1 = `{ id: 'logout',`;
const replacementApp1 = `{ id: 'recovery',      label: 'Data Resilience',     icon: 'fa-shield-alt',     href: 'blackout-recovery.html',   badge: null },
    { id: 'logout',`;
appJs = appJs.replace(targetApp1, replacementApp1);

const targetApp2 = `_default:      null,`;
const replacementApp2 = `_default:      ['dashboard','species','observations','citizen','gismap','threats','water','ndvi','conservation','education','leaderboard','profile','analytics','logout'],`;
appJs = appJs.replace(targetApp2, replacementApp2);

fs.writeFileSync('Frontend/js/app.js', appJs, 'utf8');
console.log('Patches applied successfully via Node.js');
