"""
Pytest configuration and shared fixtures for backend tests.
"""
import pytest
from pathlib import Path


# Configure pytest
pytest_plugins = []


@pytest.fixture(scope="session")
def project_root():
    """Return the project root directory."""
    return Path(__file__).parent.parent


@pytest.fixture
def mock_projet():
    """Mock project data for testing."""
    return {
        "id": "proj-123",
        "nom": "Test Project",
        "description": "Test Description",
    }


@pytest.fixture
def mock_user():
    """Mock user data for testing."""
    return {
        "id": "user-123",
        "email": "test@example.com",
        "nom": "Test User",
    }
