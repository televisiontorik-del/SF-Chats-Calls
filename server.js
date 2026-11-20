const express = require('express');
const webpush = require('web-push');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ==================== ১. ওয়েব ব্রাউজারের জন্য VAPID Web Push সেটআপ (আগের ফিচার অক্ষুণ্ণ রাখা হয়েছে) ====================
const publicVapidKey = 'BB_K6tdg8l_tWS6-z0MT2dTRJqf07hIpDGeF5wlGHvemkGwkLpkSoJtKLKq-s2kJKl8JgLGdNXzXNADRskNC5ms';
const privateVapidKey = '8InEo0Rge5Qen4MLOjFTYaJkuAk7LvZA2GzM5sbeqms';

webpush.setVapidDetails(
    'mailto:admin@sfchatapp.com',
    publicVapidKey,
    privateVapidKey
);

// ==================== ২. Android অ্যাপের জন্য Firebase Admin সেটআপ (অ্যাপ বন্ধ থাকলেও কাজ করবে) ====================
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("Firebase Admin সফলভাবে যুক্ত হয়েছে!");
    } catch (e) {
        console.error("Firebase JSON পার্সিং ত্রুটি:", e);
    }
} else {
    console.log("সতর্কতা: FIREBASE_SERVICE_ACCOUNT পাওয়া যায়নি!");
}

// ইউজারদের সাবস্ক্রিপশন ও টোকেন জমা রাখার মেমোরি
const userWebSubscriptions = {};
const userFcmTokens = {};

// ওয়েব ব্রাউজার সাবস্ক্রাইব API
app.post('/subscribe', (req, res) => {
    const { phone, subscription } = req.body;
    if (phone && subscription) {
        userWebSubscriptions[phone] = subscription;
        console.log(`Web Push যুক্ত হয়েছে: ${phone}`);
        res.status(201).json({ message: 'Web Subscription saved!' });
    } else {
        res.status(400).json({ error: 'Phone or subscription missing' });
    }
});

// Android অ্যাপের FCM Token সেভ করার API
app.post('/register-fcm', (req, res) => {
    const { phone, fcmToken } = req.body;
    if (phone && fcmToken) {
        userFcmTokens[phone] = fcmToken;
        console.log(`Android FCM Token যুক্ত হয়েছে: ${phone}`);
        res.status(200).json({ success: true });
    } else {
        res.status(400).json({ error: 'Phone or fcmToken missing' });
    }
});

// মেসেজ বা কল এলে Android অ্যাপ এবং ওয়েব ব্রাউজার উভয় জায়গায় পুশ পাঠানোর API
app.post('/send-notification', async (req, res) => {
    const { targetPhone, title, body, type } = req.body;
    let sentAny = false;

    // ক) Android মোবাইল অ্যাপে Firebase High-Priority পুশ পাঠানো
    const fcmToken = userFcmTokens[targetPhone];
    if (fcmToken && admin.apps.length > 0) {
        // কলের জন্য Data-only হাই-প্রায়োরিটি মেসেজ (যাতে বন্ধ থাকা অ্যাপ নিজে থেকে চালু হয়)
        const isCall = (type === 'call');
        const message = {
            token: fcmToken,
            android: {
                priority: 'high'
            },
            data: {
                type: type || 'message',
                title: title || 'SF Chats & Calls',
                body: body || 'নতুন বার্তা এসেছে'
            }
        };

        // শুধুমাত্র সাধারণ মেসেজের ক্ষেত্রে সিস্টেম নোটিফিকেশন ব্লক যুক্ত হবে
        if (!isCall) {
            message.notification = {
                title: title || 'SF Chats & Calls',
                body: body || 'নতুন বার্তা এসেছে'
            };
            message.android.notification = {
                sound: 'default',
                channelId: 'default'
            };
        }

        try {
            await admin.messaging().send(message);
            console.log(`Android Push পাঠানো হয়েছে: ${targetPhone}`);
            sentAny = true;
        } catch (err) {
            console.error('Android FCM Error:', err);
        }
    }

    // খ) ওয়েব ব্রাউজারে VAPID Web Push পাঠানো (যদি থাকে)
    const webSub = userWebSubscriptions[targetPhone];
    if (webSub) {
        const payload = JSON.stringify({ title, body, type });
        try {
            await webpush.sendNotification(webSub, payload);
            console.log(`Web Push পাঠানো হয়েছে: ${targetPhone}`);
            sentAny = true;
        } catch (err) {
            console.error('Web Push Error:', err);
        }
    }

    if (sentAny) {
        res.status(200).json({ success: true });
    } else {
        res.status(404).json({ error: 'Target user not registered on Android or Web' });
    }
});

app.get('/', (req, res) => res.send('SF Chats & Calls Dual Push Server (Android FCM + Web Push) চলছে!'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Push Server চলছে পোর্ট ${PORT}-এ`));
