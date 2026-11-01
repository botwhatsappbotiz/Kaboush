(function () {
  const config = window.KABOUSH_SUPABASE_CONFIG || {};
  const bucket = config.storageBucket || 'store-images';

  function validValue(value) {
    return typeof value === 'string'
      && value.trim().length > 0
      && !value.trim().startsWith('ADD_SUPABASE_');
  }

  const isConfigured = validValue(config.url)
    && validValue(config.anonKey)
    && /^https?:\/\//i.test(config.url.trim());
  const library = window.supabase;

  if (!isConfigured || !library || typeof library.createClient !== 'function') {
    window.KABOUSH_STORE = {
      isConfigured: false,
      configurationMessage: !library || typeof library.createClient !== 'function'
        ? 'تعذر تحميل مكتبة Supabase. تحقق من اتصال الإنترنت وإعدادات الموقع.'
        : 'أضف رابط مشروع Supabase والمفتاح العام (anon key) إلى supabase-config.js لتفعيل المزامنة.'
    };
    return;
  }

  const client = library.createClient(config.url.trim().replace(/\/+$/, ''), config.anonKey.trim(), {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  // ---------------------------------------------------------------
  // أدوات مساعدة
  // ---------------------------------------------------------------
  function must(result) {
    if (result && result.error) throw result.error;
    return result ? result.data : null;
  }

  function productDocumentId(id) {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(String(id))) {
      throw new Error('كود المنتج يجب أن يحتوي على أحرف إنجليزية أو أرقام أو شرطة فقط.');
    }
    return String(id);
  }

  function offerDocumentId(id) {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(String(id))) {
      throw new Error('معرّف العرض غير صالح.');
    }
    return String(id);
  }

  // ---------------------------------------------------------------
  // تحويل بين شكل الجداول (snake_case) وشكل الموقع (camelCase)
  // ---------------------------------------------------------------
  function productFromRow(row) {
    return {
      id: row.id,
      name: row.name,
      category: row.category || '',
      price: Number(row.price),
      desc: row.description || '',
      image: row.image || '',
      imagePath: row.image_path || '',
      sizes: Array.isArray(row.sizes) && row.sizes.length ? row.sizes : undefined,
      colors: Array.isArray(row.colors) && row.colors.length ? row.colors : undefined
    };
  }

  function productToRow(product) {
    return {
      id: productDocumentId(product.id),
      name: product.name,
      price: Number(product.price),
      category: product.category || '',
      image: product.image || '',
      image_path: product.imagePath || '',
      description: product.desc || '',
      sizes: Array.isArray(product.sizes) ? product.sizes : [],
      colors: Array.isArray(product.colors) ? product.colors : []
    };
  }

  function offerFromRow(row) {
    return {
      id: row.id,
      title: row.title,
      description: row.description || '',
      image: row.image || '',
      imagePath: row.image_path || '',
      originalPrice: Number(row.original_price),
      discountedPrice: Number(row.discounted_price),
      discountPercent: Number(row.discount_percent || 0),
      startDate: row.start_date || '',
      endDate: row.end_date || '',
      sizes: Array.isArray(row.sizes) ? row.sizes : [],
      colors: Array.isArray(row.colors) ? row.colors : []
    };
  }

  function offerToRow(offer) {
    return {
      id: offerDocumentId(offer.id),
      title: offer.title,
      description: offer.description || '',
      image: offer.image || '',
      image_path: offer.imagePath || '',
      original_price: Number(offer.originalPrice),
      discounted_price: Number(offer.discountedPrice),
      discount_percent: Number(offer.discountPercent || 0),
      start_date: offer.startDate || null,
      end_date: offer.endDate || null,
      sizes: Array.isArray(offer.sizes) ? offer.sizes : [],
      colors: Array.isArray(offer.colors) ? offer.colors : []
    };
  }

  // ---------------------------------------------------------------
  // المراقبة (Realtime + تحديث فوري بعد أي حفظ)
  // ---------------------------------------------------------------
  const listeners = {
    products: new Set(),
    categories: new Set(),
    offers: new Set(),
    settings: new Set()
  };

  function notify(name) {
    listeners[name].forEach(refresh => refresh());
  }

  let channelCounter = 0;
  function watch(name, table, fetcher, next, error) {
    let active = true;
    let sequence = 0;

    async function refresh() {
      const current = ++sequence;
      try {
        const data = await fetcher();
        if (active && current === sequence) next(data);
      } catch (failure) {
        if (active && current === sequence && error) error(failure);
      }
    }

    listeners[name].add(refresh);
    refresh();

    let channel = null;
    try {
      channelCounter += 1;
      channel = client
        .channel(`kaboush-${name}-${channelCounter}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, refresh)
        .subscribe();
    } catch (failure) {
      console.warn('Supabase realtime unavailable:', failure);
    }

    return () => {
      active = false;
      listeners[name].delete(refresh);
      if (channel) client.removeChannel(channel);
    };
  }

  async function fetchProducts() {
    const rows = must(await client
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })) || [];
    return rows
      .map(productFromRow)
      .filter(product => product.name && Number.isFinite(Number(product.price)));
  }

  async function fetchCategories() {
    const rows = must(await client
      .from('categories')
      .select('name')
      .order('created_at', { ascending: true })
      .order('name', { ascending: true })) || [];
    return rows.map(row => row.name).filter(Boolean);
  }

  async function fetchOffers() {
    const rows = must(await client
      .from('offers')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })) || [];
    return rows
      .map(offerFromRow)
      .filter(offer => offer.title && Number.isFinite(offer.originalPrice));
  }

  async function fetchSettings() {
    const row = must(await client
      .from('store_settings')
      .select('data')
      .eq('id', 'settings')
      .maybeSingle());
    return row && row.data ? row.data : {};
  }

  // ---------------------------------------------------------------
  // الصور (Supabase Storage)
  // ---------------------------------------------------------------
  async function uploadToStorage(folder, safeId, blob) {
    const path = `${folder}/${safeId}/${Date.now()}-${crypto.randomUUID()}.jpg`;
    const result = await client.storage.from(bucket).upload(path, blob, {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
      upsert: false
    });
    if (result.error) throw result.error;
    const publicUrl = client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    return { url: publicUrl, path };
  }

  function uploadImage(productId, blob) {
    return uploadToStorage('products', productDocumentId(productId), blob);
  }

  function uploadOfferImage(offerId, blob) {
    return uploadToStorage('offers', offerDocumentId(offerId), blob);
  }

  async function deleteImage(path) {
    if (!path) return;
    const result = await client.storage.from(bucket).remove([path]);
    if (result.error) throw result.error;
  }

  async function cleanupImage(oldPath, newPath) {
    if (!oldPath || oldPath === newPath) return false;
    try {
      await deleteImage(oldPath);
      return false;
    } catch {
      return true;
    }
  }

  // ---------------------------------------------------------------
  // المنتجات
  // ---------------------------------------------------------------
  async function saveProduct(oldId, product) {
    const newId = productDocumentId(product.id);
    let oldImagePath = '';
    if (oldId) {
      const previous = must(await client
        .from('products')
        .select('image_path')
        .eq('id', productDocumentId(oldId))
        .maybeSingle());
      oldImagePath = previous ? previous.image_path || '' : '';
    }

    must(await client.from('products').upsert(productToRow(product), { onConflict: 'id' }));
    if (product.category) {
      must(await client
        .from('categories')
        .upsert({ name: product.category }, { onConflict: 'name', ignoreDuplicates: true }));
    }
    if (oldId && oldId !== newId) {
      must(await client.from('products').delete().eq('id', productDocumentId(oldId)));
    }

    const imageCleanupFailed = await cleanupImage(oldImagePath, product.imagePath || '');
    notify('products');
    notify('categories');
    return { imageCleanupFailed };
  }

  async function removeProduct(id) {
    const safeId = productDocumentId(id);
    const previous = must(await client
      .from('products')
      .select('image_path')
      .eq('id', safeId)
      .maybeSingle());
    must(await client.from('products').delete().eq('id', safeId));
    const imageCleanupFailed = await cleanupImage(previous ? previous.image_path || '' : '', '');
    notify('products');
    return { imageCleanupFailed };
  }

  // ---------------------------------------------------------------
  // الأقسام
  // ---------------------------------------------------------------
  async function saveCategory(name) {
    must(await client
      .from('categories')
      .upsert({ name }, { onConflict: 'name', ignoreDuplicates: true }));
    notify('categories');
  }

  async function removeCategory(name) {
    must(await client.from('categories').delete().eq('name', name));
    notify('categories');
  }

  // ---------------------------------------------------------------
  // العروض
  // ---------------------------------------------------------------
  async function saveOffer(offer) {
    const safeId = offerDocumentId(offer.id);
    const previous = must(await client
      .from('offers')
      .select('image_path')
      .eq('id', safeId)
      .maybeSingle());
    must(await client.from('offers').upsert(offerToRow(offer), { onConflict: 'id' }));
    const imageCleanupFailed = await cleanupImage(
      previous ? previous.image_path || '' : '',
      offer.imagePath || ''
    );
    notify('offers');
    return { imageCleanupFailed };
  }

  async function removeOffer(id) {
    const safeId = offerDocumentId(id);
    const previous = must(await client
      .from('offers')
      .select('image_path')
      .eq('id', safeId)
      .maybeSingle());
    must(await client.from('offers').delete().eq('id', safeId));
    const imageCleanupFailed = await cleanupImage(previous ? previous.image_path || '' : '', '');
    notify('offers');
    return { imageCleanupFailed };
  }

  // ---------------------------------------------------------------
  // الإعدادات (واتساب / الهاتف / المواعيد)
  // ---------------------------------------------------------------
  async function saveSettings(settings) {
    must(await client
      .from('store_settings')
      .upsert({ id: 'settings', data: settings, updated_at: new Date().toISOString() }, { onConflict: 'id' }));
    notify('settings');
  }

  // ---------------------------------------------------------------
  // نقل الكتالوج المحلي إلى القاعدة عند أول دخول للإدارة
  // ---------------------------------------------------------------
  async function initializeCatalogIfNeeded(candidateProducts, candidateCategories, candidateSettings) {
    const marker = must(await client
      .from('store_settings')
      .select('data')
      .eq('id', 'catalogInitialized')
      .maybeSingle());
    if (marker && marker.data && marker.data.complete === true) return false;

    const existing = must(await client.from('products').select('id')) || [];
    const existingIds = new Set(existing.map(row => row.id));
    const savedSettings = must(await client
      .from('store_settings')
      .select('id')
      .eq('id', 'settings')
      .maybeSingle());

    const safeProducts = Array.isArray(candidateProducts) ? candidateProducts : [];
    const categoryNames = new Set([
      ...(Array.isArray(candidateCategories) ? candidateCategories : []),
      ...safeProducts.map(product => product && product.category).filter(Boolean)
    ]);

    const rows = [];
    const baseTime = Date.now();
    for (const product of safeProducts) {
      if (!product || !product.id || existingIds.has(String(product.id))) continue;
      let image = product.image || '';
      let imagePath = product.imagePath || '';
      if (typeof image === 'string' && image.startsWith('data:image/')) {
        const blob = await fetch(image).then(response => response.blob());
        const uploaded = await uploadImage(product.id, blob);
        image = uploaded.url;
        imagePath = uploaded.path;
      }
      const row = productToRow({ ...product, image, imagePath });
      row.created_at = new Date(baseTime - rows.length * 1000).toISOString();
      rows.push(row);
    }

    if (rows.length) {
      must(await client.from('products').upsert(rows, { onConflict: 'id', ignoreDuplicates: true }));
    }
    if (categoryNames.size) {
      must(await client
        .from('categories')
        .upsert([...categoryNames].map(name => ({ name })), { onConflict: 'name', ignoreDuplicates: true }));
    }
    if (!savedSettings && candidateSettings && Object.keys(candidateSettings).length) {
      must(await client
        .from('store_settings')
        .upsert({ id: 'settings', data: candidateSettings }, { onConflict: 'id', ignoreDuplicates: true }));
    }
    must(await client.from('store_settings').upsert({
      id: 'catalogInitialized',
      data: { complete: true, seededCount: rows.length, completedAt: new Date().toISOString() }
    }, { onConflict: 'id' }));

    notify('products');
    notify('categories');
    notify('settings');
    return rows.length > 0;
  }

  // ---------------------------------------------------------------
  // تسجيل الدخول (بريد + كلمة مرور من Supabase Auth)
  // ---------------------------------------------------------------
  const auth = {
    onAuthStateChanged(next, error) {
      let lastUid;
      let stopped = false;
      const emit = user => {
        const uid = user ? user.id : null;
        if (uid === lastUid) return;
        lastUid = uid;
        // نؤجل الاستدعاء لتفادي استدعاء Supabase من داخل حدث المصادقة نفسه
        window.setTimeout(() => {
          if (!stopped) next(user ? { uid: user.id, email: user.email } : null);
        }, 0);
      };
      const subscription = client.auth.onAuthStateChange((event, session) => {
        emit(session && session.user ? session.user : null);
      });
      client.auth.getSession()
        .then(result => emit(result.data && result.data.session ? result.data.session.user : null))
        .catch(failure => { if (error) error(failure); });
      return () => {
        stopped = true;
        subscription.data.subscription.unsubscribe();
      };
    }
  };

  async function signIn(email, password) {
    const result = await client.auth.signInWithPassword({
      email: String(email || '').trim(),
      password: String(password || '')
    });
    if (result.error) throw result.error;
    return result.data;
  }

  async function signOut() {
    const result = await client.auth.signOut();
    if (result.error) throw result.error;
  }

  // هل المستخدم الحالي هو الأدمن؟ (القرار من القاعدة نفسها: جدول admin_emails)
  async function isAdmin() {
    const result = await client.rpc('is_admin');
    if (result.error) throw result.error;
    return result.data === true;
  }

  window.KABOUSH_STORE = {
    isConfigured: true,
    configurationMessage: '',
    client,
    auth,
    signIn,
    signOut,
    isAdmin,
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
    saveSettings,
    watchProducts: (next, error) => watch('products', 'products', fetchProducts, next, error),
    watchCategories: (next, error) => watch('categories', 'categories', fetchCategories, next, error),
    watchOffers: (next, error) => watch('offers', 'offers', fetchOffers, next, error),
    watchSettings: (next, error) => watch('settings', 'store_settings', fetchSettings, next, error)
  };
})();
