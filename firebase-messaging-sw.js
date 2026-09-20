// ============================================================
//  🔔 firebase-messaging-sw.js
//  Service Worker — يستقبل الإشعارات حتى لو التطبيق مغلق تماماً
//  يعمل في الخلفية ويُظهر الإشعارات في شريط التنبيهات (Android/iOS/Desktop)
//  ⚠️ يجب أن يكون في جذر الموقع (root)
// ============================================================

// استيراد مكتبات Firebase الأساسية والمراسلة
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// ============================================================
//  ⚙️ إعدادات Firebase
// ============================================================
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

// ============================================================
//  🚀 تهيئة Firebase داخل Service Worker
// ============================================================
firebase.initializeApp(firebaseConfig);

// الحصول على كائن messaging
const messaging = firebase.messaging();

// ============================================================
//  📬 استقبال الإشعارات في الخلفية (التطبيق مغلق أو في الخلفية)
//  هذه الدالة الأهم — تعمل حتى لو التطبيق مغلق تماماً
// ============================================================
messaging.onBackgroundMessage((payload) => {
    console.log('📬 [SW] رسالة في الخلفية:', payload);

    // استخراج البيانات من payload
    const n = payload.notification || {};
    const d = payload.data || {};

    const title = n.title || d.title || 'فيسي برو';
    const body  = n.body  || d.body  || 'لديك إشعار جديد';
    const icon  = n.icon  || d.icon  || DEFAULT_ICON;
    const url   = d.url   || APP_URL;
    const type  = d.type  || 'general';

    // إضافة رمز تعبيري بادئ حسب نوع الإشعار
    let emojiPrefix = '';
    if (type === 'dm') emojiPrefix = '💌 ';
    else if (type === 'chat') emojiPrefix = '💬 ';
    else if (type === 'new_status') emojiPrefix = '📸 ';
    else if (type === 'status_seen') emojiPrefix = '👁️ ';
    else if (type === 'report') emojiPrefix = '🚩 ';
    else emojiPrefix = '🔔 ';

    // خيارات الإشعار
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

    // عرض الإشعار — يظهر في شريط التنبيهات العلوي
    return self.registration.showNotification(emojiPrefix + title, options);
});

// ============================================================
//  🖱️ عند الضغط على الإشعار — فتح التطبيق على القسم المناسب
// ============================================================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    // إذا ضغط على زر "إغلاق" — فقط أغلق الإشعار
    if (event.action === 'close') return;

    const data = event.notification.data || {};
    let targetUrl = data.url || APP_URL;

    // إضافة باراميتر لفتح القسم المناسب داخل التطبيق
    if (data.type === 'dm' && data.fromUid) {
        targetUrl += (targetUrl.includes('?') ? '&' : '?') + 'open_dm=' + data.fromUid;
    } else if (data.type === 'new_status') {
        targetUrl += (targetUrl.includes('?') ? '&' : '?') + 'open_tab=status';
    } else if (data.type === 'chat') {
        targetUrl += (targetUrl.includes('?') ? '&' : '?') + 'open_tab=chat';
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // إذا كان التطبيق مفتوح في تبويب — ركّز عليه وأرسل رسالة
            for (const client of clientList) {
                if (client.url.includes('fisi-pro.vercel.app') && 'focus' in client) {
                    client.postMessage({
                        type: 'NOTIFICATION_CLICKED',
                        data: data
                    });
                    return client.focus();
                }
            }
            // وإلا افتح تبويب جديد على الرابط
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

// ============================================================
//  🔄 عند إغلاق الإشعار (بدون ضغط) — لا نفعل شيء
// ============================================================
self.addEventListener('notificationclose', (event) => {
    console.log('🔕 تم إغلاق الإشعار:', event.notification.tag);
});

// ============================================================
//  ⚡ تفعيل فوري للـ Service Worker (بدون انتظار)
// ============================================================
self.addEventListener('install', (event) => {
    console.log('✅ Service Worker قيد التثبيت...');
    self.skipWaiting();
});

// السيطرة على جميع النوافذ بمجرد التفعيل
self.addEventListener('activate', (event) => {
    console.log('✅ Service Worker مُفعّل');
    event.waitUntil(clients.claim());
});

// ============================================================
//  📨 التعامل مع الرسائل الواردة من التطبيق (اختياري)
// ============================================================
self.addEventListener('message', (event) => {
    console.log('📨 [SW] رسالة من التطبيق:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
