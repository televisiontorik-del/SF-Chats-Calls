const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ১. আপনার জেনারেট করা VAPID Public এবং Private Key এখানে বসান
const publicVapidKey = 'BB_K6tdg8l_tWS6-z0MT2dTRJqf07hIpDGeF5wlGHvemkGwkLpkSoJtKLKq-s2kJKl8JgLGdNXzXNADRskNC5ms';
const privateVapidKey = '8InEo0Rge5Qen4MLOjFTYaJkuAk7LvZA2GzM5sbeqms';

webpush.setVapidDetails(
    'mailto:admin@sfchatapp.com',
    publicVapidKey,
    privateVapidKey
);

// ইউজারদের ডিভাইস সাবস্ক্রিপশন জমা রাখার মেমোরি (ফোন নম্বর অনুযায়ী)
const userSubscriptions = {};

// ২. অ্যাপ থেকে ইউজারের সাবস্ক্রিপশন সেভ করার API
app.post('/subscribe', (req, res) => {
    const { phone, subscription } = req.body;
    if (phone && subscription) {
        userSubscriptions[phone] = subscription;
        console.log(`নতুন ডিভাইস যুক্ত হয়েছে: ${phone}`);
        res.status(201).json({ message: 'Subscription saved!' });
    } else {
        res.status(400).json({ error: 'Phone or subscription missing' });
    }
});

// ৩. মেসেজ বা কল এলে অন্য ইউজারের ফোনে পুশ নোটিফিকেশন পাঠানোর API
app.post('/send-notification', (req, res) => {
    const { targetPhone, title, body, type } = req.body;
    const subscription = userSubscriptions[targetPhone];

    if (!subscription) {
        return res.status(404).json({ error: 'Target user not subscribed' });
    }

    const payload = JSON.stringify({ title, body, type });

    webpush.sendNotification(subscription, payload)
        .then(() => res.status(200).json({ success: true }))
        .catch(err => {
            console.error('Push Error:', err);
            res.status(500).json({ error: 'Failed to send push' });
        });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Push Server চলছে পোর্ট ${PORT}-এ`));
