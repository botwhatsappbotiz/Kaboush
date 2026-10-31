const LOCAL_ADMIN_PASSWORD_HASH = '715c95ff1aad4ab7651363960f7e6cb12d169b56b45747f2c4e6cd43c5dd9bae';
const OWNER_EMAIL = 'K.STORE@GMAIL.COM';
const $ = id => document.getElementById(id);
let imageProcessing = Promise.resolve();
let products = [];
let settings = {};
let categories = [];
let offers = [];
let unsubscribeStore = [];
let offerImageProcessing = Promise.resolve();

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function showToast(message) {
  const element = $('toast');
  element.textContent = message;
  element.classList.add('show');
  window.setTimeout(() => element.classList.remove('show'), 2600);
}

function renderAuth() {
  $('authTitle').textContent = 'دخول صاحب المتجر';
  $('authDescription').textContent = 'أدخل كلمة مرور حساب الإدارة.';
  $('authForm').innerHTML = `
    <label>كلمة المرور<input id="adminPassword" type="password" autocomplete="current-password" required></label>
    <button class="button button-dark" type="submit">دخول</button>`;
  $('authForm').addEventListener('submit', authenticate);
  if (!window.KABOUSH_STORE || !window.KABOUSH_STORE.isConfigured) {
    $('authStatus').textContent = window.KABOUSH_STORE
      ? `${window.KABOUSH_STORE.configurationMessage} يمكنك الدخول محليًا، لكن التغييرات لن تظهر على الأجهزة الأخرى.`
      : 'تعذر تحميل Firebase. تحقق من اتصال الإنترنت وإعداد ملفات الموقع. يمكنك الدخول محليًا، لكن التغييرات لن تظهر على الأجهزة الأخرى.';
    $('authForm').querySelector('button').disabled = false;
  } else {
    $('authStatus').textContent = 'استخدم حساب الإدارة الذي أُنشئ في Firebase Authentication.';
  }
}

async function authenticate(event) {
  event.preventDefault();
  if (!window.KABOUSH_STORE || !window.KABOUSH_STORE.isConfigured) {
    try {
      if (await passwordHash($('adminPassword').value) !== LOCAL_ADMIN_PASSWORD_HASH) {
        showToast('كلمة المرور غير صحيحة.');
        return;
      }
      sessionStorage.setItem('kaboush_admin_local_authenticated', 'true');
      showLocalAdmin();
    } catch (error) {
      showToast(error.message);
    }
    return;
  }
  try {
    await window.KABOUSH_STORE.signIn(OWNER_EMAIL, $('adminPassword').value);
  } catch (error) {
    $('authStatus').textContent = `تعذر تسجيل الدخول إلى Firebase: ${error.code || error.message}`;
  }
}

async function passwordHash(password) {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('يلزم فتح الموقع عبر HTTPS أو localhost لتسجيل الدخول.');
  }
  const bytes = new TextEncoder().encode(password);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function showLocalAdmin() {
  products = readStorage('kaboush_products', window.KABOUSH_DEMO_PRODUCTS);
  settings = readStorage('kaboush_settings', {});
  categories = readStorage('kaboush_categories', []);
  offers = readStorage('kaboush_offers', []);
  $('authCard').classList.add('hidden');
  $('adminContent').classList.remove('hidden');
  $('adminSyncStatus').textContent = window.location.protocol === 'file:'
    ? 'تنبيه: الصفحة مفتوحة كملف محلي (file://)، لذلك لن تنتقل العروض إلى صفحة المتجر. افتح الموقع عبر رابط منشور أو خادم محلي.'
    : 'وضع محلي فقط — التغييرات محفوظة في هذا المتصفح ولا تتزامن مع بقية الأجهزة.';
  $('adminWhatsapp').value = settings.whatsapp || '';
  $('adminPhone').value = settings.phone || '';
  $('adminHours').value = settings.hours || '';
  renderCategories();
  renderProducts();
  renderOffers();
}

