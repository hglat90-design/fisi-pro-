// ============================================================
//  🔥 Firebase Cloud Functions
//  يعمل على خوادم Google — يرسل الإشعارات تلقائياً حتى لو التطبيق مغلق
//  يستخدم FCM HTTP v1 API (الطريقة الحديثة والآمنة)
// ============================================================

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.database();

const APP_URL = 'https://fisi-pro.vercel.app';
const DEFAULT_ICON = 'https://cdn-icons-png.flaticon.com/512/847/847969.png';

// ============================================================
//  🛠️ دوال مساعدة
// ============================================================

// جلب توكن المستخدم
async function getUserToken(uid) {
    if (!uid) return null;
    try {
        const snap = await db.ref('fcm_tokens/' + uid + '/token').once('value');
        return snap.val() || null;
    } catch (e) {
        console.error('⚠️ فشل جلب التوكن:', e);
        return null;
    }
}

// جلب تفضيلات الإشعارات
async function getUserPrefs(uid) {
    try {
        const snap = await db.ref('notification_prefs/' + uid).once('value');
        const d = snap.val() || {};
        return {
            dm: d.dm !== false,
            chat: d.chat !== false,
            status: d.status !== false,
            seen: d.seen !== false
        };
    } catch (e) {
        return { dm: true, chat: true, status: true, seen: true };
    }
}

// إرسال إشعار لمستخدم واحد
async function sendToUser(uid, title, body, icon, extraData) {
    const token = await getUserToken(uid);
    if (!token) {
        console.log('⚠️ لا يوجد توكن:', uid);
        return false;
    }

    const message = {
        token: token,
        notification: {
            title: title,
            body: body
        },
        data: Object.assign({
            title: title,
            body: body,
            icon: icon || DEFAULT_ICON,
            url: APP_URL,
            type: 'general'
        }, extraData || {}),
        android: {
            priority: 'high',
            notification: {
                title: title,
                body: body,
                icon: icon || DEFAULT_ICON,
                sound: 'default',
                channelId: 'fisi_pro_channel'
            }
        },
        webpush: {
            headers: { Urgency: 'high' },
            notification: {
                title: title,
                body: body,
                icon: icon || DEFAULT_ICON,
                badge: DEFAULT_ICON,
                dir: 'rtl',
                lang: 'ar',
                vibrate: [200, 100, 200, 100, 200],
                requireInteraction: false,
                silent: false
            },
            fcm_options: { link: APP_URL }
        }
    };

    try {
        const response = await admin.messaging().send(message);
        console.log('✅ أُرسل لـ', uid, '→', response);
        return true;
    } catch (e) {
        console.error('❌ فشل لـ', uid, ':', e.message);
        if (e.code === 'messaging/registration-token-not-registered' ||
            e.code === 'messaging/invalid-registration-token') {
            await db.ref('fcm_tokens/' + uid).remove();
            console.log('🗑️ حُذف توكن غير صالح:', uid);
        }
        return false;
    }
}

// إرسال إشعار جماعي
async function sendToAll(title, body, icon, extraData, excludeUid, prefType) {
    try {
        const tokensSnap = await db.ref('fcm_tokens').once('value');
        if (!tokensSnap.exists()) return;

        const promises = [];
        tokensSnap.forEach(child => {
            const uid = child.key;
            if (uid === excludeUid) return;
            const token = child.val().token;
            if (!token) return;

            promises.push(
                getUserPrefs(uid).then(prefs => {
                    if (prefType && prefs[prefType] === false) return;
                    const message = {
                        token: token,
                        notification: { title: title, body: body },
                        data: Object.assign({
                            title: title,
                            body: body,
                            icon: icon || DEFAULT_ICON,
                            url: APP_URL,
                            type: prefType || 'general'
                        }, extraData || {}),
                        android: {
                            priority: 'high',
                            notification: {
                                title: title,
                                body: body,
                                icon: icon || DEFAULT_ICON,
                                sound: 'default',
                                channelId: 'fisi_pro_channel'
                            }
                        },
                        webpush: {
                            headers: { Urgency: 'high' },
                            notification: {
                                title: title,
                                body: body,
                                icon: icon || DEFAULT_ICON,
                                badge: DEFAULT_ICON,
                                dir: 'rtl',
                                lang: 'ar',
                                vibrate: [200, 100, 200],
                                silent: false
                            },
                            fcm_options: { link: APP_URL }
                        }
                    };
                    return admin.messaging().send(message).catch(async (e) => {
                        if (e.code === 'messaging/registration-token-not-registered' ||
                            e.code === 'messaging/invalid-registration-token') {
                            await db.ref('fcm_tokens/' + uid).remove();
                        }
                    });
                })
            );
        });
        await Promise.all(promises);
    } catch (e) {
        console.error('⚠️ فشل الإشعارات الجماعية:', e);
    }
}

