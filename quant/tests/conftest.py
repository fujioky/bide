"""Test bootstrap: point the service at a throw-away DATA_DIR *before* the package
is imported (config/db read env at import time), and put quant/ on sys.path.

Run from the quant/ directory:
  uv run --python 3.12 --with-requirements requirements.txt --with pytest --with httpx \
      python -m pytest tests -q
"""
import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

_TMP = tempfile.mkdtemp(prefix="quant_test_")
os.environ["DATA_DIR"] = _TMP
os.environ["QUANT_API_KEY"] = "t"
os.environ["AUTO_JOBS"] = "0"
# mail: "configured" so mail_ready() is True; SMTP itself is faked in the tests
os.environ["SMTP_HOST"] = "smtp.example.test"
os.environ["SMTP_PORT"] = "465"
os.environ["SMTP_USER"] = "lyra@example.test"
os.environ["SMTP_PASS"] = "secret"
os.environ.pop("MAIL_FROM", None)
os.environ["MAIL_TO"] = "ops@example.test, second@example.test"

import pytest  # noqa: E402


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient
    from quant.api import app
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def key():
    return {"X-API-Key": "t"}