async function showAdmin(user) {
  if (user.uid !== window.KABOUSH_FIREBASE_CONFIG.ownerUid) {
    $('authStatus').textContent = 'هذا الحساب غير مصرح له بإدارة المتجر.';
    await window.KABOUSH_STORE.signOut();
    return;
  }
  $('authCard').classList.add('hidden');
  $('adminContent').classList.remove('hidden');
  $('adminSyncStatus').textContent = `تم تسجيل الدخول: ${user.email || 'حساب الإدارة'} · جارٍ تحميل بيانات المتجر`;
  try {
    const savedProducts = readStorage('kaboush_products', window.KABOUSH_DEMO_PRODUCTS);
    const savedCategories = readStorage('kaboush_categories', []);
    const savedSettings = readStorage('kaboush_settings', {});
    const wasSeeded = await window.KABOUSH_STORE.initializeCatalogIfNeeded(
      savedProducts,
      savedCategories,
      savedSettings
    );
    if (wasSeeded) showToast('تم نقل الكتالوج إلى Firebase ليظهر على جميع الأجهزة.');
    unsubscribeStore.forEach(unsubscribe => unsubscribe());
    unsubscribeStore = [
      window.KABOUSH_STORE.watchProducts(items => {
        products = items;
        renderCategories();
        renderProducts();
      }, handleCloudError),
      window.KABOUSH_STORE.watchCategories(items => {
        categories = items;
        renderCategories();
      }, handleCloudError),
      window.KABOUSH_STORE.watchSettings(items => {
        settings = items;
        $('adminWhatsapp').value = settings.whatsapp || '';
        $('adminPhone').value = settings.phone || '';
        $('adminHours').value = settings.hours || '';
      }, handleCloudError),
      window.KABOUSH_STORE.watchOffers(items => {
        offers = items;
        renderOffers();
      }, handleCloudError)
    ];
    $('adminSyncStatus').textContent = 'متصل بقاعدة Firebase · التغييرات تتزامن مع جميع الأجهزة';
  } catch (error) {
    $('adminSyncStatus').textContent = 'تعذر تحميل قاعدة البيانات. راجع إعداد Firebase وقواعد الأمان.';
    showToast(`فشل تحميل بيانات المتجر من Firebase: ${error.message}`);
  }
}

function handleCloudError(error) {
  $('adminSyncStatus').textContent = 'انقطع الاتصال بقاعدة البيانات. تحقق من قواعد Firebase والإنترنت.';
  showToast(error.message || 'تعذر مزامنة بيانات المتجر.');
}

function allCategories() {
  return [...new Set([...categories, ...products.map(product => product.category)].filter(Boolean))];
}

function renderCategories() {
  const names = allCategories();
  $('pCategory').innerHTML = names.map(name =>
    `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`
  ).join('');
  $('categoryList').innerHTML = names.length
    ? names.map(name => {
      const inUse = products.some(product => product.category === name);
      return `<div class="category-row"><span>${escapeHTML(name)}</span><button class="button button-light" type="button" data-delete-category="${escapeHTML(name)}" ${inUse ? 'disabled title="انقل أو احذف المنتجات التابعة للقسم أولًا"' : ''}>حذف القسم</button></div>`;
    }).join('')
    : '<div class="empty-state">لا توجد أقسام بعد.</div>';
}

function renderProducts() {
  $('productCount').textContent = `${products.length} منتج`;
  $('adminProductList').innerHTML = products.length
    ? products.map(product => `<article class="admin-product">
        <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" onerror="this.hidden=true">
        <div class="admin-product-info">
          <strong>${escapeHTML(product.name)}</strong>
          <span>${escapeHTML(product.category)} · ${Number(product.price).toLocaleString('en-US')} ج.م</span>
          <small>الكود: ${escapeHTML(product.id)}</small>
        </div>
        <div class="admin-product-actions">
          <button class="button button-light" type="button" data-edit-product="${escapeHTML(product.id)}">تعديل</button>
          <button class="button button-danger" type="button" data-delete-product="${escapeHTML(product.id)}">حذف</button>
        </div>
      </article>`).join('')
    : '<div class="empty-state">لا توجد منتجات.</div>';
}

function offerDiscountPercent(originalPrice, discountedPrice) {
  return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
}

function currentDateString() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function offerStatus(offer) {
  const today = currentDateString();
  if (offer.startDate && offer.startDate > today) return 'مجدول';
  if (offer.endDate && offer.endDate < today) return 'منتهي';
  return 'ساري';
}

