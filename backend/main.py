"""Application FastAPI — site pédagogique Aide & Services."""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Optional

from fastapi import Depends, FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from starlette.middleware.sessions import SessionMiddleware

from database import get_db, init_db
from models import User

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
FRONTEND_DIR = Path(os.getenv("FRONTEND_DIR", str(ROOT_DIR / "frontend")))
TEMPLATES_DIR = FRONTEND_DIR / "templates"
STATIC_DIR = FRONTEND_DIR / "static"

# Identifiants enseignant (démonstration locale uniquement)
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "enseignant")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "PedagoDemo2026!")
SESSION_SECRET = os.getenv("SESSION_SECRET", secrets.token_hex(32))

app = FastAPI(
    title="Aide & Services — Démonstration pédagogique",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    session_cookie="aide_services_session",
    same_site="lax",
    https_only=False,
)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


def _now_label() -> str:
    return datetime.now(timezone.utc).astimezone().strftime("%d/%m/%Y %H:%M:%S")


def template_context(request: Request, **extra):
    user_email = request.session.get("user_email")
    return {
        "request": request,
        "site_name": "Aide & Services",
        "is_demo": True,
        "logged_in": bool(user_email),
        "user_email": user_email,
        "admin_logged_in": bool(request.session.get("admin")),
        **extra,
    }


@app.on_event("startup")
def on_startup() -> None:
    init_db()


# ---------------------------------------------------------------------------
# Pages publiques
# ---------------------------------------------------------------------------


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse("index.html", template_context(request))


@app.get("/services", response_class=HTMLResponse)
def services(request: Request):
    return templates.TemplateResponse("services.html", template_context(request))


@app.get("/a-propos", response_class=HTMLResponse)
def about(request: Request):
    return templates.TemplateResponse("about.html", template_context(request))


@app.get("/contact", response_class=HTMLResponse)
def contact(request: Request):
    return templates.TemplateResponse("contact.html", template_context(request))


@app.get("/securite", response_class=HTMLResponse)
def securite(request: Request):
    return templates.TemplateResponse("securite.html", template_context(request))


@app.get("/jeu", response_class=HTMLResponse)
def jeu_secours(request: Request):
    """Simulation pédagogique TIM / PSC1 — scène de secours interactive."""
    return templates.TemplateResponse("jeu.html", template_context(request))


# ---------------------------------------------------------------------------
# Inscription
# ---------------------------------------------------------------------------


@app.get("/register", response_class=HTMLResponse)
def register_page(request: Request):
    return templates.TemplateResponse(
        "register.html",
        template_context(request, error=None, form_data={}),
    )


