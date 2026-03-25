server.js



const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs-extra');
const nodemailer = require('nodemailer');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use('/downloads', express.static('downloads'));
app.use('/emails', express.static('emails'));

// Data directory
const DATA_DIR = './data';
const DOWNLOADS_DIR = './downloads/apps';
fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(DOWNLOADS_DIR);

// Download tracking
let downloadsDB = {};
if (fs.existsSync(`${DATA_DIR}/downloads.json`)) {
    downloadsDB = fs.readJsonSync(`${DATA_DIR}/downloads.json`);
}

// Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, DOWNLOADS_DIR),
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

// Email transporter (Gmail example - use your SMTP)
const transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
});

// Routes

// 1. Submit Email & Send Welcome
app.post('/api/submit-email', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            return res.status(400).json({ error: 'Invalid email' });
        }

        // Send welcome email
        await sendWelcomeEmail(email);
        
        // Track subscriber
        fs.appendFileSync(`${DATA_DIR}/subscribers.txt`, `${new Date().toISOString()},${email}\n`);
        
        res.json({ 
            success: true, 
            message: 'Welcome email sent! 🎉' 
        });
    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

// 2. Get Download Stats
app.get('/api/stats', (req, res) => {
    res.json({
        totalDownloads: Object.values(downloadsDB).reduce((sum, app) => sum + app.count, 0),
        totalSubscribers: require('fs').readFileSync(`${DATA_DIR}/subscribers.txt`, 'utf8').split('\n').length - 1,
        popularApps: Object.entries(downloadsDB)
            .sort(([,a], [,b]) => b.count - a.count)
            .slice(0, 5)
            .map(([app, data]) => ({ app, downloads: data.count }))
    });
});

// 3. Track Download
app.post('/api/track-download', (req, res) => {
    const { appName, email, platform } = req.body;
    
    if (!downloadsDB[appName]) {
        downloadsDB[appName] = { count: 0, platforms: {} };
    }
    
    downloadsDB[appName].count++;
    if (!downloadsDB[appName].platforms[platform]) {
        downloadsDB[appName].platforms[platform] = 0;
    }
    downloadsDB[appName].platforms[platform]++;
    
    fs.writeJsonSync(`${DATA_DIR}/downloads.json`, downloadsDB);
    
    // Log download
    console.log(`📥 Download: ${appName} by ${email} (${platform})`);
    
    res.json({ success: true });
});

// 4. List Available Apps
app.get('/api/apps', (req, res) => {
    const apps = fs.readdirSync(DOWNLOADS_DIR).map(file => ({
        name: path.parse(file).name,
        size: fs.statSync(path.join(DOWNLOADS_DIR, file)).size,
        platform: path.parse(file).name.includes('android') ? 'android' :
                 path.parse(file).name.includes('ios') ? 'ios' :
                 path.parse(file).name.includes('win') ? 'windows' : 'linux'
    }));
    
    res.json(apps);
});

// 5. Upload New App (Admin)
app.post('/api/upload-app', upload.single('appFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    res.json({
        success: true,
        file: req.file.filename,
        url: `/downloads/apps/${req.file.filename}`
    });
});

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Email Functions
async function sendWelcomeEmail(email) {
    const mailOptions = {
        from: process.env.EMAIL_USER || 'noreply@apphub.com',
        to: email,
        subject: '🎉 Welcome to AppHub!',
        html: fs.readFileSync('./emails/welcome.html', 'utf8')
            .replace('{{EMAIL}}', email)
    };
    
    await transporter.sendMail(mailOptions);
}

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 AppHub Backend running on http://localhost:${PORT}`);
    console.log(`📊 Stats: http://localhost:${PORT}/api/stats`);
    console.log(`📥 Downloads: http://localhost:${PORT}/downloads`);
});
