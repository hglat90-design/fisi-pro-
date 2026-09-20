// ============================================================
//  🔔 firebase-messaging-sw.js
//  Service Worker — يستقبل الإشعارات حتى لو التطبيق مغلق تماماً
//  يعمل في الخلفية ويُظهر الإشعارات في شريط التنبيهات
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
//  📬 استقبال الإشعارات في الخلفية — يعمل والشاشة مغلقة
// ============================================================
messaging.onBackgroundMessage((payload) => {
    console.log('📬 [SW] رسالة في الخلفية:', payload);

    const n = payload.notification || {};
    const d = payload.data || {};

    const title = n.title || d.title || 'فيسي برو';
    const body  = n.body  || d.body  || 'لديك إشعار جديد';
    const icon  = n.icon  || d.icon  || DEFAULT_ICON;
    const url   = d.url   || APP_URL;
    const type  = d.type  || 'general';

    // اختيار أيقونة الإشعار حسب النوع
    let emojiPrefix = '';
    if (type === 'dm') emojiPrefix = '💌 ';
    else if (type === 'chat') emojiPrefix = '💬 ';
    else if (type === 'new_status') emojiPrefix = '📸 ';
    else if (type === 'status_seen') emojiPrefix = '👁️ ';
    else if (type === 'report') emojiPrefix = '🚩 ';

    const options = {
        body: body,
        icon: icon,
        badge: DEFAULT_ICON,
        dir: 'rtl',
        lang: 'ar',
        tag: d.tag || ('vissypro-' + type + '-' + Date.now()),
        renotify: true,
        requireInteraction: false,
        silent: false,
        vibrate: [200, 100, 200, 100, 200],
        timestamp: Date.now(),
        data: {
            url: url,
            type: type,
            fromUid: d.fromUid || '',
            fromName: d.fromName || '',
            ...d
        },
        actions: [
            { action: 'open', title: '📱 فتح التطبيق' },
            { action: 'close', title: '✕ إغلاق' }
        ]
    };

    return self.registration.showNotification(emojiPrefix + title, options);
});

// ============================================================
//  🖱️ عند الضغط على الإشعار — فتح التطبيق
// ============================================================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'close') return;

    const data = event.notification.data || {};
    let targetUrl = data.url || APP_URL;

    // إضافة باراميتر لفتح القسم المناسب
    if (data.type === 'dm' && data.fromUid) {
        targetUrl += (targetUrl.includes('?') ? '&' : '?') + 'open_dm=' + data.fromUid;
    } else if (data.type === 'new_status') {
        targetUrl += (targetUrl.includes('?') ? '&' : '?') + 'open_tab=status';
    } else if (data.type === 'chat') {
        targetUrl += (targetUrl.includes('?') ? '&' : '?') + 'open_tab=chat';
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes('fisi-pro.vercel.app') && 'focus' in client) {
                    client.postMessage({
                        type: 'NOTIFICATION_CLICKED',
                        data: data
                    });
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
//  ⚡ تفعيل فوري للـ Service Worker
// ============================================================
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));
