  (async function () {
    const $ = s => document.querySelector(s);
    const form = $('#form'), msg = $('#msg'), btn = $('#btn');
    const loadedAt = Date.now();
    const eventId = crypto.randomUUID(); // mismo id si reintenta: evita duplicados
    
    let catalog, sku, product;
    try {
      catalog = await (await fetch('data/productos.json')).json();
      const q = new URLSearchParams(location.search).get('p');
      sku = catalog[q] ? q : Object.keys(catalog)[0];
      product = catalog[sku];
    } catch (e) { msg.textContent = 'No se pudo cargar el producto.'; return; }
     $('#prod-name').textContent = product.name;
      $('#prod-sub').textContent = product.subtitle || '';
      $('#notice').textContent = product.notice || '';
      $('#bullets').innerHTML = (product.bullets || []).map(b => `<li>${b}</li>`).join('');
      $('#gallery').innerHTML = (product.images || []).map(s => `<img src="${s}" alt="${product.name}" loading="lazy">`).join('');
      const base = product.packs[0].price, def = product.packs.length > 1 ? 1 : 0;
      $('#packs').innerHTML = product.packs.map((k, i) => {
        const each = (k.price / k.qty).toFixed(2);
        const save = (base * k.qty - k.price).toFixed(2);
        const extra = k.qty > 1 ? `$${each} c/u · ahorras $${save}` : '';
        return `<label class="pack"><input type="radio" name="pack" value="${i}" ${i === def ? 'checked' : ''}><b>${k.qty} ${k.qty > 1 ? 'frascos' : 'frasco'}</b> — $${k.price.toFixed(2)}<small>${extra}${i === def ? ' · Recomendado' : ''}</small></label>`;
      }).join('');

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
        !f.province ? 'Elige tu provincia.' :
        f.city.trim().length < 2 ? 'Escribe tu ciudad.' :
        f.address.trim().length < 10 ? 'Escribe una dirección más completa.' :
        f.reference.trim().length < 3 ? 'Agrega una referencia.' :
        (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) ? 'El correo no es válido.' : '';
      if (err) { msg.textContent = err; return; }
      if (f.website) { msg.textContent = '¡Gracias!'; return; } // honeypot: bot

      const pack = product.packs[+f.pack], T = window.TRACKING || {};
      const payload = {
        schema_version: '1.1',
        event_id: eventId,
        submitted_at: new Date().toISOString(),
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
      const t = `Hola, quiero pedir ${product.name} (${pack.qty} und.). ${cu.first_names} ${cu.last_names}, cel ${cu.phone}, ${cu.province}, ${cu.city}, ${cu.address} (${cu.reference})`;
      location.href = `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(t)}`;
      }
    });

    function goWhatsApp(orderId, pack) {
      const text = `Hola, confirmo mi pedido ${orderId} de ${product.name} (${pack.qty} und.)`;
      const url = `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(text)}`;
      form.innerHTML = `<h2>¡Pedido recibido!</h2><p>Confírmalo por WhatsApp para despacharlo.</p><a class="btn" href="${url}">Confirmar por WhatsApp</a>`;
      setTimeout(() => { location.href = url; }, 1200);
    }
  })();