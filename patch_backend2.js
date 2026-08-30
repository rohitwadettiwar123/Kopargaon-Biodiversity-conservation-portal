const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

const target = "const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });";
const insert = target + `

const REELS_DIR = isVercel ? '/tmp/uploads/reels' : path.join(__dirname, 'uploads', 'reels');
if (!fs.existsSync(REELS_DIR)) { fs.mkdirSync(REELS_DIR, { recursive: true }); }
const reelStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, REELS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, \`reel_\${Date.now()}\${ext}\`);
  }
});
const uploadReel = multer({
  storage: reelStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['video/mp4', 'video/webm'];
    cb(null, allowed.includes(file.mimetype));
  }
});
`;

code = code.replace(target, insert);

fs.writeFileSync('backend/server.js', code, 'utf8');
console.log('Backend patched with uploadReel');