function renderOffers() {
  $('offerCount').textContent = `${offers.length} عرض`;
  $('adminOfferList').innerHTML = offers.length
    ? offers.map(offer => {
      const percent = offerDiscountPercent(Number(offer.originalPrice), Number(offer.discountedPrice));
      const dates = [
        offer.startDate ? `من ${escapeHTML(offer.startDate)}` : '',
        offer.endDate ? `حتى ${escapeHTML(offer.endDate)}` : ''
      ].filter(Boolean).join(' · ') || 'دون تاريخ محدد';
      return `<article class="admin-offer">
        ${offer.image ? `<img class="admin-offer-image" src="${escapeHTML(offer.image)}" alt="${escapeHTML(offer.title)}" onerror="this.hidden=true">` : ''}
        <div class="admin-offer-info">
          <strong>${escapeHTML(offer.title)}</strong>
          <span>${escapeHTML(offer.description || 'لا توجد تفاصيل إضافية')}</span>
          <small><del>${Number(offer.originalPrice).toLocaleString('en-US')} ج.م</del> · ${Number(offer.discountedPrice).toLocaleString('en-US')} ج.م · خصم ${percent}%</small>
          <small>${dates}</small>
        </div>
        <span class="offer-admin-status">${offerStatus(offer)}</span>
        <div class="admin-product-actions">
          <button class="button button-light" type="button" data-edit-offer="${escapeHTML(offer.id)}">تعديل</button>
          <button class="button button-danger" type="button" data-delete-offer="${escapeHTML(offer.id)}">حذف</button>
        </div>
      </article>`;
    }).join('')
    : '<div class="empty-state">لا توجد عروض مضافة بعد.</div>';
}

function updateOfferDiscountPreview() {
  if (!$('offerOriginalPrice').value || !$('offerDiscountedPrice').value) {
    $('offerDiscountPreview').textContent = 'أدخل السعرين لتظهر نسبة الخصم تلقائيًا.';
    return;
  }
  const originalPrice = Number($('offerOriginalPrice').value);
  const discountedPrice = Number($('offerDiscountedPrice').value);
  if (!Number.isFinite(originalPrice) || originalPrice <= 0
    || !Number.isFinite(discountedPrice) || discountedPrice < 0
    || discountedPrice >= originalPrice) {
    $('offerDiscountPreview').textContent = 'أدخل سعرًا بعد الخصم أقل من السعر الأصلي لاحتساب النسبة.';
    return;
  }
  $('offerDiscountPreview').textContent = `نسبة الخصم: ${offerDiscountPercent(originalPrice, discountedPrice)}%`;
}

function resetOfferForm() {
  $('offerForm').reset();
  $('offerId').value = '';
  $('offerImageFile').value = '';
  $('offerImagePreview').src = '';
  $('offerImagePreview').classList.add('hidden');
  $('offerImageStatus').textContent = '';
  updateOfferImageChoice();
  $('offerFormTitle').textContent = 'إضافة عرض';
  $('saveOfferButton').textContent = 'إضافة العرض';
  $('cancelOfferEditButton').classList.add('hidden');
  updateOfferDiscountPreview();
}

