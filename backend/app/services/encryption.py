from cryptography.fernet import Fernet
import base64
import hashlib
from backend.app.config import get_settings

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        settings = get_settings()
        key = settings.encryption_key
        # If no explicit key is set, derive a stable Fernet key from the secret_key
        # via SHA-256 so nothing needs to be manually configured.
        if not key:
            raw = hashlib.sha256(settings.secret_key.encode()).digest()
            key = base64.urlsafe_b64encode(raw).decode()
        _fernet = Fernet(key.encode())
    return _fernet


def encrypt(value: str) -> str:
    return _get_fernet().encrypt(value.encode()).decode()


def decrypt(ciphertext: str) -> str:
    return _get_fernet().decrypt(ciphertext.encode()).decode()
