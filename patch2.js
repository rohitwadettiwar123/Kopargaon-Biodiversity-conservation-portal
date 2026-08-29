const fs = require('fs');
let serverJs = fs.readFileSync('backend/server.js', 'utf8');

// The replacement was missing the try block because the first string replace didn't match.
// Let's replace the first part again using regex to be safe.
const target1Regex = /const verification_status = 'Pending';\s*await dbRun\(/;
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

serverJs = serverJs.replace(target1Regex, replacement1);
fs.writeFileSync('backend/server.js', serverJs, 'utf8');
console.log('Fixed try block injection');
