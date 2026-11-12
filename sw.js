/* HHKB Resonance — Service Worker
   - 설치 시 앱 파일을 캐시 → 인터넷 없이도 실행
   - 페이지(index.html)는 네트워크 우선: 온라인이면 최신 버전을 받고, 오프라인이면 캐시로 실행
   - 아이콘 등 정적 파일은 캐시 우선
   이 파일을 고쳐서 배포할 때는 CACHE 버전 숫자를 올린다 (구버전 캐시 자동 정리).
   index.html만 고칠 때는 이 파일을 건드릴 필요가 없다. */
const CACHE = 'hhkb-resonance-v2';
const CORE = ['./', './index.html'];          // 없으면 설치 실패 (앱 본체)
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // 브라우저의 일반 캐시에 남은 옛 파일이 아니라 서버의 최신 파일을 받아 저장한다.
      const fresh = (u) => new Request(u, { cache: 'reload' });
      // 앱 본체는 반드시 캐시한다.
      await cache.addAll(CORE.map(fresh));
      // 나머지(아이콘 등)는 하나가 빠져도 설치를 막지 않는다.
      // 업로드할 때 icons 폴더를 빠뜨려도 오프라인 실행은 되게 하기 위함.
      const extras = ASSETS.filter((a) => !CORE.includes(a));
      await Promise.allSettled(extras.map((a) => cache.add(fresh(a))));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // 페이지 요청: 네트워크 우선 → 실패하면 캐시
  // cache: 'no-cache' 로 서버에 변경 여부를 매번 확인해, 새 버전을 올리면 바로 반영되게 한다.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request.url, { cache: 'no-cache' })
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // 정적 파일: 캐시 우선 → 없으면 네트워크
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
