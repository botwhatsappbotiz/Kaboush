(function () {
  const config = window.KABOUSH_FIREBASE_CONFIG || {};
  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'ownerUid'];
  const isConfigured = requiredKeys.every(key =>
    typeof config[key] === 'string'
    && config[key].length > 0
    && !config[key].startsWith('ADD_FIREBASE_')
  );

  if (!isConfigured || !window.firebase) {
    window.KABOUSH_STORE = {
      isConfigured: false,
      configurationMessage: !window.firebase
        ? 'تعذر تحميل مكتبة Firebase. تحقق من اتصال الإنترنت وإعدادات الموقع.'
        : 'أضف إعدادات Firebase ومعرّف حساب الإدارة إلى firebase-config.js لتفعيل المزامنة.'
    };
    return;
  }

  const { ownerUid, ...firebaseConfig } = config;
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth ? firebase.auth() : null;
  const db = firebase.firestore();
  const storage = firebase.storage ? firebase.storage() : null;
  const productCollection = db.collection('products');
  const categoryCollection = db.collection('categories');
  const offerCollection = db.collection('offers');
  const settingsRef = db.collection('store').doc('settings');
  const initializedRef = db.collection('store').doc('catalogInitialized');

  function categoryDocumentId(name) {
    return Array.from(new TextEncoder().encode(name), byte =>
      byte.toString(16).padStart(2, '0')
    ).join('');
  }

  function productDocumentId(id) {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) {
      throw new Error('كود المنتج يجب أن يحتوي على أحرف إنجليزية أو أرقام أو شرطة فقط.');
    }
    return id;
  }

  function offerDocumentId(id) {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) {
      throw new Error('معرّف العرض غير صالح.');
    }
    return id;
  }

  function imageReference(path) {
    if (!storage) {
      throw new Error('تعذر تحميل مكتبة Firebase Storage.');
    }
    return storage.ref().child(path);
  }

  async function uploadImage(productId, blob) {
    const safeId = productDocumentId(productId);
    const path = `products/${safeId}/${Date.now()}-${crypto.randomUUID()}.jpg`;
    const snapshot = await imageReference(path).put(blob, { contentType: 'image/jpeg' });
    return { url: await snapshot.ref.getDownloadURL(), path };
  }

  async function uploadOfferImage(offerId, blob) {
    const safeId = offerDocumentId(offerId);
    const path = `offers/${safeId}/${Date.now()}-${crypto.randomUUID()}.jpg`;
    const snapshot = await imageReference(path).put(blob, { contentType: 'image/jpeg' });
    return { url: await snapshot.ref.getDownloadURL(), path };
  }

  async function deleteImage(path) {
    if (path) await imageReference(path).delete();
  }

  async function saveProduct(oldId, product) {
    const newId = productDocumentId(product.id);
    const previous = oldId ? await productCollection.doc(productDocumentId(oldId)).get() : null;
    const batch = db.batch();
    batch.set(productCollection.doc(newId), product);
    if (product.category) {
      batch.set(categoryCollection.doc(categoryDocumentId(product.category)), { name: product.category });
    }
    if (oldId && oldId !== newId) {
      batch.delete(productCollection.doc(productDocumentId(oldId)));
    }
    await batch.commit();

    const oldImagePath = previous && previous.exists ? previous.data().imagePath : '';
    let imageCleanupFailed = false;
    if (oldImagePath && oldImagePath !== product.imagePath) {
      try {
        await deleteImage(oldImagePath);
      } catch {
        imageCleanupFailed = true;
      }
    }
    return { imageCleanupFailed };
  }

  async function removeProduct(id) {
    const ref = productCollection.doc(productDocumentId(id));
    const snapshot = await ref.get();
    await ref.delete();
    const path = snapshot.exists ? snapshot.data().imagePath : '';
    let imageCleanupFailed = false;
    if (path) {
      try {
        await deleteImage(path);
      } catch {
        imageCleanupFailed = true;
      }
    }
    return { imageCleanupFailed };
  }

  async function saveCategory(name) {
    await categoryCollection.doc(categoryDocumentId(name)).set({ name });
  }

  async function removeCategory(name) {
    await categoryCollection.doc(categoryDocumentId(name)).delete();
  }

  async function saveOffer(offer) {
    const previous = await offerCollection.doc(offerDocumentId(offer.id)).get();
    await offerCollection.doc(offerDocumentId(offer.id)).set(offer);
    const oldImagePath = previous.exists ? previous.data().imagePath : '';
    let imageCleanupFailed = false;
    if (oldImagePath && oldImagePath !== offer.imagePath) {
      try {
        await deleteImage(oldImagePath);
      } catch {
        imageCleanupFailed = true;
      }
    }
    return { imageCleanupFailed };
  }

  async function removeOffer(id) {
    const ref = offerCollection.doc(offerDocumentId(id));
    const snapshot = await ref.get();
    await ref.delete();
    const path = snapshot.exists ? snapshot.data().imagePath : '';
    let imageCleanupFailed = false;
    if (path) {
      try {
        await deleteImage(path);
      } catch {
        imageCleanupFailed = true;
      }
    }
    return { imageCleanupFailed };
  }

  async function initializeCatalogIfNeeded(candidateProducts, candidateCategories, candidateSettings) {
    const marker = await initializedRef.get();
    if (marker.exists && marker.data().complete === true) return false;

    // لا نفترض أن المجموعة فارغة لمجرد وجود مستند تجريبي مثل products/initial.
    // نضيف المنتجات المحلية الناقصة فقط، ولا نستبدل أي منتج موجود على السحابة.
    const existingSnapshot = await productCollection.get();
    const existingIds = new Set(existingSnapshot.docs.map(doc => doc.id));
    const savedSettings = await settingsRef.get();
    const safeProducts = Array.isArray(candidateProducts) ? candidateProducts : [];
    const categoryNames = new Set([
      ...(Array.isArray(candidateCategories) ? candidateCategories : []),
      ...safeProducts.map(product => product && product.category).filter(Boolean)
    ]);

    const batch = db.batch();
    let seededCount = 0;
    for (const product of safeProducts) {
      if (!product || !product.id || existingIds.has(String(product.id))) continue;
      const { image, ...fields } = product;
      let sharedImage = image;
      let imagePath = product.imagePath || '';
      if (typeof image === 'string' && image.startsWith('data:image/')) {
        const blob = await fetch(image).then(response => response.blob());
        const uploaded = await uploadImage(product.id, blob);
        sharedImage = uploaded.url;
        imagePath = uploaded.path;
      }
      batch.set(productCollection.doc(productDocumentId(String(product.id))), {
        ...fields,
        image: sharedImage || '',
        imagePath
      });
      seededCount += 1;
    }

    for (const name of categoryNames) {
      batch.set(categoryCollection.doc(categoryDocumentId(name)), { name });
    }
    if (!savedSettings.exists && candidateSettings && Object.keys(candidateSettings).length) {
      batch.set(settingsRef, candidateSettings);
    }
    batch.set(initializedRef, { complete: true, seededCount, completedAt: firebase.firestore.FieldValue.serverTimestamp() });
    await batch.commit();
    return seededCount > 0;
  }

  window.KABOUSH_STORE = {
    isConfigured: true,
    configurationMessage: '',
    auth,
    db,
    signIn: (email, password) => auth.signInWithEmailAndPassword(email, password),
    signOut: () => auth.signOut(),
    uploadImage,
    uploadOfferImage,
    deleteImage,
    saveProduct,
    removeProduct,
    saveCategory,
    removeCategory,
    saveOffer,
    removeOffer,
    initializeCatalogIfNeeded,
    watchProducts: (next, error) => productCollection.onSnapshot(
      snapshot => next(snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(product => product.name && Number.isFinite(Number(product.price)))),
      error
    ),
    watchCategories: (next, error) => categoryCollection.onSnapshot(
      snapshot => next(snapshot.docs.map(doc => doc.data().name).filter(Boolean)),
      error
    ),
    watchOffers: (next, error) => offerCollection.onSnapshot(
      snapshot => next(snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(product => product.name && Number.isFinite(Number(product.price)))),
      error
    ),
    watchSettings: (next, error) => settingsRef.onSnapshot(
      snapshot => next(snapshot.exists ? snapshot.data() : {}),
      error
    ),
    saveSettings: settings => settingsRef.set(settings)
  };
})();
