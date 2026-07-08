import pytest

from cutprep.app import create_app
from cutprep.config import Config


@pytest.fixture()
def app(tmp_path):
    class TestConfig(Config):
        TESTING = True
        UPLOAD_DIR = tmp_path / "uploads"

    return create_app(TestConfig)


@pytest.fixture()
def client(app):
    return app.test_client()
