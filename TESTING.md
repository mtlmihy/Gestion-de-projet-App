# Testing Guide

## Frontend Tests (React/Jest)

### Setup

Tests are configured with Jest and React Testing Library. Configuration files:
- `jest.config.js` - Jest configuration
- `jest.setup.js` - Test environment setup
- `babel.config.js` - Babel configuration for JSX

### Running Tests

```bash
cd frontend

# Run tests in watch mode
npm test

# Run tests once (CI mode)
npm test -- --no-coverage --watchAll=false

# Run tests with coverage report
npm test:coverage

# Run specific test file
npm test -- Layout.test.jsx

# Run tests matching pattern
npm test -- --testNamePattern="Hard Lock"
```

### Test Files

Tests are located in `src/__tests__/`:

- **Layout.test.jsx** - Navigation gestures, hard lock, swipe detection
  - Wheel event detection (horizontal vs vertical)
  - Hard lock cooldown (700ms)
  - Gesture locking (260ms idle)
  - Touch swipe detection
  - Interactive element detection
  - Admin page navigation

- **CopilPage.test.jsx** - COPIL CRUD operations
  - Auto-title generation ("Notes du DD/MM/YYYY HH:MM")
  - Note creation/editing/deletion
  - State management (editingNoteId, editingNoteContent)
  - Notification system
  - API error handling
  - Date/time formatting

- **CdcPage.test.jsx** - Project charter date handling
  - ISO format parsing (YYYY-MM-DD)
  - French format parsing (DD/MM/YYYY)
  - Mixed format sorting
  - Chronological jalon ordering
  - Unscheduled jalon handling
  - Edge cases (leap years, year boundaries)

### Coverage Goals

Target coverage:
- **Statements**: > 80%
- **Branches**: > 70%
- **Functions**: > 80%
- **Lines**: > 80%

View coverage: `coverage/` directory after running `npm test:coverage`

---

## Backend Tests (Python/pytest)

### Setup

Tests use pytest + httpx for async testing. Configuration:
- `pytest.ini` - Pytest configuration
- `tests/conftest.py` - Shared fixtures
- `requirements-dev.txt` - Development dependencies

### Installation

```bash
cd backend

# Install dev dependencies
pip install -r requirements-dev.txt
```

### Running Tests

```bash
cd backend

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_copils.py

# Run specific test class
pytest tests/test_copils.py::TestCopilEndpoints

# Run specific test
pytest tests/test_copils.py::TestCopilEndpoints::test_create_copil_with_auto_title

# Run with coverage
pytest --cov=app --cov-report=html

# Run only unit tests
pytest -m unit

# Run with output capture disabled (see print statements)
pytest -s
```

### Test Files

Tests are located in `tests/`:

- **test_copils.py** - COPIL endpoints and validation
  - Create COPIL with/without auto-title
  - COPIL validation (Pydantic schemas)
  - Update/delete COPIL operations
  - COPIL notes CRUD
  - Creator name resolution (LEFT JOIN)
  - Date/time handling
  - Null heure_reunion handling

### Test Structure

```
TestCopilEndpoints
  ├── test_create_copil_with_auto_title
  ├── test_create_copil_with_title
  ├── test_create_copil_requires_date
  ├── test_get_copil_notes_with_creator_names
  └── test_delete_copil_note

TestCopilValidation
  ├── test_copil_titre_min_length
  ├── test_copil_titre_max_length
  ├── test_copil_note_content_required
  └── test_copil_note_content_max_length

TestCopilDateHandling
  ├── test_null_heure_reunion_handled
  ├── test_date_format_consistency
  └── test_time_format_consistency

TestCopilNameResolution
  ├── test_creator_name_resolution
  ├── test_author_name_resolution
  └── test_fallback_to_email_if_no_name
```

### Coverage Goals

Target coverage:
- **copils/service.py**: > 85%
- **copils/router.py**: > 80%
- **copils/schemas.py**: > 90%

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd frontend && npm install && npm test:coverage
      
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: cd backend && pip install -r requirements-dev.txt && pytest --cov
```

---

## Common Issues

### Frontend

**Issue**: Tests timeout or hang
- Check for infinite loops in gesture handlers
- Verify jest.useFakeTimers() / jest.useRealTimers() pairing

**Issue**: Mock context not working
- Verify mock paths match actual imports
- Check jest.mock() is at top of file

### Backend

**Issue**: Database migration conflicts in tests
- Use in-memory SQLite for tests (sqlite+aiosqlite:///:memory:)
- Each test gets fresh database

**Issue**: Async test hangs
- Ensure @pytest.mark.asyncio is used
- Use async/await syntax correctly

---

## Next Steps

1. **Increase Coverage**: Add integration tests for multi-step workflows
2. **E2E Tests**: Consider Playwright/Cypress for full user flows
3. **Performance Tests**: Add load testing for API endpoints
4. **Accessibility Tests**: Add a11y checks with jest-axe
5. **Visual Regression**: Consider Percy or similar for UI snapshots
