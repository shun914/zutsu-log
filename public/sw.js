// 頭痛ログ Service Worker
// プッシュ通知の受信とクリックハンドリングを担当する

const CACHE_NAME = 'zutsu-log-v1';

// ---- インストール -----------------------------------------------

self.addEventListener('install', () => {
  // 即座にアクティブ化する（待機をスキップ）
  self.skipWaiting();
});

// ---- アクティベート ---------------------------------------------

self.addEventListener('activate', (event) => {
  // 古いキャッシュを削除する
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ---- プッシュ通知の受信 ----------------------------------------

self.addEventListener('push', (event) => {
  let data = { title: '頭痛ログ', body: '服薬の時間です 💊' };
  try {
    data = event.data?.json() ?? data;
  } catch {
    data.body = event.data?.text() ?? data.body;
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    '/icon-192.png',
      badge:   '/icon-192.png',
      tag:     'medication-reminder',
      renotify: true,
      data:    { url: data.url || '/' },
    })
  );
});

// ---- 通知タップ時の処理 ----------------------------------------

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // 既に開いているウィンドウがあればそこにフォーカス
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // なければ新しいウィンドウを開く
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
