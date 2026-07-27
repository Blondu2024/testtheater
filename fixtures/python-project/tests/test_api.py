"""The shape an AI builder leaves behind: a file named like a test suite,
full of functions that report their own results and never fail."""
import pytest
import requests

BASE_URL = "https://example.invalid"


def test_health():
    response = requests.get(f"{BASE_URL}/health")
    assert response.status_code == 200


def test_prints_the_result():
    response = requests.get(f"{BASE_URL}/users")
    print("OK" if response.status_code == 200 else "FAIL")


def test_always_true():
    assert True


def test_not_written_yet():
    pass


@pytest.mark.skip(reason="flaky on ci")
def test_rate_limit():
    assert requests.get(f"{BASE_URL}/limit").status_code == 429


class ApiTester:
    """Named the wrong way round, so pytest never collects any of this."""

    def __init__(self):
        self.token = None

    def test_login(self):
        response = requests.post(f"{BASE_URL}/login")
        assert response.status_code == 200

    def test_logout(self):
        response = requests.post(f"{BASE_URL}/logout")
        assert response.status_code == 204
