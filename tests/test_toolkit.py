from datetime import datetime

from agent import toolkit


def test_save_note_uses_temporary_file(monkeypatch, tmp_path):
    notes_file = tmp_path / "notes.txt"
    monkeypatch.setattr(toolkit, "NOTES_FILE", notes_file)

    assert toolkit.save_note("Buy milk") == "Note saved."
    assert "Buy milk" in notes_file.read_text(encoding="utf-8")


def test_read_notes_uses_temporary_file(monkeypatch, tmp_path):
    notes_file = tmp_path / "notes.txt"
    notes_file.write_text("Test note\n", encoding="utf-8")
    monkeypatch.setattr(toolkit, "NOTES_FILE", notes_file)

    assert toolkit.read_notes() == "Test note\n"


def test_notes_can_be_kept_in_a_session():
    notes = []

    assert toolkit.save_note("Buy milk", notes=notes) == "Note saved."
    assert "Buy milk" in toolkit.read_notes(notes=notes)
    assert toolkit.read_notes(notes=[]) == "No notes yet."


def test_get_current_time_format():
    datetime.strptime(toolkit.get_current_time(), "%Y-%m-%d %H:%M:%S")


def test_get_weather_data_and_text_share_the_same_conditions(monkeypatch):
    class FakeResponse:
        def __init__(self, data):
            self.data = data

        def json(self):
            return self.data

    def fake_get(url, *args, **kwargs):
        if "geocoding" in url:
            return FakeResponse({
                "results": [{
                    "name": "Chennai",
                    "country": "India",
                    "latitude": 13.08,
                    "longitude": 80.27,
                }]
            })
        return FakeResponse({
            "current": {
                "temperature_2m": 31.5,
                "relative_humidity_2m": 68,
                "wind_speed_10m": 12.3,
            }
        })

    monkeypatch.setattr(toolkit.requests, "get", fake_get)

    data = toolkit.get_weather_data("Chennai")

    assert data == {
        "city": "Chennai",
        "country": "India",
        "temperature": 31.5,
        "humidity": 68,
        "wind": 12.3,
        "latitude": 13.08,
        "longitude": 80.27,
    }
    assert toolkit.get_weather("Chennai") == (
        "Chennai, India: 31.5 °C, humidity 68%, wind 12.3 km/h"
    )
