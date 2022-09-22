'use strict';

const version = 'v0.044::';
const staticCacheName = version + 'static';

function updateStaticCache() {
    return caches.open(staticCacheName)
    .then( cache => {
        // These items won't block the installation of the Service Worker
        cache.addAll([
						'/android-chrome-192x192.png',
						'/android-chrome-512x512.png',
						'/apple-touch-icon.png',
						'/favicon.ico',
						'/favicon.svg',
						'/screenshot-1200x628.webp',
						'/maskable-icon-1024x1024.png',
            '/site.webmanifest'
        ]);
        // These items must be cached for the Service Worker to complete installation
        return cache.addAll([
            '/',
            '/offline/'
        ]);
    });
}

// Remove caches whose name is no longer valid
function clearOldCaches() {
    return caches.keys()
    .then( keys => {
        return Promise.all(keys
            .filter(key => key.indexOf(version) !== 0)
            .map(key => caches.delete(key))
        );
    });
}

self.addEventListener('install', event => {
    event.waitUntil(
        updateStaticCache()
        .then( () => self.skipWaiting() )
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        clearOldCaches()
        .then( () => self.clients.claim() )
    );
});

self.addEventListener('fetch', event => {
    let request = event.request;
    // Look in the cache first, fall back to the network
    event.respondWith(
        // CACHE
        caches.match(request)
        .then( responseFromCache => {
            // Did we find the file in the cache?
            if (responseFromCache) {
                // If so, fetch a fresh copy from the network in the background
                event.waitUntil(
                    // NETWORK
                    fetch(request)
                    .then( responseFromFetch => {
                        // Stash the fresh copy in the cache
                        caches.open(staticCacheName)
                        .then( cache => {
                            cache.put(request, responseFromFetch);
                        });
                    })
                );
                return responseFromCache
            }
            // NETWORK
            // If the file wasn’t in the cache, make a network request
            return fetch(request)
            .then( responseFromFetch => {
                // Stash a fresh copy in the cache in the background
                let responseCopy = responseFromFetch.clone();
                event.waitUntil(
                    caches.open(staticCacheName)
                    .then( cache => {
                        cache.put(request, responseCopy);
                    })
                );
                return responseFromFetch;
            })
            .catch( () => {
                // OFFLINE
                // If the request is for an image, show an offline placeholder
                if (request.headers.get('Accept').includes('image')) {
                    return new Response(
                        '<svg role="img" aria-labelledby="offline-title" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg"><title id="offline-title">Offline</title><g fill="none" fill-rule="evenodd"><path fill="#D8D8D8" d="M0 0h400v300H0z"/><text fill="#9B9B9B" font-family="Helvetica Neue,Arial,Helvetica,sans-serif" font-size="72" font-weight="bold"><tspan x="93" y="172">offline</tspan></text></g></svg>',
                        {
                            headers: {
                                'Content-Type': 'image/svg+xml',
                                'Cache-Control': 'no-store'
                            }
                        }
                    );
                }
                // If the request is for a page, show an offline message
                if (request.headers.get('Accept').includes('text/html')) {
                    return caches.match('/offline/');
                }
            })
        })
    );
});
