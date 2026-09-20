// ============================================================
//  🔔 firebase-messaging-sw.js
//  Service Worker لاستقبال الإشعارات في الخلفية حتى لو التطبيق مغلق
//  ⚠️ يجب أن يكون في جذر الموقع (root)
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

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// ============================================================
//  استقبال الرسائل في الخلفية (التطبيق مغلق أو في الخلفية)
// ============================================================
messaging.onBackgroundMessage((payload) => {
    console.log('📬 [SW] رسالة في الخلفية:', payload);

    const n = payload.notification || {};
    const d = payload.data || {};
    const title = n.title || d.title || 'فيسي برو';
    const body  = n.body  || d.body  || 'لديك إشعار جديد';
    const icon  = d.icon  || 'https://cdn-icons-png.flaticon.com/512/847/847969.png';

    const options = {
        body: body,
        icon: icon,
        badge: 'https://cdn-icons-png.flaticon.com/512/847/847969.png',
        dir: 'rtl',
        lang: 'ar',
        tag: d.tag || 'vissypro-' + Date.now(),
        renotify: true,
        requireInteraction: false,
        vibrate: [200, 100, 200],
        data: {
            url: d.url || '/',
            type: d.type || 'general',
            ...d
        }
    };

    return self.registration.showNotification(title, options);
});

// ============================================================
//  عند الضغط على الإشعار
// ============================================================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
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
//  تفعيل فوري للـ Service Worker
// ============================================================
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});