function editOffer(id) {
  const offer = offers.find(item => item.id === id);
  if (!offer) return;
  $('offerId').value = offer.id;
  $('offerTitle').value = offer.title || '';
  $('offerDescription').value = offer.description || '';
  $('offerImage').value = offer.image || '';
  document.querySelector('input[name="offerImageSource"][value="url"]').checked = true;
  updateOfferImageChoice();
  if (offer.image) showImagePreview(offer.image, 'offerImagePreview', 'offerImageStatus');
  $('offerOriginalPrice').value = offer.originalPrice;
  $('offerDiscountedPrice').value = offer.discountedPrice;
  $('offerStartDate').value = offer.startDate || '';
  $('offerEndDate').value = offer.endDate || '';
  $('offerFormTitle').textContent = 'تعديل العرض';
  $('saveOfferButton').textContent = 'حفظ تعديلات العرض';
  $('cancelOfferEditButton').classList.remove('hidden');
  updateOfferDiscountPreview();
  $('offerFormTitle').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetProductForm() {
  $('productForm').reset();
  $('productId').value = '';
  $('pImageFile').value = '';
  $('imagePreview').src = '';
  $('imagePreview').classList.add('hidden');
  $('imageStatus').textContent = '';
  updateImageChoice();
  $('productFormTitle').textContent = 'إضافة منتج';
  $('saveProductButton').textContent = 'إضافة المنتج';
  $('cancelEditButton').classList.add('hidden');
}

function editProduct(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;
  renderCategories();
  $('productId').value = product.id;
  $('pName').value = product.name;
  $('pPrice').value = product.price;
  $('pCategory').value = product.category;
  $('pCode').value = product.id;
  $('pImage').value = product.image;
  showImagePreview(product.image);
  $('pDesc').value = product.desc || '';
  $('productFormTitle').textContent = 'تعديل المنتج';
  $('saveProductButton').textContent = 'حفظ التعديلات';
  $('cancelEditButton').classList.remove('hidden');
  $('productFormTitle').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function validImageUrl(value) {
  if (/^data:image\//i.test(value)) {
    return /^data:image\/(?:jpeg|png|webp|gif);base64,[a-z0-9+/]+=*$/i.test(value)
      && value.length <= 1_500_000;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

$('productForm').addEventListener('change', async event => {
  if (event.target.name === 'imageSource') {
    updateImageChoice();
    return;
  }
  if (event.target.id !== 'pImageFile') return;
  const file = event.target.files[0];
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
    event.target.value = '';
    $('imageStatus').textContent = 'اختر صورة بصيغة JPG أو PNG أو WebP أو GIF.';
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    event.target.value = '';
    $('imageStatus').textContent = 'حجم الصورة أكبر من 10 ميجابايت.';
    return;
  }
  imageProcessing = compressImage(file).then(dataUrl => {
    $('pImage').value = dataUrl;
    showImagePreview(dataUrl);
    $('imageStatus').textContent = 'تم تجهيز الصورة. احفظ المنتج لتظهر في المتجر على هذا المتصفح.';
  }).catch(error => {
    event.target.value = '';
    $('imageStatus').textContent = error.message || 'تعذر قراءة الصورة.';
  });
});

$('offerForm').addEventListener('change', async event => {
  if (event.target.name === 'offerImageSource') {
    updateOfferImageChoice();
    return;
  }
  if (event.target.id !== 'offerImageFile') return;
  const file = event.target.files[0];
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
    event.target.value = '';
    $('offerImageStatus').textContent = 'اختر صورة بصيغة JPG أو PNG أو WebP أو GIF.';
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    event.target.value = '';
    $('offerImageStatus').textContent = 'حجم الصورة أكبر من 10 ميجابايت.';
    return;
  }
  offerImageProcessing = compressImage(file).then(dataUrl => {
    $('offerImage').value = dataUrl;
    showImagePreview(dataUrl, 'offerImagePreview', 'offerImageStatus');
    $('offerImageStatus').textContent = 'تم تجهيز الصورة. احفظ العرض لإضافتها.';
  }).catch(error => {
    event.target.value = '';
    $('offerImageStatus').textContent = error.message || 'تعذر قراءة الصورة.';
  });
});

$('pImage').addEventListener('input', () => {
  const value = $('pImage').value.trim();
  if (/^(https?:\/\/|data:image\/)/i.test(value)) showImagePreview(value);
  else {
    $('imagePreview').classList.add('hidden');
    $('imageStatus').textContent = '';
  }
});

$('offerImage').addEventListener('input', () => {
  const value = $('offerImage').value.trim();
  if (/^(https?:\/\/|data:image\/)/i.test(value)) {
    showImagePreview(value, 'offerImagePreview', 'offerImageStatus');
  } else {
    $('offerImagePreview').classList.add('hidden');
    $('offerImageStatus').textContent = '';
  }
});

function updateImageChoice() {
  const uploading = document.querySelector('input[name="imageSource"]:checked').value === 'upload';
  $('imageUrlField').classList.toggle('hidden', uploading);
  $('imageUploadField').classList.toggle('hidden', !uploading);
  $('pImage').required = !uploading;
  $('pImageFile').required = uploading && !$('productId').value;
}

function updateOfferImageChoice() {
  const uploading = document.querySelector('input[name="offerImageSource"]:checked').value === 'upload';
  $('offerImageUrlField').classList.toggle('hidden', uploading);
  $('offerImageUploadField').classList.toggle('hidden', !uploading);
}

function showImagePreview(source, previewId = 'imagePreview', statusId = 'imageStatus') {
  const preview = $(previewId);
  preview.onload = () => {
    preview.classList.remove('hidden');
    $(statusId).textContent = 'معاينة الصورة جاهزة.';
  };
  preview.onerror = () => {
    preview.classList.add('hidden');
    $(statusId).textContent = 'تعذر تحميل الصورة. تحقق من الرابط أو اختر ملف صورة صالحًا.';
  };
  preview.src = source;
}

async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.78));
  if (!blob) throw new Error('تعذر تجهيز الصورة. جرّب ملفًا بصيغة JPG أو PNG.');
  if (blob.size > 900 * 1024) throw new Error('تعذر ضغط الصورة إلى حجم مناسب. اختر صورة أصغر.');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('تعذر قراءة الصورة من الجهاز.'));
    reader.readAsDataURL(blob);
  });
}

