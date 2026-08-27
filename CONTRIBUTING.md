# Contributing to testgen

Thank you for contributing to the testgen template gallery!

## Adding a New Template

1. **Create a directory** with your template name (e.g., `appium-java-testng/`)

2. **Required files:**
   - Dependency file (`package.json`, `requirements.txt`, `pom.xml`)
   - Test config (framework-specific)
   - Sample BDD feature file (`features/*.feature`)
   - Step definitions
   - Page Object example
   - `.gitignore`
   - `README.md` with setup instructions

3. **Use placeholders** for configurable values:
   | Placeholder | Description |
   |-------------|-------------|
   | `{{PROJECT_NAME}}` | User's project name |
   | `{{BASE_URL}}` | Application URL under test |
   | `{{GRID_URL}}` | Selenium Grid URL |
   | `{{AUTH_TOKEN}}` | Bearer token for Grid auth |
   | `{{BROWSER_NAME}}` | Target browser |
   | `{{DEVICE_UDID}}` | Device identifier |
   | `{{APP_PATH}}` | Path to mobile app |
   | `{{PLATFORM_NAME}}` | android / ios |
   | `{{PLATFORM_VERSION}}` | OS version |

4. **Update `templates.json`** with metadata for your template

5. **Primary = BDD**, Secondary = regular tests. Every template must include both:
   - BDD tests as the primary test style (feature files + step definitions)
   - Regular tests as secondary (for users who prefer non-BDD)

6. **Test your template** — it must install and compile/lint without errors

## Template Quality Checklist

- [ ] All dependencies install cleanly
- [ ] BDD tests compile/lint without errors
- [ ] Regular tests compile/lint without errors
- [ ] Page Object pattern used consistently
- [ ] Placeholders documented in README
- [ ] Grid connection configurable via env vars
- [ ] `.gitignore` covers generated files
- [ ] No hardcoded values (URLs, credentials, etc.)

## Pull Request Process

1. Fork the repo
2. Create a branch (`template/your-template-name`)
3. Add your template following the guidelines above
4. Update `templates.json`
5. Submit a PR with a description of the template
