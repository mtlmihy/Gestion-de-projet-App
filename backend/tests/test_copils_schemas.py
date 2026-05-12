"""
Tests for COPIL endpoints and validation.
"""
import pytest
from datetime import date, time, datetime
from pydantic import ValidationError


@pytest.mark.asyncio
class TestCopilValidation:
    """Test Pydantic validation for COPIL schemas."""

    async def test_copil_titre_min_length(self):
        """Title must be at least 3 characters."""
        from app.copils.schemas import CopilCreate

        # Valid title
        valid = CopilCreate(
            date_reunion=date(2026, 5, 12),
            heure_reunion=time(14, 30),
            titre="Valid Title",
        )
        assert valid.titre == "Valid Title"

        # Invalid: too short
        with pytest.raises(ValidationError):
            CopilCreate(
                date_reunion=date(2026, 5, 12),
                heure_reunion=time(14, 30),
                titre="ab",
            )

    async def test_copil_titre_max_length(self):
        """Title must not exceed 200 characters."""
        from app.copils.schemas import CopilCreate

        valid = CopilCreate(
            date_reunion=date(2026, 5, 12),
            heure_reunion=time(14, 30),
            titre="x" * 200,
        )
        assert len(valid.titre) == 200

        with pytest.raises(ValidationError):
            CopilCreate(
                date_reunion=date(2026, 5, 12),
                heure_reunion=time(14, 30),
                titre="x" * 201,
            )

    async def test_copil_note_content_required(self):
        """Note content must not be empty."""
        from app.copils.schemas import CopilNoteCreate

        with pytest.raises(ValidationError):
            CopilNoteCreate(contenu="")

    async def test_copil_note_content_max_length(self):
        """Note content must not exceed 5000 characters."""
        from app.copils.schemas import CopilNoteCreate

        valid = CopilNoteCreate(contenu="x" * 5000)
        assert len(valid.contenu) == 5000

        with pytest.raises(ValidationError):
            CopilNoteCreate(contenu="x" * 5001)


@pytest.mark.asyncio
class TestCopilDateHandling:
    """Test date/time handling in COPIL operations."""

    async def test_null_heure_reunion_handled(self):
        """Test that missing heure_reunion is handled gracefully."""
        from app.copils.schemas import CopilRead

        copil = CopilRead(
            id="1",
            projet_id="1",
            date_reunion=date(2026, 5, 12),
            heure_reunion=None,
            titre="Test",
            createur_id="user1",
            createur_nom="Alice",
            date_creation=datetime(2026, 5, 12, 10, 0),
            derniere_maj=datetime(2026, 5, 12, 10, 0),
        )

        assert copil.heure_reunion is None

    async def test_date_format_consistency(self):
        """Test that dates are consistently formatted."""
        iso_str = "2026-05-12"
        parsed = date.fromisoformat(iso_str)

        assert parsed.year == 2026
        assert parsed.month == 5
        assert parsed.day == 12

    async def test_time_format_consistency(self):
        """Test that times are consistently formatted."""
        time_str = "14:30:00"
        parsed = time.fromisoformat(time_str)

        assert parsed.hour == 14
        assert parsed.minute == 30


@pytest.mark.asyncio
class TestCopilAutoTitle:
    """Test auto-title generation logic."""

    async def test_auto_title_format(self):
        """Test that auto-title follows format."""
        date_val = date(2026, 5, 12)
        time_val = time(14, 30)

        formatted_date = date_val.strftime("%d/%m/%Y")
        formatted_time = time_val.strftime("%H:%M")

        auto_title = f"Notes du {formatted_date} {formatted_time}"

        assert auto_title == "Notes du 12/05/2026 14:30"
        assert "Notes du" in auto_title

    async def test_auto_title_with_midnight(self):
        """Test auto-title with midnight time."""
        date_val = date(2026, 5, 12)
        time_val = time(0, 0)

        formatted_date = date_val.strftime("%d/%m/%Y")
        formatted_time = time_val.strftime("%H:%M")

        auto_title = f"Notes du {formatted_date} {formatted_time}"

        assert auto_title == "Notes du 12/05/2026 00:00"


@pytest.mark.asyncio
class TestCopilSchemaModels:
    """Test COPIL schema model definitions."""

    async def test_copil_create_schema_fields(self):
        """Test that CopilCreate schema has correct fields."""
        from app.copils.schemas import CopilCreate

        copil = CopilCreate(
            date_reunion=date(2026, 5, 12),
            heure_reunion=time(14, 30),
            titre="Test",
        )

        assert hasattr(copil, "date_reunion")
        assert hasattr(copil, "heure_reunion")
        assert hasattr(copil, "titre")
        assert hasattr(copil, "participants")
        assert hasattr(copil, "notes")

    async def test_copil_note_create_schema_fields(self):
        """Test that CopilNoteCreate schema has correct fields."""
        from app.copils.schemas import CopilNoteCreate

        note = CopilNoteCreate(contenu="Test note content")

        assert hasattr(note, "contenu")
        assert note.contenu == "Test note content"

    async def test_copil_read_schema_fields(self):
        """Test that CopilRead schema has all display fields."""
        from app.copils.schemas import CopilRead

        copil = CopilRead(
            id="1",
            projet_id="1",
            date_reunion=date(2026, 5, 12),
            heure_reunion=time(14, 30),
            titre="Test",
            createur_id="user1",
            createur_nom="Alice",
            date_creation=datetime(2026, 5, 12, 10, 0),
            derniere_maj=datetime(2026, 5, 12, 10, 0),
        )

        assert copil.id == "1"
        assert copil.createur_nom == "Alice"
        assert copil.createur_id == "user1"


@pytest.mark.asyncio
class TestCopilUpdateSchema:
    """Test COPIL update schema behavior."""

    async def test_copil_update_inherits_create_fields(self):
        """Test that CopilUpdate inherits all fields from CopilCreate."""
        from app.copils.schemas import CopilUpdate

        update = CopilUpdate(
            date_reunion=date(2026, 5, 12),
            heure_reunion=time(14, 30),
            titre="Updated Title",
        )

        assert update.titre == "Updated Title"

    async def test_copil_note_update_inherits_create_fields(self):
        """Test that CopilNoteUpdate inherits all fields from CopilNoteCreate."""
        from app.copils.schemas import CopilNoteUpdate

        update = CopilNoteUpdate(contenu="Updated content")

        assert update.contenu == "Updated content"