function verifyImageSource(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      image.src = '';
      reject(new Error('انتهت مهلة تحميل الصورة. تحقق من الرابط وحاول مرة أخرى.'));
    }, 10000);
    image.onload = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error('تعذر تحميل الصورة. استخدم رابط الصورة المباشر أو اختر ملفًا صالحًا.'));
    };
    image.src = source;
  });
}

$('settingsForm').addEventListener('submit', async event => {
  event.preventDefault();
  const updatedSettings = {
    whatsapp: $('adminWhatsapp').value.trim(),
    phone: $('adminPhone').value.trim(),
    hours: $('adminHours').value.trim()
  };
  if (!window.KABOUSH_STORE || !window.KABOUSH_STORE.isConfigured) {
    try {
      localStorage.setItem('kaboush_settings', JSON.stringify(updatedSettings));
      settings = updatedSettings;
      showToast('تم حفظ بيانات التواصل على هذا الجهاز فقط.');
    } catch {
      showToast('تعذر حفظ الإعدادات في مساحة التخزين المحلية.');
    }
    return;
  }
  try {
    await window.KABOUSH_STORE.saveSettings(updatedSettings);
    showToast('تم حفظ بيانات التواصل ومزامنتها.');
  } catch (error) {
    showToast(`تعذر حفظ بيانات التواصل: ${error.message}`);
  }
});

$('offerOriginalPrice').addEventListener('input', updateOfferDiscountPreview);
$('offerDiscountedPrice').addEventListener('input', updateOfferDiscountPreview);

$('offerForm').addEventListener('submit', async event => {
  event.preventDefault();
  await offerImageProcessing;
  const oldId = $('offerId').value;
  const originalPrice = Number($('offerOriginalPrice').value);
  const discountedPrice = Number($('offerDiscountedPrice').value);
  const image = $('offerImage').value.trim();
  const startDate = $('offerStartDate').value;
  const endDate = $('offerEndDate').value;
  if (!Number.isFinite(originalPrice) || originalPrice <= 0
    || !Number.isFinite(discountedPrice) || discountedPrice < 0
    || discountedPrice >= originalPrice) {
    showToast('يجب أن يكون السعر الأصلي أكبر من صفر والسعر بعد الخصم أقل منه.');
    return;
  }
  if (startDate && endDate && endDate < startDate) {
    showToast('تاريخ انتهاء العرض يجب أن يكون بعد تاريخ بدايته.');
    return;
  }
  if (image && !validImageUrl(image)) {
    showToast('أدخل رابط صورة صالحًا أو اختر صورة من جهازك.');
    return;
  }
  if (image) {
    try {
      await verifyImageSource(image);
    } catch (error) {
      $('offerImageStatus').textContent = error.message;
      showToast(error.message);
      return;
    }
  }
  const existingOffer = offers.find(item => item.id === oldId);
  const offer = {
    id: oldId || `offer-${Date.now()}`,
    title: $('offerTitle').value.trim(),
    description: $('offerDescription').value.trim(),
    image,
    imagePath: existingOffer && existingOffer.image === image ? (existingOffer.imagePath || '') : '',
    originalPrice,
    discountedPrice,
    discountPercent: offerDiscountPercent(originalPrice, discountedPrice),
    startDate,
    endDate
  };
  if (!window.KABOUSH_STORE || !window.KABOUSH_STORE.isConfigured) {
    const updatedOffers = oldId
      ? offers.map(item => item.id === oldId ? offer : item)
      : [offer, ...offers];
    try {
      localStorage.setItem('kaboush_offers', JSON.stringify(updatedOffers));
      offers = updatedOffers;
      renderOffers();
      resetOfferForm();
      showToast(window.location.protocol === 'file:'
        ? 'تم حفظ العرض في لوحة الإدارة فقط. افتح الموقع عبر رابط منشور ليظهر في صفحة المتجر.'
        : oldId ? 'تم تحديث العرض على هذا الجهاز فقط.' : 'تمت إضافة العرض على هذا الجهاز فقط.');
    } catch {
      showToast('تعذر حفظ العرض في مساحة التخزين المحلية.');
    }
    return;
  }
  let uploadedImagePath = '';
  if (image.startsWith('data:image/')) {
    try {
      const blob = await fetch(image).then(response => response.blob());
      const uploaded = await window.KABOUSH_STORE.uploadOfferImage(offer.id, blob);
      offer.image = uploaded.url;
      offer.imagePath = uploaded.path;
      uploadedImagePath = uploaded.path;
    } catch (error) {
      showToast(`تعذر رفع صورة العرض إلى Firebase Storage: ${error.message}`);
      return;
    }
  }
  try {
    const result = await window.KABOUSH_STORE.saveOffer(offer);
    offers = oldId
      ? offers.map(item => item.id === oldId ? offer : item)
      : [offer, ...offers];
    renderOffers();
    resetOfferForm();
    showToast(result.imageCleanupFailed
      ? 'تم حفظ العرض، لكن تعذر حذف صورته القديمة من Firebase Storage.'
      : oldId ? 'تم تحديث العرض ومزامنته.' : 'تمت إضافة العرض ومزامنته.');
  } catch (error) {
    if (uploadedImagePath) {
      try {
        await window.KABOUSH_STORE.deleteImage(uploadedImagePath);
      } catch {
        showToast('فشل حفظ العرض وتعذر تنظيف الصورة المرفوعة. احذف الملف من Firebase Storage.');
        return;
      }
    }
    showToast(`تعذر حفظ العرض في Firebase: ${error.message}`);
  }
});

