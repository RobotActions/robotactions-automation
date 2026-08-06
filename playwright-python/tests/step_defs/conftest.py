import pytest
from pages.home_page import HomePage


@pytest.fixture
def home_page(page, base_url) -> HomePage:
    """HomePage fixture for BDD steps."""
    return HomePage(page, base_url)
