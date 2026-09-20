// ============================================================
//  🔔 firebase-messaging-sw.js
//  Service Worker لاستقبال الإشعارات في الخلفية حتى لو التطبيق مغلق
//  عند الضغط على الإشعار يفتح: https://fisi-pro.vercel.app
// ============================================================

importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

const firebaseConfig = {
    apiKey: "AIzaSyB5qXJOOIMs3rWwxRjDai2enpCC4UUfyR4",
    authDomain: "kiot-1ea8c.firebaseapp.com",
    databaseURL: "https://kiot-1ea8c-default-rtdb.firebaseio.com",
    projectId: "kiot-1ea8c",
    storageBucket: "kiot-1ea8c.firebasestorage.app",
    messagingSenderId: "986566989634",
    appId: "1:986566989634:web:4717e394006ba957da5adb",
    measurementId: "G-JG8KVD2F86"
};

const APP_URL = 'https://fisi-pro.vercel.app';
const DEFAULT_ICON = 'https://cdn-icons-png.flaticon.com/512/847/847969.png';

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// ============================================================
//  📬 استقبال الإشعارات في الخلفية (التطبيق مغلق/خلفية)
// ============================================================
messaging.onBackgroundMessage((payload) => {
    console.log('📬 [SW] رسالة في الخلفية:', payload);

    const n = payload.notification || {};
    const d = payload.data || {};

    const title = n.title || d.title || 'فيسي برو';
    const body  = n.body  || d.body  || 'لديك إشعار جديد';
    const icon  = n.icon  || d.icon  || DEFAULT_ICON;
    const url   = d.url   || APP_URL;

    const options = {
        body: body,
        icon: icon,
        badge: DEFAULT_ICON,
        dir: 'rtl',
        lang: 'ar',
        tag: d.tag || ('vissypro-' + (d.type || 'general') + '-' + Date.now()),
        renotify: true,
        requireInteraction: false,
        vibrate: [200, 100, 200],
        data: {
            url: url,
            type: d.type || 'general',
            fromUid: d.fromUid || '',
            ...d
        }
    };

    return self.registration.showNotification(title, options);
});

// ============================================================
//  🖱️ عند الضغط على الإشعار — فتح رابط التطبيق
// ============================================================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || APP_URL;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes('fisi-pro.vercel.app') && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

// ============================================================
//  ⚡ تفعيل فوري
// ============================================================
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));
