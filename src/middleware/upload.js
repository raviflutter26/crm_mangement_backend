const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * Where uploaded files land.
 *
 * A container filesystem is wiped on redeploy, so in production this must point
 * at a mounted persistent volume (set UPLOAD_DIR), or the app should be moved to
 * object storage. Left unset it falls back to ./uploads, which is correct for
 * local development and data loss anywhere else.
 */
const UPLOAD_ROOT = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(__dirname, '../../uploads');

const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

// Extensions that must never be written even if the client claims an allowed
// MIME type — the browser decides how to treat a file by extension when it is
// served back, so a .html or .svg here becomes stored XSS.
const BLOCKED_EXTENSIONS = new Set([
    '.html', '.htm', '.xhtml', '.svg', '.js', '.mjs', '.php', '.sh', '.exe',
]);

const storage = (subdir) => multer.diskStorage({
    // Callback form so the directory is created on demand. With a plain string,
    // multer fails the request if the folder does not exist yet — which is the
    // normal state on a fresh volume or a new deploy.
    destination: (req, file, cb) => {
        const dir = path.join(UPLOAD_ROOT, subdir);
        fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;
        const ext = path.extname(file.originalname).toLowerCase();

        if (BLOCKED_EXTENSIONS.has(ext)) {
            return cb(new Error('Unsupported file type.'));
        }
        // Never trust the client's filename for the stored name; only the
        // extension is carried over, and only after the checks above.
        cb(null, `${uniqueSuffix}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Unsupported file type.'));
    }
};

// Usage: uploadTo('employee-documents').single('file')
const uploadTo = (subdir) => multer({
    storage: storage(subdir),
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

module.exports = { uploadTo, UPLOAD_ROOT };
