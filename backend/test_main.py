import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_main.db")

import main  # noqa: E402
from main import Base, get_db  # noqa: E402

TEST_DATABASE_URL = "sqlite:///./test_main.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


main.app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def fresh_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    with TestClient(main.app) as c:
        yield c


def _create_note(client, title="Title", content="Content"):
    response = client.post("/notes", json={"title": title, "content": content})
    assert response.status_code == 201
    return response.json()


def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_create_note(client):
    data = _create_note(client, "Hello", "World")
    assert data["title"] == "Hello"
    assert data["content"] == "World"
    assert data["is_deleted"] is False
    assert data["user_id"] == "default_user"
    assert "id" in data and data["id"]
    assert "created_at" in data and "updated_at" in data


def test_list_notes_pagination(client):
    for i in range(5):
        _create_note(client, f"Note {i}", "x")
    response = client.get("/notes?skip=0&limit=2")
    assert response.status_code == 200
    assert len(response.json()) == 2

    response = client.get("/notes?skip=4&limit=2")
    assert len(response.json()) == 1


def test_get_single_note(client):
    note = _create_note(client)
    response = client.get(f"/notes/{note['id']}")
    assert response.status_code == 200
    assert response.json()["id"] == note["id"]


def test_get_note_not_found(client):
    response = client.get("/notes/does-not-exist")
    assert response.status_code == 404


def test_update_note(client):
    note = _create_note(client, "Old", "Old body")
    response = client.put(
        f"/notes/{note['id']}", json={"title": "New", "content": "New body"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "New"
    assert body["content"] == "New body"


def test_update_note_not_found(client):
    response = client.put("/notes/missing", json={"title": "x"})
    assert response.status_code == 404


def test_soft_delete(client):
    note = _create_note(client)
    response = client.delete(f"/notes/{note['id']}")
    assert response.status_code == 200
    assert response.json()["status"] == "deleted"

    response = client.get(f"/notes/{note['id']}")
    assert response.status_code == 404

    response = client.get("/notes")
    assert all(n["id"] != note["id"] for n in response.json())


def test_delete_note_not_found(client):
    response = client.delete("/notes/missing")
    assert response.status_code == 404


def test_sync_creates_and_updates(client):
    existing = _create_note(client, "Server", "v1")

    payload = {
        "notes": [
            {"title": "Brand new", "content": "fresh"},
            {
                "id": existing["id"],
                "title": "Server",
                "content": "v2",
                "updated_at": "2999-01-01T00:00:00+00:00",
            },
        ]
    }
    response = client.post("/sync", json=payload)
    assert response.status_code == 200
    result = response.json()
    assert result["created"] == 1
    assert result["updated"] == 1

    response = client.get(f"/notes/{existing['id']}")
    assert response.json()["content"] == "v2"


def test_sync_skips_stale(client):
    existing = _create_note(client, "Server", "current")
    payload = {
        "notes": [
            {
                "id": existing["id"],
                "title": "Server",
                "content": "stale",
                "updated_at": "2000-01-01T00:00:00+00:00",
            }
        ]
    }
    response = client.post("/sync", json=payload)
    assert response.status_code == 200
    assert response.json()["skipped"] == 1

    response = client.get(f"/notes/{existing['id']}")
    assert response.json()["content"] == "current"