$('cancelOfferEditButton').addEventListener('click', resetOfferForm);

$('adminOfferList').addEventListener('click', async event => {
  const editButton = event.target.closest('[data-edit-offer]');
  if (editButton) {
    editOffer(editButton.dataset.editOffer);
    return;
  }
  const deleteButton = event.target.closest('[data-delete-offer]');
  if (!deleteButton) return;
  const id = deleteButton.dataset.deleteOffer;
  const offer = offers.find(item => item.id === id);
  if (!offer || !window.confirm(`هل تريد حذف العرض "${offer.title}"؟`)) return;
  if (!window.KABOUSH_STORE || !window.KABOUSH_STORE.isConfigured) {
    const updatedOffers = offers.filter(item => item.id !== id);
    try {
      localStorage.setItem('kaboush_offers', JSON.stringify(updatedOffers));
      offers = updatedOffers;
      renderOffers();
      showToast('تم حذف العرض من هذا الجهاز فقط.');
    } catch {
      showToast('تعذر تحديث العروض المحلية.');
    }
    return;
  }
  try {
    const result = await window.KABOUSH_STORE.removeOffer(id);
    offers = offers.filter(item => item.id !== id);
    renderOffers();
    showToast(result.imageCleanupFailed
      ? 'تم حذف العرض، لكن تعذر حذف صورته من Firebase Storage.'
      : 'تم حذف العرض من المتجر.');
  } catch (error) {
    showToast(`تعذر حذف العرض من Firebase: ${error.message}`);
  }
});

