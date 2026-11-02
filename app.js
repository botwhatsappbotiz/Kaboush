const STORE_LOCATION = { lat: 26.1591885, lng: 32.7239556 };
const demoProducts = window.KABOUSH_DEMO_PRODUCTS;
let products = readStorage('kaboush_products', demoProducts);
let settings = readStorage('kaboush_settings', {});
let cart = readStorage('kaboush_cart', []);
let categories = readStorage('kaboush_categories', []);
let offers = readStorage('kaboush_offers', []);
let activeCategory = 'الكل';
let colorDropdownOutsideHandler;
const $ = id => document.getElementById(id);
function readStorage(key, fallback){ try { const v=localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
function saveCart(){ localStorage.setItem('kaboush_cart', JSON.stringify(cart)); $('cartCount').textContent = cart.reduce((n,item)=>n+item.qty,0); }
function money(value){ return Number(value).toLocaleString('en-US') + ' ج.م'; }
function escapeHTML(value){ return String(value ?? '').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function toast(message){ const el=$('toast'); el.textContent=message; el.classList.add('show'); window.setTimeout(()=>el.classList.remove('show'),2600); }
function renderCategories(){
 const cats=['الكل',...new Set([...categories,...products.map(p=>p.category)].filter(Boolean))];
 $('categoryChips').innerHTML=cats.map(c=>`<button class=\"chip ${activeCategory===c?'active':''}\" data-category=\"${escapeHTML(c)}\">${escapeHTML(c)}</button>`).join('');
 $('categoryChips').querySelectorAll('[data-category]').forEach(btn=>btn.addEventListener('click',()=>{activeCategory=btn.dataset.category;renderCategories();renderProducts();$('products').scrollIntoView({behavior:'smooth'});}));
}
function renderProducts(){
 const query=($('searchInput').value||'').trim().toLowerCase();
 const list=products.filter(p=>(activeCategory==='الكل'||p.category===activeCategory)&&`${p.name} ${p.id} ${p.category}`.toLowerCase().includes(query));
 $('productHeading').textContent=activeCategory==='الكل'?'اختيارات كابوش':activeCategory;
 if(!list.length){$('productGrid').innerHTML='<div class=\"empty-state\" style=\"grid-column:1/-1\">لا توجد منتجات مطابقة للبحث.</div>';return;}
 $('productGrid').innerHTML=list.map(p=>`<article class=\"product-card\"><div class=\"product-photo\"><img loading=\"lazy\" src=\"${escapeHTML(p.image)}\" alt=\"${escapeHTML(p.name)}\"><span class=\"badge\">${escapeHTML(p.category)}</span><button class=\"heart\" data-fav=\"${escapeHTML(p.id)}\" aria-label=\"أضف إلى قائمة الحجز\">♡</button></div><div class=\"product-info\"><p class=\"product-name\">${escapeHTML(p.name)}</p><p class=\"product-desc\">${escapeHTML(p.desc||'')}</p><div class=\"price-row\"><span class=\"price\">${money(p.price)}</span></div><div class=\"product-actions\"><button class=\"view-button\" data-view=\"${escapeHTML(p.id)}\">التفاصيل</button><button class=\"book-button\" data-book=\"${escapeHTML(p.id)}\">احجز</button></div></div></article>`).join('');
 $('productGrid').querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showProduct(b.dataset.view,false)));
 $('productGrid').querySelectorAll('[data-book]').forEach(b=>b.addEventListener('click',()=>showProduct(b.dataset.book,true)));
 $('productGrid').querySelectorAll('[data-fav]').forEach(b=>b.addEventListener('click',()=>addToCart(b.dataset.fav)));
}
function renderOffers(){
 const today=new Date(),todayString=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
 const current=offers.filter(offer=>offer.title&&Number(offer.originalPrice)>0&&Number(offer.discountedPrice)>=0&&Number(offer.discountedPrice)<Number(offer.originalPrice)&&(!offer.startDate||offer.startDate<=todayString)&&(!offer.endDate||offer.endDate>=todayString));
 $('offerGrid').innerHTML=current.length?current.map(offer=>{
  const percent=Math.round(((Number(offer.originalPrice)-Number(offer.discountedPrice))/Number(offer.originalPrice))*100);
  const dates=[offer.startDate?`يبدأ ${new Date(`${offer.startDate}T00:00:00`).toLocaleDateString('ar-EG')}`:'',offer.endDate?`ينتهي ${new Date(`${offer.endDate}T00:00:00`).toLocaleDateString('ar-EG')}`:''].filter(Boolean).join(' · ');
  const photo=offer.image?`<img loading="lazy" src="${escapeHTML(offer.image)}" alt="${escapeHTML(offer.title)}">`:'<div class="offer-photo-placeholder">عرض خاص</div>';
  const availability=[offer.sizes&&offer.sizes.length?`المقاسات: ${offer.sizes.map(escapeHTML).join('، ')}`:'',offer.colors&&offer.colors.length?`الألوان: ${offer.colors.map(escapeHTML).join('، ')}`:''].filter(Boolean).join(' · ');
  return `<article class="product-card"><div class="product-photo">${photo}<span class="badge offer-discount">خصم ${percent}%</span></div><div class="product-info"><p class="product-name">${escapeHTML(offer.title)}</p><p class="product-desc">${escapeHTML(offer.description||'')}</p>${availability?`<p class="offer-availability">${availability}</p>`:''}<div class="price-row offer-prices"><del class="offer-old-price">${money(offer.originalPrice)}</del><strong class="price">${money(offer.discountedPrice)}</strong></div>${dates?`<p class="offer-dates">${dates}</p>`:''}<div class="product-actions offer-actions"><button class="offer-details-button" type="button" data-offer-details="${escapeHTML(offer.id)}">التفاصيل</button><button class="offer-book-button" type="button" data-offer-book="${escapeHTML(offer.id)}">احجز</button></div></div></article>`;
 }).join(''):'<div class="empty-state offer-empty">✨ لا توجد عروض سارية حاليًا. تابعنا لمعرفة العروض الجديدة.</div>';
 $('offerGrid').querySelectorAll('[data-offer-details]').forEach(button=>button.addEventListener('click',()=>showOfferDetails(button.dataset.offerDetails)));
 $('offerGrid').querySelectorAll('[data-offer-book]').forEach(button=>button.addEventListener('click',()=>showOfferDetails(button.dataset.offerBook)));
}
function clearColorDropdownHandler(){if(colorDropdownOutsideHandler){document.removeEventListener('click',colorDropdownOutsideHandler);colorDropdownOutsideHandler=undefined;}}
function openModal(title,html){clearColorDropdownHandler();$('modalTitle').textContent=title;$('modalBody').innerHTML=html;$('modalBackdrop').classList.add('show');}
function closeModal(){clearColorDropdownHandler();$('modalBackdrop').classList.remove('show');}
function colorHex(color){
 const colors={'أسود':'#171717','أبيض':'#ffffff','رمادي':'#888888','كحلي':'#1e3a5f','أزرق':'#2878c8','أحمر':'#d83b3b','أخضر':'#27834a','بيج':'#d5bd98','بني':'#805333','وردي':'#e58aab','أصفر':'#e5bb35','زيتي':'#777844','غير محدد':'#e8e5df'};
 return colors[color]||'#b9b9b9';
}
function renderColorChoices(colors,name){
 const availableColors=colors.length?colors:['غير محدد'];
 const options=availableColors.map((color,index)=>`<button class="color-dropdown-option" type="button" role="option" aria-selected="${index===0}" data-color-value="${escapeHTML(color)}"><span class="detail-color-swatch" style="--swatch-color:${colorHex(color)}"></span><span>${escapeHTML(color)}</span></button>`).join('');
 return `<div class="color-picker-field"><span class="color-picker-label">اللون</span><div class="color-dropdown" id="${name}Dropdown"><button class="color-dropdown-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="${name}Options"><span class="color-dropdown-current"><span class="detail-color-swatch" style="--swatch-color:${colorHex(availableColors[0])}"></span><span>${escapeHTML(availableColors[0])}</span></span><span class="color-dropdown-arrow" aria-hidden="true"></span></button><div class="color-dropdown-menu" id="${name}Options" role="listbox" aria-label="اختر اللون" hidden>${options}</div><select id="${name}" class="color-dropdown-value" tabindex="-1" aria-hidden="true">${availableColors.map(color=>`<option value="${escapeHTML(color)}">${escapeHTML(color)}</option>`).join('')}</select></div></div>`;
}
function bindColorSelect(name){
 const select=$(name),dropdown=$(`${name}Dropdown`),trigger=dropdown.querySelector('.color-dropdown-trigger'),menu=dropdown.querySelector('.color-dropdown-menu'),options=[...menu.querySelectorAll('[role="option"]')];
 const closeMenu=()=>{menu.hidden=true;trigger.setAttribute('aria-expanded','false');};
 const openMenu=()=>{menu.hidden=false;trigger.setAttribute('aria-expanded','true');options.find(option=>option.dataset.colorValue===select.value)?.focus();};
 const updateSelection=option=>{
  select.value=option.dataset.colorValue;
  options.forEach(item=>item.setAttribute('aria-selected',String(item===option)));
  trigger.querySelector('.color-dropdown-current').innerHTML=option.innerHTML;
  closeMenu();
  trigger.focus();
 };
 trigger.addEventListener('click',()=>menu.hidden?openMenu():closeMenu());
 options.forEach((option,index)=>{
  option.addEventListener('click',()=>updateSelection(option));
  option.addEventListener('keydown',event=>{
   let nextIndex;
   if(event.key==='ArrowDown')nextIndex=(index+1)%options.length;
   else if(event.key==='ArrowUp')nextIndex=(index-1+options.length)%options.length;
   else if(event.key==='Home')nextIndex=0;
   else if(event.key==='End')nextIndex=options.length-1;
   else if(event.key==='Escape'){closeMenu();trigger.focus();event.preventDefault();return;}
   if(nextIndex!==undefined){options[nextIndex].focus();event.preventDefault();}
  });
 });
 colorDropdownOutsideHandler=event=>{if(!dropdown.contains(event.target))closeMenu();};
 document.addEventListener('click',colorDropdownOutsideHandler);
}
function addOfferToCart(offer,size,color,qty){
 const existing=cart.find(item=>item.offerId===offer.id&&item.size===size&&item.color===color);
 if(existing)existing.qty=Math.min(20,existing.qty+qty);
 else cart.push({offerId:offer.id,offerTitle:offer.title,offerImage:offer.image||'',offerPrice:Number(offer.discountedPrice),offerOriginalPrice:Number(offer.originalPrice),size,color,qty});
 saveCart();closeModal();toast('تمت إضافة العرض إلى قائمة الحجز');
}
function showOfferDetails(id){
 const offer=offers.find(item=>item.id===id);if(!offer)return;
 const photo=offer.image?`<img class="detail-image" src="${escapeHTML(offer.image)}" alt="${escapeHTML(offer.title)}">`:'';
 const sizes=offer.sizes&&offer.sizes.length?offer.sizes:['غير محدد'];
 const colors=offer.colors&&offer.colors.length?offer.colors:['غير محدد'];
 const percent=Math.round(((Number(offer.originalPrice)-Number(offer.discountedPrice))/Number(offer.originalPrice))*100);
 openModal(offer.title,`${photo}<p style="line-height:1.8">${escapeHTML(offer.description||'')}</p><div class="offer-modal-prices"><del>${money(offer.originalPrice)}</del><strong>${money(offer.discountedPrice)}</strong><span>خصم ${percent}%</span></div><div class="form-grid"><label>المقاس<select id="offerDetailSize">${sizes.map(size=>`<option>${escapeHTML(size)}</option>`).join('')}</select></label>${renderColorChoices(colors,'offerDetailColor')}</div><label class="field-label">الكمية<input id="offerDetailQty" type="number" min="1" max="20" value="1" style="margin:8px 0 14px;padding:12px;border:1px solid #e8e5df;border-radius:10px;width:100%"></label><button class="button button-green offer-modal-book" id="addOfferToCart" type="button">أضف لقائمة الحجز</button>`);
 bindColorSelect('offerDetailColor');
 $('addOfferToCart').addEventListener('click',()=>{const qty=Math.max(1,Math.min(20,parseInt($('offerDetailQty').value,10)||1));const color=$('offerDetailColor').value;addOfferToCart(offer,$('offerDetailSize').value,color,qty);});
}
function showProduct(id){
 const p=products.find(item=>item.id===id);if(!p)return;
 openModal(p.name,`<img class=\"detail-image\" src=\"${escapeHTML(p.image)}\" alt=\"${escapeHTML(p.name)}\"><p style=\"line-height:1.8\">${escapeHTML(p.desc||'')}</p><div class=\"price\" style=\"font-size:21px;margin:12px 0\">${money(p.price)}</div><div class=\"form-grid\"><label>المقاس<select id=\"detailSize\">${(p.sizes&&p.sizes.length?p.sizes:['غير محدد']).map(s=>`<option>${escapeHTML(s)}</option>`).join('')}</select></label>${renderColorChoices(p.colors||[],'detailColor')}</div><label class=\"field-label\">الكمية<input id=\"detailQty\" type=\"number\" min=\"1\" max=\"20\" value=\"1\" style=\"margin:8px 0 14px;padding:12px;border:1px solid #e8e5df;border-radius:10px;width:100%\"></label><button class=\"button button-green\" id=\"addConfigured\" style=\"width:100%\">أضف لقائمة الحجز</button>`);
 bindColorSelect('detailColor');
 $('addConfigured').addEventListener('click',()=>{const size=$('detailSize').value,color=$('detailColor').value,qty=Math.max(1,Math.min(20,parseInt($('detailQty').value,10)||1));const existing=cart.find(x=>x.id===id&&x.size===size&&x.color===color);if(existing)existing.qty+=qty;else cart.push({id,size,color,qty});saveCart();closeModal();toast('تمت إضافة المنتج إلى قائمة الحجز');});
}
function addToCart(id){const p=products.find(item=>item.id===id);if(!p)return;cart.push({id,size:(p.sizes&&p.sizes.length?p.sizes:['غير محدد'])[0],color:(p.colors&&p.colors.length?p.colors:['غير محدد'])[0],qty:1});saveCart();toast('تمت إضافة المنتج إلى قائمة الحجز');}
function cartItemDetails(item){
 if(item.offerId)return{name:item.offerTitle||'عرض',code:`عرض ${item.offerId}`,image:item.offerImage||'',price:Number(item.offerPrice)||0};
 const product=products.find(product=>product.id===item.id);
 return product?{name:product.name,code:product.id,image:product.image,price:Number(product.price)}:null;
}
function openCart(){
 const lines=cart.map((item,index)=>{const product=cartItemDetails(item);if(!product)return '';return `<div class="cart-line">${product.image?`<img src="${escapeHTML(product.image)}" alt="">`:''}<div class="cart-grow"><strong>${escapeHTML(product.name)}</strong><p>${escapeHTML(item.size)} • ${escapeHTML(item.color)}<br>${money(product.price)}</p><div class="qty-controls"><button data-minus="${index}">−</button><span>${item.qty}</span><button data-plus="${index}">+</button><button data-remove="${index}" style="color:#b22">حذف</button></div></div><strong>${money(product.price*item.qty)}</strong></div>`;}).join('');
 const total=cart.reduce((sum,item)=>{const product=cartItemDetails(item);return sum+(product?product.price*item.qty:0);},0);
 openModal('المنتجات المختارة',`${lines||'<div class=\"empty-state\">قائمة الحجز فارغة حاليًا.<br>أضف المنتجات التي أعجبتك أولًا.</div>'}<div style=\"display:flex;justify-content:space-between;padding:18px 0;font-weight:bold\"><span>الإجمالي التقديري</span><span>${money(total)}</span></div><button class=\"button button-green\" id=\"sendCart\" style=\"width:100%\" ${cart.length?'':'disabled'}>إرسال طلب الحجز عبر واتساب</button><p class=\"notice\">الحجز لا يتأكد إلا بعد رد المتجر. الأسعار التجريبية يجب استبدالها بالأسعار الحقيقية.</p>`);
 $('modalBody').querySelectorAll('[data-minus]').forEach(b=>b.addEventListener('click',()=>changeQty(+b.dataset.minus,-1)));
 $('modalBody').querySelectorAll('[data-plus]').forEach(b=>b.addEventListener('click',()=>changeQty(+b.dataset.plus,1)));
 $('modalBody').querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{cart.splice(+b.dataset.remove,1);saveCart();openCart();}));
 $('sendCart').addEventListener('click',sendCart);
}
function changeQty(index,delta){cart[index].qty=Math.max(1,Math.min(20,cart[index].qty+delta));saveCart();openCart();}
function whatsappNumber(){let number=String(settings.whatsapp||'').replace(/\D/g,'');if(number.startsWith('0'))number='20'+number.slice(1);return number;}
function openWhatsApp(message){const number=whatsappNumber();if(!number){closeModal();toast('تعذر إرسال الطلب حاليًا؛ يرجى التواصل مع المتجر مباشرة.');return;}window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`,'_blank','noopener');}
function sendCart(){if(!cart.length){toast('أضف منتجًا أولًا');return;}const items=cart.map((item,i)=>{const product=cartItemDetails(item);return product?`${i+1}) ${product.name} — ${item.offerId?'عرض':'كود '+product.code}\\nالمقاس: ${item.size} | اللون: ${item.color} | الكمية: ${item.qty}\\nسعر القطعة: ${money(product.price)} | الإجمالي: ${money(product.price*item.qty)}`:''}).filter(Boolean);const total=cart.reduce((sum,item)=>{const product=cartItemDetails(item);return sum+(product?product.price*item.qty:0);},0);openWhatsApp(`مرحبًا سنتر كابوش 👋\\nأرغب في حجز المنتجات التالية:\\n\\n${items.join('\\n\\n')}\\n\\nالإجمالي التقديري: ${money(total)}\\nهل المنتجات متاحة؟`);}
function contactWhatsApp(){openWhatsApp('مرحبًا سنتر كابوش، أريد الاستفسار عن المنتجات المتاحة.');}
function updateContact(){$('phoneText').textContent=settings.phone||'رقم الهاتف يُضاف من إعدادات المتجر.';$('whatsappText').textContent=settings.whatsapp?'رقم واتساب: '+settings.whatsapp:'تواصل معنا مباشرة لمعرفة طرق الحجز.';$('hoursText').textContent=settings.hours||'مواعيد العمل غير متاحة حاليًا.';if(settings.phone){$('phoneLink').href='tel:'+settings.phone;$('phoneLink').classList.remove('hidden');}else{$('phoneLink').classList.add('hidden');}}
function updateSocialLink(id,value,fallback){const link=$(id),candidate=value===undefined?fallback:String(value||'').trim();let href='';if(candidate){try{const url=new URL(candidate);if(url.protocol==='http:'||url.protocol==='https:')href=url.href;}catch{}}link.href=href;link.classList.toggle('hidden',!href);}
function updateSocialLinks(){updateSocialLink('socialFacebookLink',settings.facebookUrl,'https://www.facebook.com/kabush.center/');updateSocialLink('socialTikTokLink',settings.tiktokUrl,'https://www.tiktok.com/@kabush.store?is_from_webapp=1&sender_device=pc');const number=String(settings.whatsapp===undefined?'201094874798':settings.whatsapp||'').replace(/\D/g,'');const normalized=number.startsWith('0')?'20'+number.slice(1):number;const link=$('socialWhatsappLink');link.href=normalized?`https://wa.me/${normalized}`:'';link.classList.toggle('hidden',!normalized);}
function applyStoreSettings(nextSettings){settings=nextSettings||{};updateContact();updateSocialLinks();if(window.setSiteIntroDuration)window.setSiteIntroDuration(settings.introDuration);try{localStorage.setItem('kaboush_settings',JSON.stringify(settings));}catch(error){console.error('تعذر حفظ نسخة محلية من إعدادات المتجر:',error);}}
$('searchForm').addEventListener('submit',e=>{e.preventDefault();renderProducts();$('products').scrollIntoView({behavior:'smooth'});});
$('searchInput').addEventListener('input',renderProducts);
$('showAll').addEventListener('click',()=>{activeCategory='الكل';$('searchInput').value='';renderCategories();renderProducts();});
$('cartTop').addEventListener('click',openCart);$('cartNav').addEventListener('click',openCart);$('openCartCallout').addEventListener('click',openCart);
$('contactWhatsApp').addEventListener('click',contactWhatsApp);
$('closeModal').addEventListener('click',closeModal);$('modalBackdrop').addEventListener('click',e=>{if(e.target===$('modalBackdrop'))closeModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
function syncNavigation(){const currentHash=window.location.hash||'#home';document.querySelectorAll('.bottom-nav .nav-item[href]').forEach(item=>{const isActive=item.getAttribute('href')===currentHash;item.classList.toggle('active',isActive);if(isActive){item.setAttribute('aria-current','page');}else{item.removeAttribute('aria-current');}});}
window.addEventListener('hashchange',syncNavigation);syncNavigation();
$('year').textContent=new Date().getFullYear();renderCategories();renderProducts();renderOffers();saveCart();applyStoreSettings(settings);
window.addEventListener('storage',event=>{
 if(event.key==='kaboush_offers'){offers=readStorage('kaboush_offers',[]);renderOffers();}
if(event.key==='kaboush_settings')applyStoreSettings(readStorage('kaboush_settings',{}));
});
function startCloudSync(){
 const status=$('cloudStatus'),store=window.KABOUSH_STORE;
 if(!store||!store.isConfigured){
  status.textContent=window.location.protocol==='file:'
   ? 'تم فتح الموقع كملفات محلية؛ لا يستطيع المتصفح مشاركة العروض بين صفحة الإدارة والصفحة الرئيسية. افتح الموقع عبر رابط منشور أو خادم محلي.'
   : 'المتجر يعمل بالبيانات المحلية لهذا المتصفح فقط؛ أعد إعداد Supabase لمزامنة العروض بين الأجهزة.';
  status.classList.remove('hidden');
  return;
 }
 status.textContent='جارٍ تحميل المنتجات من المتجر...';
 status.classList.remove('hidden');
 store.watchProducts(items=>{products=items;renderCategories();renderProducts();status.classList.add('hidden');},error=>{
  status.textContent='تعذر تحميل بيانات المتجر السحابية. تحقق من إعداد Supabase وقواعد القراءة.';
  status.classList.remove('hidden');
  console.error('Supabase product sync failed:',error);
 });
 store.watchCategories(items=>{categories=items;renderCategories();},error=>{
  status.textContent='تعذر تحميل أقسام المتجر من Supabase.';
  status.classList.remove('hidden');
  console.error('Supabase category sync failed:',error);
 });
 store.watchSettings(items=>applyStoreSettings(items),error=>{
  status.textContent='تعذر تحميل بيانات التواصل من Supabase.';
  status.classList.remove('hidden');
  console.error('Supabase settings sync failed:',error);
 });
 store.watchOffers(items=>{offers=items;renderOffers();},error=>{
  status.textContent='تعذر تحميل العروض من Supabase.';
  status.classList.remove('hidden');
  console.error('Supabase offer sync failed:',error);
 });
}
startCloudSync();
