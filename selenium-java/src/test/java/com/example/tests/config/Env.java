package com.example.tests.config;

import io.github.cdimascio.dotenv.Dotenv;

import java.util.Locale;

public final class Env {

    private static final Dotenv DOTENV = Dotenv.configure().ignoreIfMissing().load();

    private Env() {}

    public static String get(String key, String fallback) {
        String fromProcess = System.getenv(key);
        if (fromProcess != null && !fromProcess.isBlank()) return fromProcess;
        String fromFile = DOTENV.get(key);
        if (fromFile != null && !fromFile.isBlank()) return fromFile;
        return fallback;
    }

    public static String platform() {
        return get("PLATFORM", "web").toLowerCase(Locale.ROOT);
    }

    public static String baseUrl() {
        return get("BASE_URL", "{{BASE_URL}}");
    }

    /**
     * Grid endpoint. {@code GRID_URL} wins; otherwise {@code GRID_HOST} is used.
     *
     * <p>Both are scheme-tolerant, because the local and CI values differ in
     * scheme as well as host: locally the grid is {@code localhost:5555} over
     * plain HTTP, while the public endpoint used from GitHub Actions
     * (e.g. {@code enterprise-grid.robotactions.com}) is HTTPS. Two failure
     * modes are handled here rather than left to bite at session creation:
     * <ul>
     *   <li>a value that already carries a scheme is returned untouched — the
     *       old code blindly prefixed {@code http://}, producing
     *       {@code http://https://host} for a perfectly reasonable
     *       {@code GRID_HOST=https://…};</li>
     *   <li>a bare host gets {@code http://} for loopback and {@code https://}
     *       for anything else, so a public hostname is never downgraded to
     *       cleartext (which the edge would redirect or refuse, surfacing as an
     *       opaque connection error mid-run).</li>
     * </ul>
     */
    public static String gridUrl() {
        String explicit = get("GRID_URL", null);
        String raw = explicit != null ? explicit : get("GRID_HOST", "localhost:5555");
        return withScheme(raw);
    }

    private static String withScheme(String hostOrUrl) {
        String value = hostOrUrl.trim();
        if (value.contains("://")) return value;
        boolean loopback = value.startsWith("localhost")
            || value.startsWith("127.0.0.1")
            || value.startsWith("0.0.0.0")
            || value.startsWith("[::1]");
        return (loopback ? "http://" : "https://") + value;
    }

    public static String authToken() {
        return get("AUTH_TOKEN", "{{AUTH_TOKEN}}");
    }

    public static boolean ci() {
        String v = get("CI", "");
        return !v.isBlank() && !"false".equalsIgnoreCase(v) && !"0".equals(v);
    }

    /** The RA test-suite label, sent as ra:testsuite capability. */
    public static String testSuite() {
        return get("RA_TESTSUITE", "Java Selenium");
    }

    /**
     * First UDID from RA_DEVICE_UDIDS (comma-separated).
     * Used to pin Android mobileweb sessions to a real device.
     */
    public static String firstAndroidUdid() {
        String raw = get("RA_DEVICE_UDIDS", "");
        if (raw.isBlank()) return null;
        return raw.split(",")[0].trim();
    }

    /**
     * First UDID from RA_IOS_UDIDS (comma-separated).
     * Used to pin iOS Safari mobileweb sessions to a real device.
     */
    public static String firstIosUdid() {
        String raw = get("RA_IOS_UDIDS", "");
        if (raw.isBlank()) return null;
        return raw.split(",")[0].trim();
    }
}
