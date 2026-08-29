package com.example.tests.config;

import org.openqa.selenium.remote.http.ClientConfig;
import org.openqa.selenium.remote.http.HttpClient;
import org.openqa.selenium.remote.http.HttpHandler;
import org.openqa.selenium.remote.http.HttpMethod;
import org.openqa.selenium.remote.http.HttpRequest;
import org.openqa.selenium.remote.http.HttpResponse;
import org.openqa.selenium.remote.http.WebSocket;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.URL;
import java.net.http.HttpResponse.BodyHandlers;
import java.time.Duration;
import java.util.HashSet;
import java.util.Set;

/**
 * Selenium HttpClient that pins to HTTP/1.1. Selenium 4's default JdkHttpClient
 * builds java.net.http.HttpClient without setting .version(...), which defaults
 * to HTTP_2 and attempts a cleartext h2c upgrade on every fresh connection
 * (Connection: Upgrade, HTTP2-Settings + Upgrade: h2c).
 *
 * The grid handles WebSocket traffic (CDP/BiDi/Playwright) on a separate path
 * from ordinary requests, and an h2c upgrade is treated as the former. An
 * in-session command sent over the resulting h2 stream while still carrying a
 * /t/&lt;token&gt; path prefix fails with "Unable to find handler". Forcing
 * HTTP/1.1 keeps every request on the ordinary request path, where the token
 * prefix is handled as expected.
 *
 * WebSocket open is delegated to a transient JdkHttpClient on demand — we don't
 * use BiDi in the smoke suite, so this path is only here for completeness.
 */
public final class Http11HttpClientFactory implements HttpClient.Factory {

    @Override
    public HttpClient createClient(ClientConfig config) {
        return new Http11HttpClient(config);
    }

    @Override
    public HttpClient createClient(URL url) {
        return createClient(ClientConfig.defaultConfig().baseUrl(url));
    }

    @Override
    public void cleanupIdleClients() {
        // No-op: java.net.http.HttpClient manages its own connection pool.
    }

    private static final class Http11HttpClient implements HttpClient {
        // Headers java.net.http.HttpClient forbids the caller from setting —
        // they're managed internally and throw IllegalArgumentException if
        // present in newBuilder().header(...). We silently drop these when
        // translating Selenium's HttpRequest into a java.net.http.HttpRequest.
        private static final Set<String> RESTRICTED_HEADERS = restrictedHeaderSet();

        private final java.net.http.HttpClient jdkClient;
        private final URI baseUri;
        private final Duration readTimeout;
        private final ClientConfig config; // retained for openSocket fallback
        // ClientConfig.filter() carries auth-header + AddSeleniumUserAgent +
        // any other Filters the caller chained on with .withFilter(). Selenium
        // does NOT auto-wrap the HttpClient with these — the HttpClient impl
        // must apply them itself (see JdkHttpClient.handler field). We mirror
        // that: build a HttpHandler that pipes filtered requests into our
        // executeRaw, and route public execute() through it.
        private final HttpHandler filteredHandler;

        Http11HttpClient(ClientConfig config) {
            this.config = config;
            java.net.http.HttpClient.Builder builder = java.net.http.HttpClient.newBuilder()
                .version(java.net.http.HttpClient.Version.HTTP_1_1)
                .followRedirects(java.net.http.HttpClient.Redirect.ALWAYS)
                .connectTimeout(config.connectionTimeout());
            if (config.sslContext() != null) {
                builder.sslContext(config.sslContext());
            }
            this.jdkClient = builder.build();
            this.baseUri = URI.create(config.baseUri().toString());
            this.readTimeout = config.readTimeout();
            this.filteredHandler = config.filter().andFinally(this::executeRaw);
        }

        @Override
        public HttpResponse execute(HttpRequest request) {
            return filteredHandler.execute(request);
        }

        /** Raw transport — bypasses filters; called only via the wrapped
         *  filteredHandler chain above. */
        private HttpResponse executeRaw(HttpRequest request) {
            URI uri = resolve(request.getUri());
            java.net.http.HttpRequest.Builder builder = java.net.http.HttpRequest.newBuilder()
                .uri(uri)
                .timeout(readTimeout);

            // Copy headers, skipping the restricted set java.net.http rejects.
            for (String name : request.getHeaderNames()) {
                if (RESTRICTED_HEADERS.contains(name.toLowerCase())) continue;
                for (String value : request.getHeaders(name)) {
                    try {
                        builder.header(name, value);
                    } catch (IllegalArgumentException ignored) {
                        // Some JDK versions tighten the restricted set further.
                        // Skip rather than fail the whole request.
                    }
                }
            }

            // Body — drain Selenium's Contents InputStream into a byte[]
            // because we know WebDriver requests are small (JSON capabilities,
            // command payloads). Streaming would force chunked encoding,
            // which is not worth the complexity here.
            byte[] body;
            try (java.io.InputStream in = request.getContent().get()) {
                body = in.readAllBytes();
            } catch (IOException e) {
                throw new UncheckedIOException("Read request body failed", e);
            }

            java.net.http.HttpRequest.BodyPublisher publisher =
                body.length == 0
                    ? java.net.http.HttpRequest.BodyPublishers.noBody()
                    : java.net.http.HttpRequest.BodyPublishers.ofByteArray(body);
            HttpMethod method = request.getMethod();
            builder.method(method.toString(), publisher);

            java.net.http.HttpResponse<byte[]> raw;
            try {
                raw = jdkClient.send(builder.build(), BodyHandlers.ofByteArray());
            } catch (IOException e) {
                throw new UncheckedIOException(
                    "HTTP/1.1 request to " + uri + " failed", e);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException("Interrupted during HTTP request", e);
            }

            HttpResponse seleniumResponse = new HttpResponse();
            seleniumResponse.setStatus(raw.statusCode());
            raw.headers().map().forEach((name, values) -> {
                for (String value : values) {
                    seleniumResponse.addHeader(name, value);
                }
            });
            byte[] payload = raw.body() == null ? new byte[0] : raw.body();
            seleniumResponse.setContent(() -> new java.io.ByteArrayInputStream(payload));
            return seleniumResponse;
        }

        @Override
        public WebSocket openSocket(HttpRequest request, WebSocket.Listener listener) {
            // We don't use Selenium BiDi / CDP in the smoke suite. If a caller
            // ever asks for one, delegate to the default JdkHttpClient — that
            // path only fires for ws:// URLs and goes through the proxy's WS
            // upgrade handler (which correctly routes /se/cdp + /se/bidi).
            return HttpClient.Factory.createDefault().createClient(config)
                .openSocket(request, listener);
        }

        @Override
        public void close() {
            // java.net.http.HttpClient has no close() in Java 17/21; pool is GC'd.
        }

        private URI resolve(String reqUri) {
            // Selenium command paths are always absolute (e.g. /session,
            // /session/<id>/url), so we string-concat base + path the same
            // way JdkHttpClient does.
            String base = baseUri.toString();
            if (base.endsWith("/") && reqUri.startsWith("/")) {
                return URI.create(base + reqUri.substring(1));
            }
            return URI.create(base + reqUri);
        }

        private static Set<String> restrictedHeaderSet() {
            Set<String> s = new HashSet<>();
            // From sun.net.www.protocol.http.HttpURLConnection — JDK's HttpClient
            // shares the same disallowed list unless the system property
            // jdk.httpclient.allowRestrictedHeaders is set.
            for (String h : new String[]{
                "connection", "content-length", "expect", "host", "upgrade"
            }) s.add(h);
            return s;
        }
    }
}
