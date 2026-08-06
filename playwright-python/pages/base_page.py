from playwright.sync_api import Page, Locator, expect


class BasePage:
    """Base class for all page objects using Playwright."""

    def __init__(self, page: Page, base_url: str = "") -> None:
        self.page = page
        self.base_url = base_url

    def open(self, path: str = "") -> None:
        self.page.goto(f"{self.base_url}{path}")

    def find(self, selector: str) -> Locator:
        return self.page.locator(selector)

    def click(self, selector: str) -> None:
        self.page.locator(selector).click()

    def fill(self, selector: str, text: str) -> None:
        self.page.locator(selector).fill(text)

    def get_text(self, selector: str) -> str:
        return self.page.locator(selector).text_content() or ""

    @property
    def title(self) -> str:
        return self.page.title()

    @property
    def current_url(self) -> str:
        return self.page.url
