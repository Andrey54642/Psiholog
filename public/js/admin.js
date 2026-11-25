// Админ-панель: вход, редактирование всех разделов, загрузка фото, сохранение.
(function () {
  "use strict";

  var TABS = [
    {
      id: "main",
      title: "Основное",
      hint: "Имя, главные фразы, кнопки и баннер",
      fields: [
        { path: "site.psychologistName", label: "Имя и фамилия", type: "text" },
        { path: "site.role", label: "Роль (над именем)", type: "text" },
        { path: "site.tagline", label: "Главная фраза", type: "text" },
        { path: "site.taglineSub", label: "Пояснение под фразой", type: "textarea" },
        { path: "site.bannerTitle", label: "Баннер: заголовок", type: "text" },
        { path: "site.bannerText", label: "Баннер: подпись", type: "text" },
        { path: "site.chip1", label: "Плашка на иллюстрации №1", type: "text" },
        { path: "site.chip2", label: "Плашка на иллюстрации №2", type: "text" },
        { path: "site.primaryBtnText", label: "Текст основной кнопки", type: "text" },
        { path: "site.primaryBtnLink", label: "Ссылка основной кнопки", type: "text", hint: "например https://t.me/username. Если пусто — кнопка скрыта." },
        { path: "site.photoUrl", label: "Фото в шапке (главное фото)", type: "image" }
      ]
    },
    {
      id: "blocks",
      title: "Блоки сайта",
      hint: "Тумблером включайте или скрывайте раздел. Порядок на сайте меняется перетаскиванием строки или стрелками вверх/вниз.",
      blockList: [
        { key: "banner", label: "Баннер «Внешне справляетесь…»" },
        { key: "about", label: "Обо мне и образование" },
        { key: "gallery", label: "Фотографии" },
        { key: "diplomas", label: "Дипломы и сертификаты" },
        { key: "services", label: "Направления работы" },
        { key: "formats", label: "Форматы и цены" },
        { key: "contact", label: "Контакты" }
      ]
    },
    {
      id: "about",
      title: "Обо мне и образование",
      fields: [
        { path: "about.roles", label: "Заголовок блока", type: "text" },
        { path: "about.methodsText", label: "Текст о подходе", type: "textarea" },
        { path: "about.eduTitle", label: "Заголовок карточки образования", type: "text" },
        { path: "about.educationText", label: "Текст об образовании", type: "textarea" }
      ]
    },
    {
      id: "gallery",
      title: "Фотографии",
      hint: "Блок с тремя фотографиями на сайте",
      fields: [
        { path: "gallery.title", label: "Заголовок блока", type: "text" }
      ],
      repeater: {
        path: "gallery.items",
        itemLabel: "Фото",
        addLabel: "Добавить фото",
        fields: [
          { key: "image", label: "Фотография", type: "image" },
          { key: "caption", label: "Подпись (необязательно)", type: "text" }
        ]
      }
    },
    {
      id: "diplomas",
      title: "Дипломы",
      hint: "Отдельный блок с фото дипломов и сертификатов",
      fields: [
        { path: "diplomas.title", label: "Заголовок блока", type: "text" }
      ],
      repeater: {
        path: "diplomas.items",
        itemLabel: "Диплом",
        addLabel: "Добавить диплом",
        fields: [
          { key: "image", label: "Фото диплома", type: "image" },
          { key: "title", label: "Название (необязательно)", type: "text" }
        ]
      }
    },
    {
      id: "services",
      title: "Направления работы",
      hint: "Каждый пункт — абзац с галочкой в блоке «С чем я помогаю»",
      repeater: {
        path: "services",
        itemLabel: "Направление",
        addLabel: "Добавить направление",
        fields: [{ key: "text", label: "Текст", type: "textarea" }]
      }
    },
    {
      id: "formats",
      title: "Форматы и цены",
      fields: [
        { path: "formats.price", label: "Базовая цена", type: "text" },
        { path: "formats.note", label: "Примечание о семейной консультации", type: "textarea" }
      ],
      repeater: {
        path: "formats.items",
        itemLabel: "Формат",
        addLabel: "Добавить формат",
        stringItems: true,
        fields: [{ key: "text", label: "Описание формата", type: "textarea" }]
      }
    },
    {
      id: "packages",
      title: "Пакеты сессий",
      repeater: {
        path: "packages",
        itemLabel: "Пакет",
        addLabel: "Добавить пакет",
        fields: [
          { key: "name", label: "Название", type: "text" },
          { key: "price", label: "Цена", type: "text" },
          { key: "badge", label: "Плашка (необязательно)", type: "text" },
          { key: "text", label: "Описание", type: "textarea" }
        ]
      }
    },
    {
      id: "contacts",
      title: "Контакты и соцсети",
      hint: "Не заполненные способы связи на сайте скрыты. Заполните хотя бы одну соцсеть — по ней можно будет написать",
      fields: [
        { path: "contacts.telegram", label: "Telegram", type: "text", hint: "https://t.me/username" },
        { path: "contacts.whatsapp", label: "WhatsApp", type: "text", hint: "https://wa.me/7xxxxxxxxxx" },
        { path: "contacts.max", label: "Max (мессенджер)", type: "text", hint: "https://max.ru/u/username" },
        { path: "contacts.vk", label: "ВКонтакте", type: "text", hint: "https://vk.com/username" },
        { path: "contacts.instagram", label: "Instagram", type: "text", hint: "https://instagram.com/username" },
        { path: "contacts.phone", label: "Телефон", type: "text", hint: "+7 …" },
        { path: "contacts.email", label: "Email", type: "text" },
        { path: "contacts.city", label: "Город", type: "text", hint: "Для SEO-разметки (можно оставить пустым)" },
        { path: "contacts.note", label: "Текст блока контактов", type: "textarea" }
      ]
    },
    {
      id: "seo",
      title: "SEO",
      hint: "Как сайт выглядит в поиске и соцсетях",
      fields: [
        { path: "seo.title", label: "Title (заголовок вкладки)", type: "text" },
        { path: "seo.description", label: "Description (сниппет в поиске)", type: "textarea" },
        { path: "seo.keywords", label: "Keywords (ключевые слова)", type: "text" },
        { path: "seo.canonical", label: "Домен сайта", type: "text", hint: "https://vash-site.ru — без слэша на конце. Нужен для canonical, sitemap.xml и Open Graph." },
        { path: "seo.ogImage", label: "Картинка для соцсетей (URL или загрузите файл)", type: "image" }
      ]
    },
    { id: "password", title: "Смена пароля", password: true }
  ];

  var state = null;

  // ---------- утилиты ----------

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function getPath(obj, path) {
    return path.split(".").reduce(function (cur, key) {
      return cur == null ? undefined : cur[key];
    }, obj);
  }

  function setPath(obj, path, value) {
    var keys = path.split(".");
    var cur = obj;
    for (var i = 0; i < keys.length - 1; i++) {
      if (typeof cur[keys[i]] !== "object" || cur[keys[i]] === null) cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
  }

  function token() { return sessionStorage.getItem("psyAdminToken") || ""; }

  function api(method, path, body) {
    var opts = { method: method, headers: {} };
    if (token()) opts.headers["Authorization"] = "Bearer " + token();
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    return fetch(path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.status === 401 && path !== "/api/login") {
          showLogin();
          throw new Error("Требуется авторизация");
        }
        if (!res.ok) throw new Error(data.error || ("Ошибка " + res.status));
        return data;
      });
    });
  }

  var toastTimer = null;
  function toast(message, isError) {
    var el = $("#toast");
    el.textContent = message;
    el.classList.toggle("toast--error", !!isError);
    el.classList.add("toast--show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("toast--show"); }, 3600);
  }

  // ---------- экраны ----------

  function showLogin() {
    sessionStorage.removeItem("psyAdminToken");
    $("#appView").hidden = true;
    $("#loginView").hidden = false;
    $("#loginPassword").value = "";
    setTimeout(function () { $("#loginPassword").focus(); }, 50);
  }

  function showApp() {
    $("#loginView").hidden = true;
    $("#appView").hidden = false;
  }

  // ---------- загрузка изображений ----------

  function setPreviewImage(preview, url) {
    if (url) {
      preview.innerHTML = "";
      var img = document.createElement("img");
      img.src = url;
      img.alt = "";
      preview.appendChild(img);
    } else {
      preview.innerHTML = "<span>Нет фото</span>";
    }
  }

  function uploadImage(fileInput, btn, done) {
    if (!fileInput.files.length) {
      toast("Сначала выберите файл", true);
      return;
    }
    var fd = new FormData();
    fd.append("file", fileInput.files[0]);
    btn.disabled = true;
    btn.textContent = "Загрузка…";
    fetch("/api/upload", { method: "POST", headers: { "Authorization": "Bearer " + token() }, body: fd })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || ("Ошибка " + res.status));
          return data;
        });
      })
      .then(function (data) {
        done(data.url);
        toast("Фото загружено. Не забудьте нажать «Сохранить изменения».");
      })
      .catch(function (err) { toast(err.message, true); })
      .then(function () {
        btn.disabled = false;
        btn.textContent = "Загрузить";
        fileInput.value = "";
      });
  }

  // Обертка для поля с картинкой: превью + URL + выбор файла.
  // Текстовое поле с data-path / data-itemfield передаётся сюда и попадает внутрь.
  function buildImageControl(input) {
    var wrap = document.createElement("div");
    wrap.className = "imagepick";

    var preview = document.createElement("div");
    preview.className = "imagepick__preview";

    var row = document.createElement("div");
    row.className = "imagepick__row";

    var file = document.createElement("input");
    file.type = "file";
    file.accept = "image/jpeg,image/png,image/webp,image/gif";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn--secondary btn--small";
    btn.textContent = "Загрузить";

    row.appendChild(file);
    row.appendChild(btn);
    wrap.appendChild(preview);
    wrap.appendChild(input);
    wrap.appendChild(row);

    function refresh() { setPreviewImage(preview, input.value); }
    input.addEventListener("input", refresh);
    btn.addEventListener("click", function () { uploadImage(file, btn, function (url) { input.value = url; refresh(); }); });
    file.addEventListener("change", function () { uploadImage(file, btn, function (url) { input.value = url; refresh(); }); });
    refresh();
    return wrap;
  }

  // ---------- построение интерфейса ----------

  function buildField(field) {
    var wrap = document.createElement("div");
    wrap.className = "field";

    if (field.type === "checkbox") {
      wrap.className = "field field--switch";
      var label = document.createElement("label");
      label.className = "switch";
      var input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.path = field.path;
      var track = document.createElement("span");
      track.className = "switch__track";
      var text = document.createElement("span");
      text.className = "switch__label";
      text.textContent = field.label;
      label.appendChild(input);
      label.appendChild(track);
      label.appendChild(text);
      wrap.appendChild(label);
      if (field.hint) {
        var hint = document.createElement("p");
        hint.className = "field__hint";
        hint.textContent = field.hint;
        wrap.appendChild(hint);
      }
      return wrap;
    }

    var label = document.createElement("label");
    label.textContent = field.label;
    wrap.appendChild(label);

    var control;
    if (field.type === "textarea") {
      control = document.createElement("textarea");
    } else {
      control = document.createElement("input");
      control.type = "text";
    }
    control.dataset.path = field.path;

    if (field.type === "image") {
      wrap.appendChild(buildImageControl(control));
    } else {
      wrap.appendChild(control);
    }

    if (field.hint) {
      var hint = document.createElement("p");
      hint.className = "field__hint";
      hint.textContent = field.hint;
      wrap.appendChild(hint);
    }
    return wrap;
  }

  function buildRepeaterRow(repeater, item, index) {
    var row = document.createElement("div");
    row.className = "repeater__row";

    var head = document.createElement("div");
    head.className = "repeater__rowHead";
    head.innerHTML = '<span class="repeater__rowNum">' + esc(repeater.itemLabel) + " №" + (index + 1) + "</span>";
    var del = document.createElement("button");
    del.type = "button";
    del.className = "linkbtn linkbtn--danger";
    del.textContent = "Удалить";
    del.addEventListener("click", function () {
      row.remove();
      renumberRows(repeater);
      refreshRepeaterTitles(repeater);
    });
    head.appendChild(del);
    row.appendChild(head);

    repeater.fields.forEach(function (f) {
      var label = document.createElement("label");
      var caption = document.createElement("span");
      caption.textContent = f.label;
      label.appendChild(caption);

      var control = f.type === "textarea" ? document.createElement("textarea") : document.createElement("input");
      if (f.type !== "textarea") control.type = "text";
      control.dataset.itemfield = f.key;

      if (f.type === "image") {
        label.appendChild(buildImageControl(control));
      } else {
        label.appendChild(control);
      }

      var value = repeater.stringItems ? item : (item ? item[f.key] : "");
      control.value = value == null ? "" : value;

      row.appendChild(label);
    });

    return row;
  }

  function renumberRows(repeater) {
    $$(".repeater[data-repeater='" + repeater.path + "'] .repeater__row").forEach(function (row, i) {
      $(".repeater__rowNum", row).textContent = repeater.itemLabel + " №" + (i + 1);
    });
  }

  function refreshRepeaterTitles(repeater) {
    var wrap = $(".repeater[data-repeater='" + repeater.path + "']");
    if (!wrap) return;
    var count = $(".repeater__rows", wrap).children.length;
    $(".repeater__title", wrap).textContent = repeater.itemLabel + " — " + count + " шт.";
    $(".repeater__empty", wrap).style.display = count ? "none" : "";
  }

  function buildRepeater(repeater, items) {
    var wrap = document.createElement("div");
    wrap.className = "repeater";
    wrap.dataset.repeater = repeater.path;

    var head = document.createElement("div");
    head.className = "repeater__head";
    var title = document.createElement("strong");
    title.className = "repeater__title";
    head.appendChild(title);
    var addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn--secondary btn--small";
    addBtn.textContent = repeater.addLabel;
    head.appendChild(addBtn);
    wrap.appendChild(head);

    var rows = document.createElement("div");
    rows.className = "repeater__rows";
    wrap.appendChild(rows);

    var empty = document.createElement("p");
    empty.className = "repeater__empty";
    empty.textContent = "Пока пусто — добавьте первый пункт.";
    wrap.appendChild(empty);

    items.forEach(function (item, i) {
      rows.appendChild(buildRepeaterRow(repeater, item, i));
    });
    refreshRepeaterTitles(repeater);

    addBtn.addEventListener("click", function () {
      rows.appendChild(buildRepeaterRow(repeater, repeater.stringItems ? "" : {}, rows.children.length));
      refreshRepeaterTitles(repeater);
      renumberRows(repeater);
    });

    return wrap;
  }

  // ---------- список блоков сайта с сортировкой ----------

  function buildBlockRow(block) {
    var row = document.createElement("div");
    row.className = "blocklist__row";
    row.draggable = true;
    row.dataset.block = block.key;

    var handle = document.createElement("span");
    handle.className = "blocklist__handle";
    handle.textContent = "⠿";
    handle.title = "Перетащите, чтобы изменить порядок";
    row.appendChild(handle);

    var title = document.createElement("span");
    title.className = "blocklist__label";
    title.textContent = block.label;
    row.appendChild(title);

    var switchLabel = document.createElement("label");
    switchLabel.className = "switch";
    var toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.dataset.path = "blocks." + block.key;
    var track = document.createElement("span");
    track.className = "switch__track";
    switchLabel.appendChild(toggle);
    switchLabel.appendChild(track);
    switchLabel.title = "Показать или скрыть блок на сайте";
    row.appendChild(switchLabel);

    var move = document.createElement("div");
    move.className = "blocklist__move";
    var up = document.createElement("button");
    up.type = "button";
    up.textContent = "↑";
    up.title = "Переместить выше";
    up.addEventListener("click", function () { moveBlockRow(row, -1); });
    var down = document.createElement("button");
    down.type = "button";
    down.textContent = "↓";
    down.title = "Переместить ниже";
    down.addEventListener("click", function () { moveBlockRow(row, 1); });
    move.appendChild(up);
    move.appendChild(down);
    row.appendChild(move);

    return row;
  }

  function moveBlockRow(row, dir) {
    var rows = row.parentNode;
    if (dir < 0 && row.previousElementSibling) {
      rows.insertBefore(row, row.previousElementSibling);
    } else if (dir > 0 && row.nextElementSibling) {
      rows.insertBefore(row.nextElementSibling, row);
    }
  }

  function dragAfterElement(container, y) {
    var rows = $$(".blocklist__row:not(.blocklist__row--dragging)", container);
    var closest = { offset: -Infinity, element: null };
    rows.forEach(function (child) {
      var box = child.getBoundingClientRect();
      var offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) closest = { offset: offset, element: child };
    });
    return closest.element;
  }

  function buildBlockList(blocks, content) {
    var wrap = document.createElement("div");
    wrap.className = "blocklist";

    var known = blocks.map(function (b) { return b.key; });
    var byKey = {};
    blocks.forEach(function (b) { byKey[b.key] = b; });

    // Порядок из сохранённых настроек + блоки, которых в нём нет, в конец
    var saved = getPath(content, "blockOrder");
    var names = [];
    (Array.isArray(saved) ? saved : []).forEach(function (name) {
      if (known.indexOf(name) !== -1 && names.indexOf(name) === -1) names.push(name);
    });
    known.forEach(function (name) {
      if (names.indexOf(name) === -1) names.push(name);
    });

    var rows = document.createElement("div");
    rows.className = "blocklist__rows";
    names.forEach(function (name) { rows.appendChild(buildBlockRow(byKey[name])); });
    wrap.appendChild(rows);

    var dragging = null;
    rows.addEventListener("dragstart", function (event) {
      dragging = event.target.closest ? event.target.closest(".blocklist__row") : null;
      if (!dragging) return;
      dragging.classList.add("blocklist__row--dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragging.dataset.block);
    });
    rows.addEventListener("dragend", function () {
      if (dragging) dragging.classList.remove("blocklist__row--dragging");
      dragging = null;
    });
    rows.addEventListener("dragover", function (event) {
      event.preventDefault();
      if (!dragging) return;
      var after = dragAfterElement(rows, event.clientY);
      if (after) rows.insertBefore(dragging, after);
      else rows.appendChild(dragging);
    });

    return wrap;
  }

  function buildPasswordPanel() {
    var form = document.createElement("form");
    form.className = "passwordForm";
    form.innerHTML =
      "<h2>Смена пароля админ-панели</h2>" +
      "<p>После смены пароля потребуется войти заново.</p>" +
      "<label>Текущий пароль<input type='password' id='pwdCurrent' autocomplete='current-password' required></label>" +
      "<label>Новый пароль (не короче 6 символов)<input type='password' id='pwdNext' autocomplete='new-password' required minlength='6'></label>" +
      "<label>Повторите новый пароль<input type='password' id='pwdConfirm' autocomplete='new-password' required minlength='6'></label>" +
      "<button class='btn' type='submit'>Сменить пароль</button>";
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var next = $("#pwdNext").value;
      if (next !== $("#pwdConfirm").value) {
        toast("Новые пароли не совпадают", true);
        return;
      }
      api("POST", "/api/password", { current: $("#pwdCurrent").value, next: next })
        .then(function () {
          toast("Пароль изменён. Войдите заново.");
          setTimeout(showLogin, 1200);
        })
        .catch(function (err) { toast(err.message, true); });
    });
    return form;
  }

  function buildUI(content) {
    var nav = $("#tabsNav");
    var panels = $("#tabPanels");
    nav.innerHTML = "";
    panels.innerHTML = "";

    TABS.forEach(function (tab) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tab";
      btn.textContent = tab.title;
      btn.addEventListener("click", function () { activateTab(tab.id); });
      nav.appendChild(btn);

      var panel = document.createElement("section");
      panel.className = "panel";
      panel.dataset.tab = tab.id;
      if (tab.fields) {
        tab.fields.forEach(function (f) { panel.appendChild(buildField(f)); });
      }
      if (tab.blockList) {
        panel.appendChild(buildBlockList(tab.blockList, content));
      }
      if (tab.repeater) {
        var items = getPath(content, tab.repeater.path);
        panel.appendChild(buildRepeater(tab.repeater, Array.isArray(items) ? items : []));
      }
      if (tab.password) {
        panel.appendChild(buildPasswordPanel());
      }
      panels.appendChild(panel);
    });

    fillValues(content);
    activateTab(TABS[0].id);
  }

  function fillValues(content) {
    $$("[data-path]").forEach(function (control) {
      var value = getPath(content, control.dataset.path);
      if (control.type === "checkbox") {
        control.checked = value === true || value === "true" || value === "1";
      } else {
        control.value = value == null ? "" : value;
      }
    });
    // Обновляем превью всех картинок после подстановки значений
    $$(".imagepick").forEach(function (pick) {
      var input = $("input[data-path], input[data-itemfield]", pick);
      if (input) setPreviewImage($(".imagepick__preview", pick), input.value);
    });
  }

  function activateTab(id) {
    $$(".tab").forEach(function (btn, i) {
      btn.classList.toggle("tab--active", TABS[i].id === id);
    });
    $$(".panel").forEach(function (panel) {
      panel.classList.toggle("panel--active", panel.dataset.tab === id);
    });
    var tab = TABS.filter(function (t) { return t.id === id; })[0];
    $("#tabTitle").textContent = tab.title;
    $("#tabHint").textContent = tab.hint || "";
  }

  // ---------- сбор и сохранение ----------

  function collect() {
    var content = JSON.parse(JSON.stringify(state));

    $$("[data-path]").forEach(function (control) {
      var value = control.type === "checkbox" ? control.checked : control.value;
      setPath(content, control.dataset.path, value);
    });

    var blockRows = $$(".blocklist__row");
    if (blockRows.length) {
      content.blockOrder = blockRows.map(function (row) { return row.dataset.block; });
    }

    TABS.forEach(function (tab) {
      if (!tab.repeater) return;
      var wrap = $(".repeater[data-repeater='" + tab.repeater.path + "']");
      if (!wrap) return;
      var rows = $$(".repeater__row", wrap);
      var items;
      if (tab.repeater.stringItems) {
        items = rows.map(function (row) {
          var control = $("[data-itemfield]", row);
          return control ? control.value : "";
        });
      } else {
        items = rows.map(function (row) {
          var item = {};
          $$("[data-itemfield]", row).forEach(function (control) {
            item[control.dataset.itemfield] = control.value;
          });
          return item;
        });
      }
      setPath(content, tab.repeater.path, items);
    });

    return content;
  }

  function save() {
    var content = collect();
    var btn = $("#saveBtn");
    btn.disabled = true;
    api("PUT", "/api/content", content)
      .then(function () {
        state = content;
        toast("Сохранено. Изменения уже на сайте.");
      })
      .catch(function (err) { toast(err.message, true); })
      .then(function () { btn.disabled = false; });
  }

  // ---------- вход / выход ----------

  $("#loginForm").addEventListener("submit", function (event) {
    event.preventDefault();
    var errorEl = $("#loginError");
    errorEl.textContent = "";
    api("POST", "/api/login", { password: $("#loginPassword").value })
      .then(function (data) {
        sessionStorage.setItem("psyAdminToken", data.token);
        return loadContent();
      })
      .catch(function (err) { errorEl.textContent = err.message; });
  });

  $("#logoutBtn").addEventListener("click", function () {
    api("POST", "/api/logout", {}).catch(function () {}).then(function () {
      showLogin();
    });
  });

  $("#saveBtn").addEventListener("click", save);

  function loadContent() {
    return api("GET", "/api/content").then(function (content) {
      state = content;
      buildUI(content);
      showApp();
    });
  }

  // ---------- старт ----------

  if (token()) {
    loadContent().catch(showLogin);
  } else {
    showLogin();
  }
})();
