---
name: cucumber-jvm-selenium
description: Cucumber-JVM + Selenium 4 + Appium Java Client expertise — feature file → step glue → page objects, grid routing via /t/<token> path-prefix on RemoteWebDriver, Maven Surefire parallelism, JUnit 5 runner. Load before adding/changing scenarios or steps in `testgen/selenium-java/`.
---

# Cucumber-JVM + Selenium 4 (Java)

The primary BDD pattern: `.feature` → `cucumber-java` glue classes → JUnit 5 runner via `cucumber-junit-platform-engine`. Maven Surefire executes; `RunCucumberTest` is the entry runner annotated with `@Suite`. `PLATFORM` env var (`web | android | ios`) flips between Selenium browser and Appium mobile drivers in the same glue; this skill focuses on `PLATFORM=web`.

## File layout

```
pom.xml
src/test/
  java/com/example/
    runners/RunCucumberTest.java       — JUnit 5 suite annotated with @Suite
    stepdefs/                          — step glue classes
      RobotActionsLoadSteps.java       — Given/When/Then for the load feature
      Hooks.java                       — @Before/@After (driver lifecycle)
    pages/                             — Page Object Model
      BasePage.java                    — base class with explicit waits
      RobotActionsHomePage.java        — page-specific actions/locators
    config/
      DriverFactory.java               — RemoteWebDriver builder w/ grid + auth
  resources/
    features/                          — Gherkin specs (.feature)
    junit-platform.properties          — Cucumber + JUnit Platform config
    cucumber.properties                — glue paths, formatters
```

## Grid routing

`DriverFactory` builds a `RemoteWebDriver` with the proxy's path-prefix auth — Java HTTP clients reject `user:pass@` URLs and Selenium's `HttpCommandExecutor` doesn't expose a per-request Authorization header setter cleanly:

```java
public static WebDriver build() throws MalformedURLException {
  String gridHost = System.getenv().getOrDefault("GRID_HOST", "localhost:5555");
  String token    = System.getenv().getOrDefault("AUTH_TOKEN", "");
  String urlStr   = (token == null || token.isBlank() || token.startsWith("{{"))
      ? "http://" + gridHost
      : "http://" + gridHost + "/t/" + token;
  URL grid = URI.create(urlStr).toURL();

  ChromeOptions opts = new ChromeOptions();
  opts.addArguments("--no-sandbox", "--disable-dev-shm-usage");
  if (System.getenv("CI") != null) {
    opts.addArguments("--headless=new", "--disable-gpu");
  }
  Map<String, Object> logPrefs = new HashMap<>();
  logPrefs.put("browser", "ALL");
  opts.setCapability("goog:loggingPrefs", logPrefs);

  return new RemoteWebDriver(grid, opts);
}
```

`.env` provides the env vars; load via `io.github.cdimascio:dotenv-java` in `Hooks` or via `system-properties` in `pom.xml`.

## Adding a step for an existing feature

```java
import io.cucumber.java.en.When;
import io.cucumber.java.en.Then;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class RobotActionsLoadSteps {
  private final WebDriver driver;
  private final RobotActionsHomePage home;

  public RobotActionsLoadSteps(WebDriver driver) {
    this.driver = driver;
    this.home = new RobotActionsHomePage(driver);
  }

  @When("I click the {string} nav link")
  public void clickNavLink(String label) {
    home.clickNavLink(label);
  }

  @Then("the URL fragment should be {string}")
  public void urlFragment(String fragment) {
    assertTrue(driver.getCurrentUrl().endsWith(fragment),
      "expected fragment " + fragment + " in " + driver.getCurrentUrl());
  }
}
```

PicoContainer (Cucumber's default DI) injects the `WebDriver` from `Hooks` automatically — declare it in the constructor and the runtime wires it.

## Locator priority (Selenium-Java)

Selenium 4's `RelativeLocator` + `By.cssSelector(...)` + `By.xpath(...)` cover the same hierarchy as the Python skill:

```java
import org.openqa.selenium.By;
import org.openqa.selenium.support.locators.RelativeLocator;

// Visible text — XPath with normalize-space (closest to getByText)
By.xpath("//a[normalize-space()='" + label + "']");
By.xpath("//button[normalize-space()='" + label + "']");

// Test ID
By.cssSelector("[data-testid='" + id + "']");

// Aria-label
By.xpath("//*[@aria-label='" + label + "']");
```

Never `Thread.sleep(...)`. Use `WebDriverWait`:

```java
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
wait.until(ExpectedConditions.visibilityOfElementLocated(By.tagName("h1")));
```

## Hydration check

```java
@Given("I wait for the SPA to hydrate")
public void waitForHydration() {
  WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
  wait.until(ExpectedConditions.visibilityOfElementLocated(By.tagName("main")));
  wait.until(d -> ((JavascriptExecutor) d)
      .executeScript("return document.readyState").equals("complete"));
}
```

## Console-error assertion

`goog:loggingPrefs` cap above enables browser-log retrieval. Then:

```java
@Then("no console errors should have been logged")
public void noConsoleErrors() {
  LogEntries logs = driver.manage().logs().get(LogType.BROWSER);
  List<LogEntry> errors = logs.getAll().stream()
      .filter(l -> l.getLevel().equals(Level.SEVERE))
      .toList();
  assertTrue(errors.isEmpty(),
      "console errors: " + errors);
}
```

## Parallel workers — how the load runner uses them

```bash
./load.sh 10 3 @load   # Surefire forkCount=10 + Cucumber parallelism=10 + repeats=3
```

Two layers of parallelism:
1. **Surefire `forkCount=10`** — spawns 10 JVM forks; each runs a slice of the test set.
2. **Cucumber-JVM parallel execution** — within a fork, scenarios in matching features can run concurrently if `cucumber.execution.parallel.enabled=true`.

For grid load testing, prefer ONE layer (forkCount) — the second layer adds JVM thread contention that distorts grid timing measurements. The load.sh defaults to forkCount-only.

`junit-platform.properties`:
```
cucumber.execution.parallel.enabled=false
cucumber.execution.parallel.config.strategy=fixed
cucumber.execution.parallel.config.fixed.parallelism=1
```

To repeat scenarios M times, the cleanest pattern is a `@DataProvider`-style `@TestFactory` shim OR running the maven goal in a loop:
```bash
for i in $(seq 1 $M); do mvn test ...; done
```
The load.sh handles this via `-Dload.repeats=$M` which a `RepeatExtension` reads (see `RepeatExtension.java` in the template's `runners/`).

## Cucumber-JVM gotchas

- **Glue path** — `cucumber.glue` in `cucumber.properties` must point at your stepdefs package. Default in this template: `com.example.stepdefs`.
- **Constructor injection** — PicoContainer wires by type. If two glue classes need the same WebDriver, declare it in each constructor; PicoContainer returns the same instance per scenario.
- **`@Before` / `@After`** — scenario-scoped by default. Use `@BeforeAll` / `@AfterAll` (Cucumber annotations, NOT JUnit's) for once-per-suite setup.
- **Java 17+** — `pom.xml` sets `maven.compiler.source=17` / `target=17`. Selenium 4.27 + cucumber-java 7.20 both require Java 11+.
- **Driver leaks under failure** — wrap `driver.quit()` in `@After` with try/catch + log; an unhandled exception in `@After` masks the original test failure in the JUnit report.
