#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сервер сайта психолога.

Только стандартная библиотека Python — зависимости устанавливать не нужно.

Запуск:        python server.py
Сайт:          http://localhost:3000
Админ-панель:  http://localhost:3000/admin   (пароль по умолчанию: admin123)
"""

import hashlib
import json
import os
import re
import secrets
import time
from datetime import date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT / "public"
CONTENT_FILE = ROOT / "content.json"
ADMIN_FILE = ROOT / "admin.json"
UPLOAD_DIR = PUBLIC_DIR / "uploads"
PORT = int(os.environ.get("PORT", "3000"))
MAX_BODY = 256 * 1024
MAX_UPLOAD = 5 * 1024 * 1024  # 5 МБ
SESSION_TTL = 12 * 3600  # 12 часов

MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".xml": "application/xml; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".woff2": "font/woff2",
}


# --------------------------------------------------------------------------
# Мини-шаблонизатор: {{путь.к.полю}}, <!--each:путь-->...<!--endeach-->,
# <!--if:путь-->...<!--endif-->, <!--ifnot:путь-->...<!--endif-->
# Порядок важен: сначала списки, потом условия, потом переменные.
# --------------------------------------------------------------------------

TOKEN_RE = re.compile(r"\{\{([\w.]+)\}\}")
EACH_RE = re.compile(r"<!--each:([\w.]+)-->([\s\S]*?)<!--endeach-->")
IF_RE = re.compile(r"<!--if:([\w.]+)-->([\s\S]*?)<!--endif-->")
IFNOT_RE = re.compile(r"<!--ifnot:([\w.]+)-->([\s\S]*?)<!--endif-->")


def get_path(obj, path):
    cur = obj
    for part in path.split("."):
        if isinstance(cur, dict):
            cur = cur.get(part)
        else:
            return None
    return cur


def esc(value):
    text = "" if value is None else str(value)
    return (text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace('"', "&quot;")
                .replace("'", "&#39;"))


def resolve(scope, key):
    if key == "index":
        return scope.get("index")
    if key == "this":
        return scope.get("this")
    if key.startswith("this."):
        return get_path(scope.get("this"), key[5:])
    if key.startswith("root."):
        return get_path(scope["root"], key[5:])
    return get_path(scope["root"], key)


def render_tpl(html, scope):
    def each_sub(match):
        arr = resolve(scope, match.group(1))
        if not isinstance(arr, list) or not arr:
            return ""
        inner = match.group(2)
        return "".join(
            render_tpl(inner, {"root": scope["root"], "this": item, "index": i})
            for i, item in enumerate(arr, 1)
        )

    def if_sub(match):
        return render_tpl(match.group(2), scope) if resolve(scope, match.group(1)) else ""

    def ifnot_sub(match):
        return "" if resolve(scope, match.group(1)) else render_tpl(match.group(2), scope)

    html = EACH_RE.sub(each_sub, html)
    html = IF_RE.sub(if_sub, html)
    html = IFNOT_RE.sub(ifnot_sub, html)
    return TOKEN_RE.sub(lambda m: esc(resolve(scope, m.group(1))), html)


# --------------------------------------------------------------------------
# Данные: контент и учётные данные администратора
# --------------------------------------------------------------------------

class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


sessions = {}        # token -> время истечения
login_attempts = {}  # ip -> [количество попыток, время сброса]


def ensure_admin_file():
    if not ADMIN_FILE.exists():
        ADMIN_FILE.write_text(json.dumps({
            "passwordHash": hashlib.sha256("admin123".encode("utf-8")).hexdigest(),
            "updatedAt": "",
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        print("[!] Создан admin.json с паролем по умолчанию «admin123» — смените его в админ-панели.")


def get_content():
    return json.loads(CONTENT_FILE.read_text(encoding="utf-8"))


def save_content(data):
    tmp = CONTENT_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(CONTENT_FILE)


def get_admin():
    return json.loads(ADMIN_FILE.read_text(encoding="utf-8"))


def save_admin(data):
    ADMIN_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def as_str(value, max_len=20000):
    if value is None:
        return ""
    if not isinstance(value, str):
        value = str(value)
    return value[:max_len]


def sanitize_list(data, current, section, item_fields, limit):
    """Секции вида {'title': str, 'items': [{...}]} — фотографии, дипломы."""
    raw = data.get(section)
    base = current.get(section, {})
    if not isinstance(raw, dict):
        return base
    items_in = raw.get("items")
    items = [
        {f: as_str(item.get(f), 500 if f == "image" else 5000) for f in item_fields}
        for item in items_in[:limit]
        if isinstance(item, dict)
    ] if isinstance(items_in, list) else base.get("items", [])
    return {
        "title": as_str(raw.get("title", base.get("title", "")), 300),
        "items": items,
    }


def sanitize(data, current):
    """Принимает только известные ключи — админка не сможет сломать сайт."""
    if not isinstance(data, dict):
        raise ApiError(400, "Некорректные данные")
    out = {}
    for section in ("site", "about", "formats", "contacts", "seo"):
        src = data.get(section)
        src = src if isinstance(src, dict) else {}
        base = current.get(section)
        base = base if isinstance(base, dict) else {}
        merged = {}
        keys = list(base.keys()) + [k for k in src.keys() if k not in base]
        for key in keys:
            value = src.get(key, base.get(key))
            if isinstance(value, list):
                merged[key] = [x for x in value[:20] if isinstance(x, str)]
            else:
                merged[key] = as_str(value)
        out[section] = merged

    # Переключатели видимости блоков — только булевы значения
    raw_blocks = data.get("blocks")
    base_blocks = current.get("blocks", {})
    out["blocks"] = {}
    block_keys = list(base_blocks.keys())
    if isinstance(raw_blocks, dict):
        block_keys += [k for k in raw_blocks.keys() if k not in base_blocks]
    for key in block_keys:
        if isinstance(raw_blocks, dict) and key in raw_blocks:
            out["blocks"][key] = bool(raw_blocks[key])
        else:
            out["blocks"][key] = bool(base_blocks.get(key))

    out["gallery"] = sanitize_list(data, current, "gallery", ("image", "caption"), 12)
    out["diplomas"] = sanitize_list(data, current, "diplomas", ("image", "title"), 20)

    raw_services = data.get("services")
    if isinstance(raw_services, list):
        out["services"] = [
            {"text": as_str(item.get("text"), 10000)}
            for item in raw_services[:30]
            if isinstance(item, dict)
        ]
    else:
        out["services"] = current.get("services", [])

    raw_packages = data.get("packages")
    if isinstance(raw_packages, list):
        out["packages"] = [{
            "name": as_str(item.get("name"), 300),
            "price": as_str(item.get("price"), 100),
            "text": as_str(item.get("text"), 5000),
            "badge": as_str(item.get("badge"), 100),
        } for item in raw_packages[:10] if isinstance(item, dict)]
    else:
        out["packages"] = current.get("packages", [])
    return out


# --------------------------------------------------------------------------
# SEO: Schema.org (JSON-LD), og:image
# --------------------------------------------------------------------------

def build_jsonld(c):
    site = c.get("site", {})
    seo = c.get("seo", {})
    contacts = c.get("contacts", {})
    canonical = (seo.get("canonical", "") or "").strip().rstrip("/")
    image = (seo.get("ogImage", "") or site.get("photoUrl", "") or "").strip()

    images = []
    if image:
        images.append(image)
    for item in c.get("gallery", {}).get("items", []):
        url = (item.get("image", "") or "").strip()
        if url:
            images.append(url)

    offers = [
        {"name": "Индивидуальная консультация психолога (50 минут)", "price": "4500"},
        {"name": "Семейная консультация психолога", "price": "5000"},
    ]
    for package in c.get("packages", []):
        offers.append({
            "name": package.get("name", ""),
            "price": re.sub(r"[^\d]", "", str(package.get("price", ""))),
        })
    catalog = [{
        "@type": "Offer",
        "name": o["name"],
        "price": o["price"],
        "priceCurrency": "RUB",
        "availability": "https://schema.org/InStock",
    } for o in offers if o.get("name") and o.get("price")]

    address = {"@type": "PostalAddress", "addressCountry": "RU"}
    if contacts.get("city"):
        address["addressLocality"] = contacts["city"]

    socials = [u for u in (
        contacts.get("telegram", ""),
        contacts.get("vk", ""),
        contacts.get("instagram", ""),
    ) if u]

    psychologist = {
        "@type": "Psychologist",
        "@id": (canonical or "/") + "#psychologist",
        "name": site.get("psychologistName", ""),
        "description": seo.get("description", ""),
        "url": canonical or None,
        "image": images or None,
        "telephone": contacts.get("phone", "") or None,
        "email": contacts.get("email", "") or None,
        "priceRange": "4500-20000 RUB",
        "address": address,
        "areaServed": "RU",
        "knowsAbout": [
            "Когнитивно-поведенческая терапия (КПТ)",
            "Системная семейная терапия",
            "Психологическое консультирование",
        ],
        "hasOfferCatalog": {
            "@type": "OfferCatalog",
            "name": "Консультации психолога",
            "itemListElement": catalog,
        } if catalog else None,
        "sameAs": socials or None,
    }
    psychologist = {k: v for k, v in psychologist.items() if v not in (None, "", [], {})}

    website = {
        "@type": "WebSite",
        "name": seo.get("title", ""),
        "url": canonical or None,
        "inLanguage": "ru-RU",
    }
    website = {k: v for k, v in website.items() if v not in (None, "", [], {})}

    graph = {"@context": "https://schema.org", "@graph": [psychologist, website]}
    return json.dumps(graph, ensure_ascii=False).replace("</", "<\\/")


def og_image_tag(c):
    image = (c.get("seo", {}).get("ogImage", "") or c.get("site", {}).get("photoUrl", "") or "").strip()
    return f'<meta property="og:image" content="{esc(image)}">' if image else ""


def render_page():
    template = (PUBLIC_DIR / "index.html").read_text(encoding="utf-8")
    content = get_content()
    html = render_tpl(template, {"root": content, "this": None, "index": None})
    html = html.replace("<!--OGIMAGE-->", og_image_tag(content))
    html = html.replace(
        "<!--JSONLD-->",
        '<script type="application/ld+json">' + build_jsonld(content) + "</script>",
    )
    return html


# --------------------------------------------------------------------------
# Загрузка изображений (multipart/form-data, без сторонних библиотек)
# --------------------------------------------------------------------------

def parse_multipart(body, boundary):
    """Возвращает список (name, filename или None, content_bytes)."""
    delimiter = b"--" + boundary
    results = []
    for part in body.split(delimiter)[1:]:
        if part.startswith(b"--"):
            break
        header_blob, sep, content = part.partition(b"\r\n\r\n")
        if not sep:
            continue
        if content.endswith(b"\r\n"):
            content = content[:-2]
        name = None
        filename = None
        for line in header_blob.split(b"\r\n"):
            if line.lower().startswith(b"content-disposition:"):
                disp = line.decode("latin-1", "ignore")
                m_name = re.search(r'name="([^"]*)"', disp)
                m_file = re.search(r'filename="([^"]*)"', disp)
                name = m_name.group(1) if m_name else None
                filename = m_file.group(1) if m_file else None
        results.append((name, filename, content))
    return results


def detect_image_type(content):
    """Определяет тип картинки по сигнатуре, возвращает расширение или None."""
    if content[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if content[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    if content[:6] in (b"GIF87a", b"GIF89a"):
        return ".gif"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return ".webp"
    return None


# --------------------------------------------------------------------------
# HTTP-обработчик
# --------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "PsySite/1.0"

    def log_message(self, fmt, *args):
        print(f"[{time.strftime('%H:%M:%S')}] {fmt % args}")

    # ---- ответы ----

    def send_body(self, body, content_type="text/plain; charset=utf-8", status=200, cache="no-cache"):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, obj, status=200):
        self.send_body(json.dumps(obj, ensure_ascii=False),
                       "application/json; charset=utf-8", status)

    def redirect(self, location):
        self.send_response(302)
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.end_headers()

    # ---- входящие данные и авторизация ----

    def read_json(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0:
            return {}
        if length > MAX_BODY:
            raise ApiError(413, "Слишком большой запрос")
        raw = self.rfile.read(length).decode("utf-8")
        try:
            data = json.loads(raw)
        except ValueError:
            raise ApiError(400, "Некорректный JSON")
        if not isinstance(data, dict):
            raise ApiError(400, "Некорректный JSON")
        return data

    def bearer_token(self):
        header = self.headers.get("Authorization", "")
        return header[7:].strip() if header.startswith("Bearer ") else None

    def require_auth(self):
        token = self.bearer_token()
        expires = sessions.get(token)
        if not expires or expires < time.time():
            sessions.pop(token, None)
            raise ApiError(401, "Требуется авторизация")
        return token

    def base_url(self):
        content = get_content()
        canonical = (content.get("seo", {}).get("canonical", "") or "").strip().rstrip("/")
        if canonical:
            return canonical
        host = self.headers.get("Host") or f"localhost:{PORT}"
        return f"http://{host}"

    # ---- маршруты ----

    def do_GET(self):
        try:
            path = unquote(urlparse(self.path).path)
            if path == "/":
                return self.send_body(render_page(), "text/html; charset=utf-8")
            if path in ("/admin", "/admin/"):
                return self.serve_file(PUBLIC_DIR / "admin.html")
            if path == "/admin.html":
                return self.redirect("/admin")
            if path == "/api/content":
                return self.send_json(get_content())
            if path == "/robots.txt":
                body = ("User-agent: *\n"
                        "Allow: /\n"
                        "Disallow: /admin\n\n"
                        f"Sitemap: {self.base_url()}/sitemap.xml\n")
                return self.send_body(body, "text/plain; charset=utf-8")
            if path == "/sitemap.xml":
                today = date.today().isoformat()
                body = ('<?xml version="1.0" encoding="UTF-8"?>\n'
                        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                        "  <url>\n"
                        f"    <loc>{esc(self.base_url())}</loc>\n"
                        f"    <lastmod>{today}</lastmod>\n"
                        "    <changefreq>monthly</changefreq>\n"
                        "    <priority>1.0</priority>\n"
                        "  </url>\n"
                        "</urlset>\n")
                return self.send_body(body, "application/xml; charset=utf-8")
            return self.serve_static(path)
        except ApiError as e:
            self.send_json({"error": e.message}, e.status)
        except BrokenPipeError:
            pass
        except Exception as e:
            print(f"[!] Ошибка: {e}")
            self.send_json({"error": "Внутренняя ошибка сервера"}, 500)

    def do_POST(self):
        try:
            path = urlparse(self.path).path
            if path == "/api/login":
                return self.handle_login()
            if path == "/api/upload":
                return self.handle_upload()
            if path == "/api/password":
                return self.handle_password()
            if path == "/api/logout":
                sessions.pop(self.bearer_token(), None)
                return self.send_json({"ok": True})
            raise ApiError(404, "Не найдено")
        except ApiError as e:
            self.send_json({"error": e.message}, e.status)
        except BrokenPipeError:
            pass
        except Exception as e:
            print(f"[!] Ошибка: {e}")
            self.send_json({"error": "Внутренняя ошибка сервера"}, 500)

    def do_PUT(self):
        try:
            path = urlparse(self.path).path
            if path == "/api/content":
                self.require_auth()
                cleaned = sanitize(self.read_json(), get_content())
                save_content(cleaned)
                print("[i] Контент сайта обновлён через админ-панель")
                return self.send_json({"ok": True})
            raise ApiError(404, "Не найдено")
        except ApiError as e:
            self.send_json({"error": e.message}, e.status)
        except BrokenPipeError:
            pass
        except Exception as e:
            print(f"[!] Ошибка: {e}")
            self.send_json({"error": "Внутренняя ошибка сервера"}, 500)

    # ---- файлы ----

    def serve_static(self, path):
        candidate = (PUBLIC_DIR / path.lstrip("/")).resolve()
        public_root = PUBLIC_DIR.resolve()
        if (str(candidate) != str(public_root)
                and not str(candidate).startswith(str(public_root) + os.sep)):
            raise ApiError(403, "Доступ запрещён")
        if not candidate.is_file():
            raise ApiError(404, "Не найдено")
        return self.serve_file(candidate)

    def serve_file(self, candidate):
        suffix = candidate.suffix.lower()
        mime = MIME.get(suffix, "application/octet-stream")
        cache = "no-cache" if suffix in (".html", ".css", ".js") else "public, max-age=86400"
        self.send_body(candidate.read_bytes(), mime, 200, cache)

    # ---- API ----

    def handle_login(self):
        ip = self.client_address[0]
        attempts = login_attempts.get(ip)
        if attempts and attempts[1] > time.time() and attempts[0] >= 10:
            raise ApiError(429, "Слишком много попыток — подождите 10 минут")

        data = self.read_json()
        password = str(data.get("password", ""))
        if hashlib.sha256(password.encode("utf-8")).hexdigest() != get_admin().get("passwordHash"):
            if not attempts or attempts[1] < time.time():
                login_attempts[ip] = [1, time.time() + 600]
            else:
                attempts[0] += 1
            raise ApiError(401, "Неверный пароль")

        login_attempts.pop(ip, None)
        token = secrets.token_hex(24)
        sessions[token] = time.time() + SESSION_TTL
        self.send_json({"token": token, "expiresIn": SESSION_TTL})

    def handle_upload(self):
        self.require_auth()

        content_type = self.headers.get("Content-Type", "")
        match = re.search(r"boundary=([^;]+)", content_type)
        if "multipart/form-data" not in content_type or not match:
            raise ApiError(400, "Ожидается multipart/form-data")
        boundary = match.group(1).strip().strip('"').encode("latin-1")

        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0:
            raise ApiError(400, "Файл не найден")
        if length > MAX_UPLOAD:
            raise ApiError(413, "Файл больше 5 МБ")

        parts = parse_multipart(self.rfile.read(length), boundary)
        files = [p for p in parts if p[1]]
        if not files:
            raise ApiError(400, "Файл не найден")

        _name, _filename, content = files[0]
        ext = detect_image_type(content)
        if not ext:
            raise ApiError(400, "Неподдерживаемый формат — загрузите JPG, PNG, WebP или GIF")

        UPLOAD_DIR.mkdir(exist_ok=True)
        fname = f"{int(time.time())}-{secrets.token_hex(4)}{ext}"
        (UPLOAD_DIR / fname).write_bytes(content)
        print(f"[i] Загружен файл: uploads/{fname} ({len(content)} байт)")
        self.send_json({"url": f"/uploads/{fname}"})

    def handle_password(self):
        self.require_auth()
        data = self.read_json()
        current = str(data.get("current", ""))
        new = str(data.get("next", ""))
        if len(new) < 6:
            raise ApiError(400, "Новый пароль должен быть не короче 6 символов")
        if hashlib.sha256(current.encode("utf-8")).hexdigest() != get_admin().get("passwordHash"):
            raise ApiError(401, "Текущий пароль указан неверно")
        admin = get_admin()
        admin["passwordHash"] = hashlib.sha256(new.encode("utf-8")).hexdigest()
        admin["updatedAt"] = time.strftime("%Y-%m-%d %H:%M:%S")
        save_admin(admin)
        sessions.clear()
        print("[i] Пароль администратора изменён")
        self.send_json({"ok": True})


def main():
    ensure_admin_file()
    UPLOAD_DIR.mkdir(exist_ok=True)
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Сайт запущен:  http://localhost:{PORT}")
    print(f"Админ-панель:  http://localhost:{PORT}/admin")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nОстановлено.")
        server.server_close()


if __name__ == "__main__":
    main()
