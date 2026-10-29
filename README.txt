KABOUSH Mobile-First Store Website
====================================

Files:
- index.html: website structure (Arabic, RTL).
- styles.css: responsive mobile-first styling.
- app.js: product catalog, category filters, cart, WhatsApp booking, store settings.
- manifest.json: basic PWA metadata.

Preview:
Open index.html in a browser. Internet access is needed for the remote product photos.

Important:
1. Initial products and prices are demo examples, not verified inventory or current store prices.
2. Enter the real WhatsApp number in the store management section. Use country code 20 and digits only, for example 201XXXXXXXXX.
3. Product/settings/cart data are saved only in the current browser using localStorage. This is a prototype, not a secure production admin system.
4. Before public launch, connect a backend/database, cloud image storage, and authenticated admin access.
5. The Google Maps directions button uses the coordinates supplied in the conversation: 26.1591885, 32.7239556.

To publish:
Upload all four files to any static hosting service. For installable PWA behavior, serve through HTTPS and add icons/service worker before production.
