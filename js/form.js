(async function () {
  const $ = s => document.querySelector(s), money = n => '$' + n.toFixed(2);
  const form = $('#form'), msg = $('#msg'), btn = $('#btn');
  const loadedAt = Date.now(), eventId = crypto.randomUUID();

  let catalog, sku, product;
  try {
    catalog = await (await fetch('data/productos.json?v=3')).json();
    const q = new URLSearchParams(location.search).get('p');
    sku = catalog[q] ? q : Object.keys(catalog)[0];
    product = catalog[sku];
  } catch (e) { msg.textContent = 'No se pudo cargar el producto.'; return; }

  const th = product.theme || {}, root = document.documentElement.style;
  if (th.primary) root.setProperty('--p', th.primary);
  if (th.soft) root.setProperty('--soft', th.soft);
  document.title = product.name + ' | ' + CONFIG.STORE;
  $('#store').textContent = CONFIG.STORE;
  $('#prod-name').textContent = product.name;
  $('#tagline').textContent = product.tagline || '';
  $('#prod-sub').textContent = product.subtitle || '';
  $('#notice').textContent = product.notice || '';
  $('#gallery').innerHTML = (product.images || []).map(s => `<img src="${s}" alt="${product.name}" loading="lazy">`).join('');
  $('#highlights').innerHTML = (product.highlights || []).map(h => `<div class="card"><span>${h.icon}</span><b>${h.title}</b><p>${h.text}</p></div>`).join('');
  $('#info').innerHTML = (product.info || []).map(i => `<div class="row"><b>${i.title}</b><span>${i.text}</span></div>`).join('');
  $('#wa').href = `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent('Hola ' + CONFIG.STORE + ', quiero información de ' + product.name)}`;

  const base = product.packs[0].price, def = product.packs.length > 1 ? 1 : 0, rec = product.packs[def];
  $('#p-each').textContent = money(base);
  $('#p-label').textContent = rec.qty > 1 ? 'Pack x' + rec.qty : 'Precio';
  $('#p-pack').textContent = money(rec.price);
  const ahorro = base * rec.qty - rec.price;
  $('#p-save').textContent = ahorro > 0 ? 'Ahorras ' + money(ahorro) : '';

  $('#packs').innerHTML = product.packs.map((k, i) => {
    const extra = k.qty > 1 ? `${money(k.price / k.qty)} c/u · ahorras ${money(base * k.qty - k.price)}` : '';
    return `<label class="pack"><input type="radio" name="pack" value="${i}" ${i === def ? 'checked' : ''}><b>${k.qty} ${k.qty > 1 ? 'frascos' : 'frasco'}</b> — ${money(k.price)}<small>${extra}${i === def ? ' · Recomendado' : ''}</small></label>`;
  }).join('');
  const upd = () => { $('#total').textContent = money(product.packs[+form.pack.value].price); };
  form.addEventListener('change', e => { if (e.target.name === 'pack') upd(); });
  upd();

  const st = $('.sticky');
  new IntersectionObserver(([en]) => st.classList.toggle('off', en.isIntersecting)).observe($('#pedido'));

  function normalizePhone(v) {
    let d = (v || '').replace(/\D/g, '');
    if (d.startsWith('593') && d.length === 12) d = '0' + d.slice(3);
    return d;
  }
  const host = u => { try { return new URL(u).hostname; } catch (e) { return ''; } };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const phone = normalizePhone(f.phone);
    const err =
      f.first_names.trim().length < 2 ? 'Escribe tus nombres.' :
      f.last_names.trim().length < 2 ? 'Escribe tus apellidos.' :
      !/^09\d{8}$/.test(phone) ? 'El celular debe tener 10 dígitos y empezar con 09.' :
      f.address.trim().length < 10 ? 'Escribe una dirección más completa.' :
      f.reference.trim().length < 3 ? 'Agrega una referencia.' :
      (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) ? 'El correo no es válido.' : '';
    if (err) { msg.textContent = err; return; }
    if (f.website) { msg.textContent = '¡Gracias!'; return; }

    const pack = product.packs[+f.pack], T = window.TRACKING || {};
    const payload = {
      schema_version: '1.1', event_id: eventId, submitted_at: new Date().toISOString(),
      source: {
        o: T.o || '', utm_source: T.utm_source || '', utm_medium: T.utm_medium || '',
        utm_campaign: T.utm_campaign || '', utm_content: T.utm_content || '', utm_term: T.utm_term || '',
        channel: T.utm_source || T.o || host(T.referrer) || 'directo',
        click_id: T.ttclid || T.fbclid || '', landing_url: T.landing_url || '', referrer: T.referrer || ''
      },
      product: { sku, total_displayed: pack.price },
      customer: {
        first_names: f.first_names.trim(), last_names: f.last_names.trim(), phone,
        province: f.province, city: f.city.trim(), address: f.address.trim(),
        reference: f.reference.trim(), email: (f.email || '').trim()
      },
      order: { quantity: pack.qty, payment_method: 'contra_entrega' },
      antispam: { honeypot: f.website || '', form_loaded_at: loadedAt }
    };

    btn.disabled = true; msg.textContent = 'Enviando…';
    try {
      const r = await fetch(CONFIG.WEBHOOK_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error || 'error');
      goWhatsApp(data.order_id, pack);
    } catch (x) {
      const cu = payload.customer;
      const t = `Hola, quiero pedir ${product.name} (${pack.qty} und.). ${cu.first_names} ${cu.last_names}, cel ${cu.phone}, ${cu.city}, ${cu.address} (${cu.reference})`;
      location.href = `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(t)}`;
    }
  });

  function goWhatsApp(orderId, pack) {
    const text = `Hola ${CONFIG.STORE}, confirmo mi pedido ${orderId} de ${product.name} (${pack.qty} und.)`;
    const url = `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(text)}`;
    form.innerHTML = `<h2>¡Pedido recibido!</h2><p>Confírmalo por WhatsApp para despacharlo.</p><a class="btn" href="${url}">Confirmar por WhatsApp</a>`;
    setTimeout(() => { location.href = url; }, 1200);
  }
})();