@app.post("/register", response_class=HTMLResponse)
def register_submit(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    first_name: str = Form(...),
    last_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    address: str = Form(...),
    postal_code: str = Form(...),
    city: str = Form(...),
    password: str = Form(...),
    password_confirm: str = Form(...),
    demo_ack: Optional[str] = Form(None),
):
    form_data = {
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "phone": phone,
        "address": address,
        "postal_code": postal_code,
        "city": city,
    }

    def fail(message: str):
        return templates.TemplateResponse(
            "register.html",
            template_context(request, error=message, form_data=form_data),
            status_code=400,
        )

    if not demo_ack:
        return fail("Vous devez cocher la case confirmant que vous êtes sur un site de démonstration.")

    if password != password_confirm:
        return fail("Les mots de passe ne correspondent pas.")

    if len(password) < 4:
        return fail("Le mot de passe de démonstration doit contenir au moins 4 caractères.")

    email_norm = email.strip().lower()
    if db.query(User).filter(User.email == email_norm).first():
        return fail("Un compte avec cet e-mail existe déjà dans la base de démonstration.")

    # IMPORTANT : le mot de passe n'est JAMAIS stocké (ni en clair, ni hashé).
    # Il n'est utilisé que pour simuler la validation du formulaire, puis oublié.
    _ = password
    del password, password_confirm

    user = User(
        first_name=first_name.strip(),
        last_name=last_name.strip(),
        email=email_norm,
        phone=phone.strip(),
        address=address.strip(),
        postal_code=postal_code.strip(),
        city=city.strip(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    request.session["last_registration_id"] = user.id
    return RedirectResponse(url=f"/alerte/{user.id}", status_code=303)


@app.get("/alerte/{user_id}", response_class=HTMLResponse)
def alert_page(request: Request, user_id: int, db: Annotated[Session, Depends(get_db)]):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Compte introuvable")
    return templates.TemplateResponse(
        "alert.html",
        template_context(request, user=user),
    )


# ---------------------------------------------------------------------------
# Connexion élève (simulation)
# ---------------------------------------------------------------------------


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse(
        "login.html",
        template_context(request, error=None),
    )


@app.post("/login", response_class=HTMLResponse)
def login_submit(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    email: str = Form(...),
    password: str = Form(...),
):
    email_norm = email.strip().lower()
    user = db.query(User).filter(User.email == email_norm).first()

    # Simulation : on vérifie seulement l'existence du compte.
    # Aucun mot de passe n'est stocké ; le champ sert uniquement à reproduire
    # l'apparence d'une connexion classique.
    if not user or not password:
        return templates.TemplateResponse(
            "login.html",
            template_context(
                request,
                error="Identifiants incorrects ou compte inexistant dans la base de démonstration.",
            ),
            status_code=401,
        )

    _ = password
    del password

    request.session["user_email"] = user.email
    request.session["user_name"] = f"{user.first_name} {user.last_name}"
    return RedirectResponse(url="/connecte", status_code=303)


@app.get("/connecte", response_class=HTMLResponse)
def connected_page(request: Request):
    if not request.session.get("user_email"):
        return RedirectResponse(url="/login", status_code=303)
    return templates.TemplateResponse(
        "connected.html",
        template_context(
            request,
            user_name=request.session.get("user_name"),
        ),
    )


@app.post("/logout")
def logout(request: Request):
    request.session.pop("user_email", None)
    request.session.pop("user_name", None)
    return RedirectResponse(url="/", status_code=303)


# ---------------------------------------------------------------------------
# Administration enseignant
# ---------------------------------------------------------------------------


@app.get("/admin/login", response_class=HTMLResponse)
def admin_login_page(request: Request):
    if request.session.get("admin"):
        return RedirectResponse(url="/admin", status_code=303)
    return templates.TemplateResponse(
        "admin_login.html",
        template_context(request, error=None),
    )


@app.post("/admin/login", response_class=HTMLResponse)
def admin_login_submit(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
):
    if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
        request.session["admin"] = True
        return RedirectResponse(url="/admin", status_code=303)
    return templates.TemplateResponse(
        "admin_login.html",
        template_context(request, error="Identifiants enseignant incorrects."),
        status_code=401,
    )


@app.get("/admin", response_class=HTMLResponse)
def admin_page(request: Request, db: Annotated[Session, Depends(get_db)]):
    if not request.session.get("admin"):
        return RedirectResponse(url="/admin/login", status_code=303)

    users = db.query(User).order_by(User.created_at.desc()).all()
    return templates.TemplateResponse(
        "admin.html",
        template_context(
            request,
            users=users,
            count=len(users),
            now_label=_now_label(),
            message=request.query_params.get("msg"),
        ),
    )


@app.post("/admin/delete/{user_id}")
def admin_delete_user(
    request: Request,
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    if not request.session.get("admin"):
        return RedirectResponse(url="/admin/login", status_code=303)
    user = db.get(User, user_id)
    if user:
        db.delete(user)
        db.commit()
    return RedirectResponse(url="/admin?msg=Compte+supprimé", status_code=303)


@app.post("/admin/reset")
def admin_reset_all(request: Request, db: Annotated[Session, Depends(get_db)]):
    if not request.session.get("admin"):
        return RedirectResponse(url="/admin/login", status_code=303)
    db.query(User).delete()
    db.commit()
    return RedirectResponse(
        url="/admin?msg=Toutes+les+données+de+démonstration+ont+été+supprimées",
        status_code=303,
    )


@app.post("/admin/seed")
def admin_seed(request: Request, db: Annotated[Session, Depends(get_db)]):
    if not request.session.get("admin"):
        return RedirectResponse(url="/admin/login", status_code=303)

    demo_users = [
        {
            "first_name": "Jean",
            "last_name": "Exemple",
            "email": "jean.exemple@example.test",
            "phone": "06 00 00 00 01",
            "address": "1 rue de la Démonstration",
            "postal_code": "75001",
            "city": "Paris",
        },
        {
            "first_name": "Sophie",
            "last_name": "Démonstration",
            "email": "sophie.demo@example.test",
            "phone": "06 00 00 00 02",
            "address": "12 avenue Pédagogique",
            "postal_code": "69001",
            "city": "Lyon",
        },
        {
            "first_name": "Alice",
            "last_name": "Test",
            "email": "alice.test@example.test",
            "phone": "06 00 00 00 03",
            "address": "5 place Fictive",
            "postal_code": "33000",
            "city": "Bordeaux",
        },
    ]

    created = 0
    for data in demo_users:
        exists = db.query(User).filter(User.email == data["email"]).first()
        if not exists:
            db.add(User(**data))
            created += 1
    db.commit()

    msg = f"{created}+utilisateur(s)+fictif(s)+ajouté(s)"
    return RedirectResponse(url=f"/admin?msg={msg}", status_code=303)


@app.post("/admin/logout")
def admin_logout(request: Request):
    request.session.pop("admin", None)
    return RedirectResponse(url="/", status_code=303)


@app.get("/health")
def health():
    return {"status": "ok", "mode": "pedagogical-demo"}