$('productForm').addEventListener('submit', async event => {
  event.preventDefault();
  await imageProcessing;
  const oldId = $('productId').value;
  const id = $('pCode').value.trim() || oldId || `KB${Date.now().toString().slice(-8)}`;
  const duplicate = products.some(product => product.id === id && product.id !== oldId);
  if (duplicate) {
    showToast('كود المنتج مستخدم بالفعل؛ اختر كودًا آخر.');
    return;
  }
  const price = Number($('pPrice').value);
  const image = $('pImage').value.trim();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) {
    showToast('كود المنتج يجب أن يحتوي على أحرف إنجليزية أو أرقام أو شرطة فقط.');
    return;
  }
  if (!Number.isFinite(price) || price < 0 || !validImageUrl(image)) {
    showToast('أدخل سعرًا صحيحًا ورابط صورة صالحًا أو اختر ملف صورة.');
    return;
  }
  try {
    await verifyImageSource(image);
  } catch (error) {
    $('imageStatus').textContent = error.message;
    showToast(error.message);
    return;
  }
  const existingProduct = oldId ? products.find(item => item.id === oldId) : null;
  const product = {
    id,
    name: $('pName').value.trim(),
    price,
    category: $('pCategory').value,
    image,
    imagePath: existingProduct && existingProduct.image === image ? (existingProduct.imagePath || '') : '',
    desc: $('pDesc').value.trim(),
    sizes: oldId ? (products.find(item => item.id === oldId).sizes || ['M', 'L', 'XL']) : ['M', 'L', 'XL'],
    colors: oldId ? (products.find(item => item.id === oldId).colors || ['أسود', 'أبيض']) : ['أسود', 'أبيض']
  };
  if (!window.KABOUSH_STORE || !window.KABOUSH_STORE.isConfigured) {
    const updatedProducts = oldId
      ? products.map(item => item.id === oldId ? product : item)
      : [product, ...products];
    try {
      localStorage.setItem('kaboush_products', JSON.stringify(updatedProducts));
      products = updatedProducts;
      categories = [...new Set([...categories, product.category].filter(Boolean))];
      localStorage.setItem('kaboush_categories', JSON.stringify(categories));
      showToast(oldId ? 'تم تحديث المنتج على هذا الجهاز فقط.' : 'تمت إضافة المنتج على هذا الجهاز فقط.');
      resetProductForm();
      renderCategories();
      renderProducts();
    } catch {
      showToast('تعذر حفظ المنتج محليًا؛ مساحة المتصفح غير كافية.');
    }
    return;
  }
  let uploadedImagePath = '';
  if (image.startsWith('data:image/')) {
    try {
      const blob = await fetch(image).then(response => response.blob());
      const uploaded = await window.KABOUSH_STORE.uploadImage(id, blob);
      product.image = uploaded.url;
      product.imagePath = uploaded.path;
      uploadedImagePath = uploaded.path;
    } catch (error) {
      showToast(`تعذر رفع الصورة إلى Firebase Storage: ${error.message}`);
      return;
    }
  }
  try {
    const result = await window.KABOUSH_STORE.saveProduct(oldId, product);
    if (oldId && oldId !== id) {
      const cart = readStorage('kaboush_cart', []);
      cart.forEach(item => { if (item.id === oldId) item.id = id; });
      localStorage.setItem('kaboush_cart', JSON.stringify(cart));
    }
    if (result.imageCleanupFailed) {
      showToast('تم حفظ المنتج، لكن تعذر حذف الصورة القديمة من التخزين.');
    } else {
      showToast(oldId ? 'تم تحديث المنتج ومزامنته.' : 'تمت إضافة المنتج ومزامنته.');
    }
  } catch (error) {
    if (uploadedImagePath) {
      try {
        await window.KABOUSH_STORE.deleteImage(uploadedImagePath);
      } catch {
        showToast('فشل حفظ المنتج وتعذر تنظيف الصورة المرفوعة. احذف الملف من Firebase Storage.');
        return;
      }
    }
    showToast(`تعذر حفظ المنتج في Firebase: ${error.message}`);
    return;
  }
  resetProductForm();
});

$('cancelEditButton').addEventListener('click', resetProductForm);

