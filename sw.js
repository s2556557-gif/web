/**
 * MindFit Zen - PWA Service Worker (sw.js)
 * 提供離線運行能力、靜態資源快取、秒開體驗與安裝到主畫面標準支援
 */

const CACHE_NAME = 'mindfit-zen-v1.1';
const CORE_ASSETS = [
  './',
  './index.html',
  './diet.html',
  './fasting.html',
  './workouts.html',
  './trends.html',
  './profile.html',
  './landing.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon.svg'
];

// 1. 安裝階段：預快取核心靜態資源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] 部分核心資源快取失敗:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. 啟動階段：清理舊版本快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. 請求攔截：網路優先 (Network First) + 快取備援 (Cache Fallback)
self.addEventListener('fetch', (event) => {
  // 只攔截 GET 請求
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 本地資源優先嘗試網路，若斷網則自動使用快取
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 網路正常時複製最新版本至快取
          if (response && response.status === 200) {
            const respClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, respClone);
            });
          }
          return response;
        })
        .catch(() => {
          // 離線時從快取載入
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            // 若請求的是 HTML 頁面且快取無完全匹配，退回首頁
            if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
              return caches.match('./index.html');
            }
          });
        })
    );
  } else {
    // 外部字體或 CDN 資源：快取優先
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const respClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, respClone);
            });
          }
          return response;
        }).catch(() => {/* 靜默降級 */});
      })
    );
  }
});
