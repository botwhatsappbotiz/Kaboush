const STORE_LOCATION = { lat: 26.1591885, lng: 32.7239556 };
const demoProducts = [
 {id:'TSH123',name:'تيشيرت رجالي كاجوال',category:'تيشيرتات',price:250,desc:'تصميم بسيط يناسب إطلالاتك اليومية.',image:'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=85',sizes:['M','L','XL','XXL'],colors:['أسود','أبيض','رمادي']},
 {id:'HDI210',name:'هودي رجالي',category:'هوديز',price:420,desc:'قطعة كاجوال لإطلالة مريحة.',image:'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=700&q=85',sizes:['M','L','XL'],colors:['أسود','بيج','رمادي']},
 {id:'PNT380',name:'بنطلون كاجوال',category:'بناطيل',price:380,desc:'اختيار عملي لإطلالة يومية.',image:'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=700&q=85',sizes:['30','32','34','36'],colors:['أسود','بيج']},
 {id:'JKT650',name:'جاكيت شبابي',category:'رجالي',price:650,desc:'تصميم شبابي بطابع عصري.',image:'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=700&q=85',sizes:['M','L','XL'],colors:['أسود','بني']},
 {id:'TSH180',name:'تيشيرت أساسي',category:'تيشيرتات',price:180,desc:'قطعة أساسية سهلة التنسيق.',image:'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=700&q=85',sizes:['S','M','L','XL'],colors:['أبيض','أسود']},
 {id:'HDI490',name:'سويت شيرت كاجوال',category:'هوديز',price:490,desc:'راحة وأناقة في قطعة واحدة.',image:'https://images.unsplash.com/photo-1578681994506-b8f463449011?auto=format&fit=crop&w=700&q=85',sizes:['M','L','XL'],colors:['رمادي','أسود']}
];
let products = readStorage('kaboush_products', demoProducts);
let settings = readStorage('kaboush_settings', {});
let cart = readStorage('kaboush_cart', []);
let activeCategory = 'الكل';
const $ = id => document.getElementById(id);
function readStorage(key, fallback){ try { const v=localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
function saveProducts(){ localStorage.setItem('kaboush_products', JSON.stringify(products)); }
function saveCart(){ localStorage.setItem('kaboush_cart', JSON.stringify(cart)); $('cartCount').textContent = cart.reduce((n,item)=>n+item.qty,0); }
function money(value){ return Number(value).toLocaleString('en-US') + ' ج.م'; }
function escapeHTML(value){ return String(value ?? '').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function toast(message){ const el=$('toast'); el.textContent=message; el.classList.add('show'); window.setTimeout(()=>el.classList.remove('show'),2600); }
function renderCategories(){
 const cats=['الكل',...new Set(products.map(p=>p.category))];
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
function openModal(title,html){$('modalTitle').textContent=title;$('modalBody').innerHTML=html;$('modalBackdrop').classList.add('show');}
function closeModal(){$('modalBackdrop').classList.remove('show');}
function showProduct(id){
 const p=products.find(item=>item.id===id);if(!p)return;
 openModal(p.name,`<img class=\"detail-image\" src=\"${escapeHTML(p.image)}\" alt=\"${escapeHTML(p.name)}\"><p style=\"line-height:1.8\">${escapeHTML(p.desc||'')}</p><div class=\"price\" style=\"font-size:21px;margin:12px 0\">${money(p.price)}</div><div class=\"form-grid\"><label>المقاس<select id=\"detailSize\">${(p.sizes||['غير محدد']).map(s=>`<option>${escapeHTML(s)}</option>`).join('')}</select></label><label>اللون<select id=\"detailColor\">${(p.colors||['غير محدد']).map(c=>`<option>${escapeHTML(c)}</option>`).join('')}</select></label></div><label class=\"field-label\">الكمية<input id=\"detailQty\" type=\"number\" min=\"1\" max=\"20\" value=\"1\" style=\"margin:8px 0 14px;padding:12px;border:1px solid #e8e5df;border-radius:10px;width:100%\"></label><button class=\"button button-green\" id=\"addConfigured\" style=\"width:100%\">أضف لقائمة الحجز</button>`);
 $('addConfigured').addEventListener('click',()=>{const size=$('detailSize').value,color=$('detailColor').value,qty=Math.max(1,Math.min(20,parseInt($('detailQty').value,10)||1));const existing=cart.find(x=>x.id===id&&x.size===size&&x.color===color);if(existing)existing.qty+=qty;else cart.push({id,size,color,qty});saveCart();closeModal();toast('تمت إضافة المنتج إلى قائمة الحجز');});
}
function addToCart(id){const p=products.find(item=>item.id===id);if(!p)return;cart.push({id,size:(p.sizes||['غير محدد'])[0],color:(p.colors||['غير محدد'])[0],qty:1});saveCart();toast('تمت إضافة المنتج إلى قائمة الحجز');}
function openCart(){
 const lines=cart.map((item,index)=>{const p=products.find(x=>x.id===item.id);if(!p)return '';return `<div class=\"cart-line\"><img src=\"${escapeHTML(p.image)}\" alt=\"\"><div class=\"cart-grow\"><strong>${escapeHTML(p.name)}</strong><p>${escapeHTML(item.size)} • ${escapeHTML(item.color)}<br>${money(p.price)}</p><div class=\"qty-controls\"><button data-minus=\"${index}\">−</button><span>${item.qty}</span><button data-plus=\"${index}\">+</button><button data-remove=\"${index}\" style=\"color:#b22\">حذف</button></div></div><strong>${money(p.price*item.qty)}</strong></div>`;}).join('');
 const total=cart.reduce((sum,item)=>{const p=products.find(x=>x.id===item.id);return sum+(p?p.price*item.qty:0);},0);
 openModal('المنتجات المختارة',`${lines||'<div class=\"empty-state\">قائمة الحجز فارغة حاليًا.<br>أضف المنتجات التي أعجبتك أولًا.</div>'}<div style=\"display:flex;justify-content:space-between;padding:18px 0;font-weight:bold\"><span>الإجمالي التقديري</span><span>${money(total)}</span></div><button class=\"button button-green\" id=\"sendCart\" style=\"width:100%\" ${cart.length?'':'disabled'}>إرسال طلب الحجز عبر واتساب</button><p class=\"notice\">الحجز لا يتأكد إلا بعد رد المتجر. الأسعار التجريبية يجب استبدالها بالأسعار الحقيقية.</p>`);
 $('modalBody').querySelectorAll('[data-minus]').forEach(b=>b.addEventListener('click',()=>changeQty(+b.dataset.minus,-1)));
 $('modalBody').querySelectorAll('[data-plus]').forEach(b=>b.addEventListener('click',()=>changeQty(+b.dataset.plus,1)));
 $('modalBody').querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{cart.splice(+b.dataset.remove,1);saveCart();openCart();}));
 $('sendCart').addEventListener('click',sendCart);
}
function changeQty(index,delta){cart[index].qty=Math.max(1,Math.min(20,cart[index].qty+delta));saveCart();openCart();}
function whatsappNumber(){return String(settings.whatsapp||'').replace(/\\D/g,'');}
function openWhatsApp(message){const number=whatsappNumber();if(!number){closeModal();toast('أضف رقم واتساب الصحيح من قسم إدارة المتجر أولًا');$('admin').scrollIntoView({behavior:'smooth'});return;}window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`,'_blank','noopener');}
function sendCart(){if(!cart.length){toast('أضف منتجًا أولًا');return;}const items=cart.map((item,i)=>{const p=products.find(x=>x.id===item.id);return p?`${i+1}) ${p.name} — كود ${p.id}\\nالمقاس: ${item.size} | اللون: ${item.color} | الكمية: ${item.qty}\\nسعر القطعة: ${money(p.price)} | الإجمالي: ${money(p.price*item.qty)}`:''}).filter(Boolean);const total=cart.reduce((sum,item)=>{const p=products.find(x=>x.id===item.id);return sum+(p?p.price*item.qty:0);},0);openWhatsApp(`مرحبًا سنتر كابوش 👋\\nأرغب في حجز المنتجات التالية:\\n\\n${items.join('\\n\\n')}\\n\\nالإجمالي التقديري: ${money(total)}\\nهل المنتجات متاحة؟`);}
function contactWhatsApp(){openWhatsApp('مرحبًا سنتر كابوش، أريد الاستفسار عن المنتجات المتاحة.');}
function saveSettings(){settings={whatsapp:$('adminWhatsapp').value.trim(),phone:$('adminPhone').value.trim(),hours:$('adminHours').value.trim()};localStorage.setItem('kaboush_settings',JSON.stringify(settings));updateContact();toast('تم حفظ الإعدادات على هذا الجهاز');}
function updateContact(){$('adminWhatsapp').value=settings.whatsapp||'';$('adminPhone').value=settings.phone||'';$('adminHours').value=settings.hours||'';$('phoneText').textContent=settings.phone||'رقم الهاتف يُضاف من إعدادات المتجر.';$('whatsappText').textContent=settings.whatsapp?'رقم واتساب: '+settings.whatsapp:'أضف رقم واتساب الحقيقي لتفعيل الحجز.';$('hoursText').textContent=settings.hours||'تُضاف مواعيد العمل المؤكدة من إعدادات المتجر.';if(settings.phone){$('phoneLink').href='tel:'+settings.phone;$('phoneLink').classList.remove('hidden');}else{$('phoneLink').classList.add('hidden');}}
function addProduct(){const name=$('pName').value.trim(),price=Number($('pPrice').value),category=$('pCategory').value,image=$('pImage').value.trim(),id=$('pCode').value.trim()||('KB'+Date.now().toString().slice(-5)),desc=$('pDesc').value.trim();if(!name||$('pPrice').value===''||price<0||!image){toast('أدخل اسم المنتج وسعره ورابط صورته');return;}products.unshift({id,name,price,category,image,desc,sizes:['M','L','XL'],colors:['أسود','أبيض']});saveProducts();renderCategories();renderProducts();['pName','pPrice','pImage','pCode','pDesc'].forEach(key=>$(key).value='');toast('تمت إضافة المنتج');}
function resetDemo(){if(!confirm('استعادة المنتجات التجريبية؟ سيُستبدل كتالوج المنتجات الحالي على هذا الجهاز.'))return;products=demoProducts;saveProducts();renderCategories();renderProducts();toast('تمت استعادة المنتجات التجريبية');}
$('searchForm').addEventListener('submit',e=>{e.preventDefault();renderProducts();$('products').scrollIntoView({behavior:'smooth'});});
$('searchInput').addEventListener('input',renderProducts);
$('showAll').addEventListener('click',()=>{activeCategory='الكل';$('searchInput').value='';renderCategories();renderProducts();});
$('cartTop').addEventListener('click',openCart);$('cartNav').addEventListener('click',openCart);$('openCartCallout').addEventListener('click',openCart);
$('contactWhatsApp').addEventListener('click',contactWhatsApp);$('saveSettings').addEventListener('click',saveSettings);$('addProduct').addEventListener('click',addProduct);$('resetDemo').addEventListener('click',resetDemo);
$('closeModal').addEventListener('click',closeModal);$('modalBackdrop').addEventListener('click',e=>{if(e.target===$('modalBackdrop'))closeModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
document.querySelectorAll('.nav-item[href]').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));a.classList.add('active');}));
$('year').textContent=new Date().getFullYear();renderCategories();renderProducts();saveCart();updateContact();