$('categoryForm').addEventListener('submit', async event => {
  event.preventDefault();
  const name = $('categoryName').value.trim();
  if (!name || name === 'الكل') {
    showToast('أدخل اسم قسم صالحًا.');
    return;
  }
  if (allCategories().some(category => category.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    showToast('هذا القسم موجود بالفعل.');
    return;
  }
  if (!window.KABOUSH_STORE || !window.KABOUSH_STORE.isConfigured) {
    categories = [...categories, name];
    try {
      localStorage.setItem('kaboush_categories', JSON.stringify(categories));
      $('categoryForm').reset();
      renderCategories();
      showToast('تمت إضافة القسم على هذا الجهاز فقط.');
    } catch {
      showToast('تعذر حفظ القسم في مساحة التخزين المحلية.');
    }
    return;
  }
  try {
    await window.KABOUSH_STORE.saveCategory(name);
    categories = [...categories, name];
    $('categoryForm').reset();
    renderCategories();
    showToast('تمت إضافة القسم ومزامنته.');
  } catch (error) {
    showToast(`تعذر حفظ القسم في Firebase: ${error.message}`);
  }
});

$('categoryList').addEventListener('click', async event => {
  const button = event.target.closest('[data-delete-category]');
  if (!button) return;
  const name = button.dataset.deleteCategory;
  if (products.some(product => product.category === name)) {
    showToast('انقل المنتجات التابعة لهذا القسم أو احذفها أولًا.');
    return;
  }
  if (!window.confirm(`هل تريد حذف قسم "${name}"؟`)) return;
  if (!window.KABOUSH_STORE || !window.KABOUSH_STORE.isConfigured) {
    categories = categories.filter(category => category !== name);
    try {
      localStorage.setItem('kaboush_categories', JSON.stringify(categories));
      renderCategories();
      showToast('تم حذف القسم من هذا الجهاز فقط.');
    } catch {
      showToast('تعذر تحديث الأقسام المحلية.');
    }
    return;
  }
  try {
    await window.KABOUSH_STORE.removeCategory(name);
    categories = categories.filter(category => category !== name);
    renderCategories();
    showToast('تم حذف القسم من المتجر.');
  } catch (error) {
    showToast(`تعذر حذف القسم من Firebase: ${error.message}`);
  }
});

$('adminProductList').addEventListener('click', async event => {
  const editButton = event.target.closest('[data-edit-product]');
  if (editButton) {
    editProduct(editButton.dataset.editProduct);
    return;
  }
  const deleteButton = event.target.closest('[data-delete-product]');
  if (!deleteButton) return;
  const id = deleteButton.dataset.deleteProduct;
  const product = products.find(item => item.id === id);
  if (!product || !window.confirm(`هل تريد حذف المنتج "${product.name}"؟`)) return;
  if (!window.KABOUSH_STORE || !window.KABOUSH_STORE.isConfigured) {
    products = products.filter(item => item.id !== id);
    try {
      localStorage.setItem('kaboush_products', JSON.stringify(products));
      categories = allCategories();
      localStorage.setItem('kaboush_categories', JSON.stringify(categories));
      const localCart = readStorage('kaboush_cart', []);
      localStorage.setItem('kaboush_cart', JSON.stringify(localCart.filter(item => item.id !== id)));
      renderCategories();
      renderProducts();
      showToast('تم حذف المنتج من هذا الجهاز فقط.');
    } catch {
      showToast('تعذر تحديث بيانات المنتجات المحلية.');
    }
    return;
  }
  try {
    const result = await window.KABOUSH_STORE.removeProduct(id);
    products = products.filter(item => item.id !== id);
    const cart = readStorage('kaboush_cart', []);
    localStorage.setItem('kaboush_cart', JSON.stringify(cart.filter(item => item.id !== id)));
    renderCategories();
    renderProducts();
    showToast(result.imageCleanupFailed
      ? 'تم حذف المنتج، لكن تعذر حذف صورته من Firebase Storage.'
      : 'تم حذف المنتج من المتجر.');
  } catch (error) {
    showToast(`تعذر حذف المنتج من Firebase: ${error.message}`);
  }
});

$('logoutButton').addEventListener('click', async () => {
  if (!window.KABOUSH_STORE || !window.KABOUSH_STORE.isConfigured) {
    sessionStorage.removeItem('kaboush_admin_local_authenticated');
    window.location.reload();
    return;
  }
  unsubscribeStore.forEach(unsubscribe => unsubscribe());
  try {
    await window.KABOUSH_STORE.signOut();
  } catch (error) {
    showToast(`تعذر تسجيل الخروج: ${error.message}`);
  }
});

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

if (!window.KABOUSH_STORE || !window.KABOUSH_STORE.isConfigured) {
  renderAuth();
  if (sessionStorage.getItem('kaboush_admin_local_authenticated') === 'true') {
    showLocalAdmin();
  }
} else {
  renderAuth();
  window.KABOUSH_STORE.auth.onAuthStateChanged(user => {
    if (user) showAdmin(user);
    else {
      unsubscribeStore.forEach(unsubscribe => unsubscribe());
      unsubscribeStore = [];
      $('adminContent').classList.add('hidden');
      $('authCard').classList.remove('hidden');
      renderAuth();
    }
  }, handleCloudError);
}
updateImageChoice();
