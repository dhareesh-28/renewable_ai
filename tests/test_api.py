"""Integration tests for FastAPI endpoints (api/main.py) using TestClient."""

import pytest
from fastapi.testclient import TestClient

from api.main import app


@pytest.fixture(scope="module")
def client() -> TestClient:
    """Create a TestClient instance managing the lifespan of the app."""
    with TestClient(app) as test_client:
        yield test_client


def test_api_health_endpoint(client: TestClient) -> None:
    """Verify GET /api/health returns operational status and dataset metadata."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "renewable_ai_api"
    assert data["total_rows"] == 8760
    assert data["forecast_model_loaded"] is True
    assert data["iso_model_loaded"] is True
    assert "min_timestamp" in data
    assert "max_timestamp" in data


def test_api_meta_endpoint(client: TestClient) -> None:
    """Verify GET /api/meta returns default ratings, tariffs, and strategy list."""
    response = client.get("/api/meta")
    assert response.status_code == 200
    data = response.json()
    assert data["currency"] == "₹"
    assert "grid_only" in data["strategies"]
    assert "rule_based" in data["strategies"]
    assert "optimised_lp" in data["strategies"]
    assert data["battery_defaults"]["capacity_kwh"] == 10.0
    assert data["solar_defaults"]["capacity_kwp"] == 10.0


def test_api_simulate_valid(client: TestClient) -> None:
    """Verify GET /api/simulate succeeds with valid 48-hour range and default strategy."""
    start = "2026-05-26 00:00:00"
    end = "2026-05-27 23:00:00"
    response = client.get(
        f"/api/simulate?start={start}&end={end}&strategy=optimised_lp&battery_kwh=10.0&battery_kw=5.0"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["hours"] == 48
    assert data["strategy"] == "optimised_lp"
    assert len(data["hourly_series"]) == 48

    # Verify telemetry attributes
    first_pt = data["hourly_series"][0]
    assert "solar_predicted_kw" in first_pt
    assert "solar_actual_kw" in first_pt
    assert "battery_charge_kw" in first_pt
    assert "battery_discharge_kw" in first_pt
    assert "soc_pct" in first_pt
    assert "grid_import_kw" in first_pt
    assert "grid_export_kw" in first_pt

    # Verify summary and baseline
    assert "summary" in data
    assert "baseline" in data
    assert data["summary"]["savings_amount"] >= 0.0


def test_api_simulate_invalid_strategy(client: TestClient) -> None:
    """Verify GET /api/simulate returns 422 for unsupported dispatch strategy."""
    response = client.get("/api/simulate?strategy=magic_battery")
    assert response.status_code == 422
    assert "Invalid strategy" in response.json()["detail"]


def test_api_simulate_invalid_battery_bounds(client: TestClient) -> None:
    """Verify GET /api/simulate enforces battery capacity and power constraints."""
    # Capacity < 1.0 kWh
    resp1 = client.get("/api/simulate?battery_kwh=0.5")
    assert resp1.status_code == 422

    # Capacity > 50.0 kWh
    resp2 = client.get("/api/simulate?battery_kwh=60.0")
    assert resp2.status_code == 422

    # Power > 20.0 kW
    resp3 = client.get("/api/simulate?battery_kw=25.0")
    assert resp3.status_code == 422


def test_api_simulate_invalid_date_range(client: TestClient) -> None:
    """Verify GET /api/simulate rejects backwards date range or dates outside dataset."""
    # Start after End
    resp1 = client.get("/api/simulate?start=2026-05-28 00:00:00&end=2026-05-26 00:00:00")
    assert resp1.status_code == 422
    assert "must be before or equal" in resp1.json()["detail"]

    # Outside bounds
    resp2 = client.get("/api/simulate?start=2020-01-01 00:00:00")
    assert resp2.status_code == 422
    assert "outside dataset range" in resp2.json()["detail"]

    # Exceeding 31 days
    resp3 = client.get("/api/simulate?start=2026-01-01 00:00:00&end=2026-02-15 00:00:00")
    assert resp3.status_code == 422
    assert "maximum allowed limit of 31 days" in resp3.json()["detail"]


def test_api_compare_endpoint(client: TestClient) -> None:
    """Verify GET /api/compare evaluates all three strategies with cumulative cost series."""
    start = "2026-05-26 00:00:00"
    end = "2026-05-26 23:00:00"
    response = client.get(f"/api/compare?start={start}&end={end}&battery_kwh=10.0&battery_kw=5.0")
    assert response.status_code == 200
    data = response.json()
    assert data["hours"] == 24
    assert "grid_only" in data["strategies"]
    assert "rule_based" in data["strategies"]
    assert "optimised_lp" in data["strategies"]
    assert len(data["cumulative_cost_series"]) == 24
    assert "grid_only" in data["cumulative_cost_series"][0]
    assert "optimised_lp" in data["cumulative_cost_series"][0]


def test_api_outlook_endpoint(client: TestClient) -> None:
    """Verify GET /api/outlook provides next-24h forecasts and battery schedule."""
    start = "2026-05-26 00:00:00"
    response = client.get(f"/api/outlook?start={start}")
    assert response.status_code == 200
    data = response.json()
    assert data["hours"] == 24
    assert len(data["hourly_outlook"]) == 24
    assert "expected_cost" in data
    assert data["hourly_outlook"][0]["hour"] == 0


def test_api_faults_endpoint(client: TestClient) -> None:
    """Verify GET /api/faults returns detected PV fault events with economic loss."""
    start = "2026-01-01 00:00:00"
    end = "2026-02-01 00:00:00"
    response = client.get(f"/api/faults?start={start}&end={end}")
    assert response.status_code == 200
    data = response.json()
    assert "total_events" in data
    assert "total_energy_lost_kwh" in data
    assert "events" in data
    if data["total_events"] > 0:
        first_ev = data["events"][0]
        assert "start" in first_ev
        assert "end" in first_ev
        assert "duration_h" in first_ev
        assert "severity" in first_ev
        assert "cost_lost" in first_ev
        assert first_ev["detected_by"] in ["Residual Threshold", "Isolation Forest", "Both"]


def test_api_period_summary_endpoint(client: TestClient) -> None:
    """Verify GET /api/period-summary returns monthly energy and cost aggregates."""
    response = client.get("/api/period-summary?granularity=month")
    assert response.status_code == 200
    data = response.json()
    assert len(data["periods"]) == 12  # 12 months in 365-day dataset
    jan = data["periods"][0]
    assert jan["period"] == "2026-01"
    assert jan["solar_kwh"] > 0.0
    assert jan["load_kwh"] > 0.0
    assert jan["optimised_cost"] <= jan["grid_only_cost"]


def test_api_model_performance_endpoint(client: TestClient) -> None:
    """Verify GET /api/model-performance returns forecast and fault benchmark metrics."""
    response = client.get("/api/model-performance")
    assert response.status_code == 200
    data = response.json()
    assert "forecast_metrics" in data
    assert "fault_metrics" in data
    assert "model_metrics" in data["forecast_metrics"]
    assert "method_a_residual_threshold" in data["fault_metrics"]
    assert "confusion_matrix" in data["fault_metrics"]["method_a_residual_threshold"]