// ============================================================
//  1️⃣ رسالة خاصة جديدة → إشعار للمستقبل
// ============================================================
exports.notifyNewDM = functions.database
    .ref('/private_chats/{chatId}/messages/{msgId}')
    .onCreate(async (snap, context) => {
        const msg = snap.val();
        if (!msg) return null;

        const toUid = msg.to;
        const fromUid = msg.from;
        if (!toUid || toUid === fromUid) return null;

        const prefs = await getUserPrefs(toUid);
        if (prefs.dm === false) return null;

        const senderName = msg.fromName || 'مجهول';
        const text = msg.text || '';
        const preview = text.length > 60 ? text.substring(0, 60) + '...' : text;

        await sendToUser(
            toUid,
            '💌 ' + senderName,
            preview,
            msg.fromAvatar || DEFAULT_ICON,
            {
                type: 'dm',
                fromUid: fromUid,
                fromName: senderName,
                tag: 'dm-' + context.params.msgId,
                url: APP_URL
            }
        );

        return null;
    });

// ============================================================
//  2️⃣ رسالة عامة جديدة → إشعار للجميع
// ============================================================
exports.notifyNewChatMessage = functions.database
    .ref('/messages/{msgId}')
    .onCreate(async (snap, context) => {
        const msg = snap.val();
        if (!msg) return null;

        const senderUid = msg.uid;
        const senderName = msg.sender || 'مجهول';
        const text = msg.text || '';

        if (!text && !msg.media) return null;
        const preview = text ? (text.length > 60 ? text.substring(0, 60) + '...' : text) : '📎 وسائط';

        await sendToAll(
            '💬 ' + senderName,
            preview,
            msg.avatar || DEFAULT_ICON,
            {
                type: 'chat',
                fromUid: senderUid,
                fromName: senderName,
                tag: 'chat-' + context.params.msgId,
                url: APP_URL
            },
            senderUid,
            'chat'
        );

        return null;
    });

// ============================================================
//  3️⃣ حالة جديدة → إشعار للجميع
// ============================================================
exports.notifyNewStatus = functions.database
    .ref('/statuses/{statusId}')
    .onCreate(async (snap, context) => {
        const status = snap.val();
        if (!status) return null;

        const senderUid = status.uid;
        const senderName = status.sender || 'مجهول';
        const text = status.text || '';
        const preview = text ? (text.length > 60 ? text.substring(0, 60) + '...' : text) : '📸 حالة جديدة';

        await sendToAll(
            '📸 ' + senderName + ' نشر حالة',
            preview,
            status.avatar || DEFAULT_ICON,
            {
                type: 'new_status',
                fromUid: senderUid,
                fromName: senderName,
                tag: 'status-' + context.params.statusId,
                url: APP_URL
            },
            senderUid,
            'status'
        );

        return null;
    });

// ============================================================
//  4️⃣ مشاهدة حالة → إشعار لصاحبها
// ============================================================
exports.notifyStatusSeen = functions.database
    .ref('/statuses/{statusId}/seenBy/{viewerUid}')
    .onCreate(async (snap, context) => {
        const viewerData = snap.val();
        if (!viewerData) return null;

        const statusId = context.params.statusId;
        const viewerUid = context.params.viewerUid;

        const statusSnap = await db.ref('statuses/' + statusId).once('value');
        const status = statusSnap.val();
        if (!status) return null;

        const ownerUid = status.uid;
        if (!ownerUid || ownerUid === viewerUid) return null;

        const prefs = await getUserPrefs(ownerUid);
        if (prefs.seen === false) return null;

        const viewerName = viewerData.name || 'مجهول';
        const statusPreview = status.text ? (status.text.length > 40 ? status.text.substring(0, 40) + '...' : status.text) : '📸 حالتك';

        await sendToUser(
            ownerUid,
            '👁️ ' + viewerName + ' شاهد حالتك',
            statusPreview,
            viewerData.avatar || DEFAULT_ICON,
            {
                type: 'status_seen',
                fromUid: viewerUid,
                fromName: viewerName,
                tag: 'seen-' + statusId + '-' + viewerUid,
                url: APP_URL
            }
        );

        return null;
    });

// ============================================================
//  5️⃣ بلاغ جديد → إشعار للمالك
// ============================================================
exports.notifyNewReport = functions.database
    .ref('/reports/{reportId}')
    .onCreate(async (snap, context) => {
        const report = snap.val();
        if (!report) return null;

        const usersSnap = await db.ref('users').once('value');
        const owners = [];
        usersSnap.forEach(child => {
            if (child.val().role === 'owner') owners.push(child.key);
        });

        const promises = owners.map(ownerUid =>
            sendToUser(
                ownerUid,
                '🚩 بلاغ جديد',
                'من: ' + (report.reporterName || 'مجهول') + ' على: ' + (report.targetName || 'مجهول'),
                report.reporterAvatar || DEFAULT_ICON,
                {
                    type: 'report',
                    fromUid: report.reporterId,
                    tag: 'report-' + context.params.reportId,
                    url: APP_URL
                }
            )
        );

        await Promise.all(promises);
        return null;
    });

// ============================================================
//  6️⃣ تنظيف التوكنات القديمة يومياً
// ============================================================
exports.cleanupOldTokens = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async (context) => {
        const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const snap = await db.ref('fcm_tokens').once('value');
        const updates = {};
        snap.forEach(child => {
            const d = child.val();
            if (d.updatedAt && d.updatedAt < cutoff) {
                updates[child.key] = null;
                console.log('🗑️ حذف توكن قديم:', child.key);
            }
        });
        if (Object.keys(updates).length > 0) {
            await db.ref('fcm_tokens').update(updates);
        }
        return null;
    });
