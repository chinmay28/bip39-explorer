package httpserve

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/chinmay28/bip39-explorer/server/internal/version"
)

func testAssets() fstest.MapFS {
	return fstest.MapFS{
		"index.html":     {Data: []byte("<!doctype html><title>app</title>")},
		"assets/app.js":  {Data: []byte("console.log('hi')")},
		"assets/app.css": {Data: []byte("body{}")},
	}
}

func get(t *testing.T, handler http.Handler, path string) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
	return recorder
}

func TestServesTheClient(t *testing.T) {
	handler := New(testAssets())

	for _, path := range []string{"/", "/index.html"} {
		got := get(t, handler, path)
		if got.Code != http.StatusOK {
			t.Fatalf("GET %s = %d, want 200", path, got.Code)
		}
		if !strings.Contains(got.Body.String(), "<title>app</title>") {
			t.Fatalf("GET %s did not return index.html: %q", path, got.Body.String())
		}
	}
}

func TestServesAssets(t *testing.T) {
	got := get(t, New(testAssets()), "/assets/app.js")
	if got.Code != http.StatusOK {
		t.Fatalf("asset = %d, want 200", got.Code)
	}
	if got.Body.String() != "console.log('hi')" {
		t.Fatalf("asset body = %q", got.Body.String())
	}
}

// A deep link must reach the client, not a 404 — the client owns routing.
func TestUnknownPathFallsBackToTheClient(t *testing.T) {
	got := get(t, New(testAssets()), "/word/salmon")
	if got.Code != http.StatusOK {
		t.Fatalf("deep link = %d, want 200", got.Code)
	}
	if !strings.Contains(got.Body.String(), "<title>app</title>") {
		t.Fatal("deep link did not fall back to index.html")
	}
}

func TestHealthReportsTheVersion(t *testing.T) {
	got := get(t, New(testAssets()), "/healthz")
	if got.Code != http.StatusOK {
		t.Fatalf("/healthz = %d, want 200", got.Code)
	}
	var body struct {
		Status  string `json:"status"`
		Version string `json:"version"`
	}
	if err := json.Unmarshal(got.Body.Bytes(), &body); err != nil {
		t.Fatalf("/healthz is not JSON: %v", err)
	}
	if body.Status != "ok" || body.Version != version.String() {
		t.Fatalf("/healthz = %+v, want ok and %s", body, version.String())
	}
}

// The app makes no network requests. The policy is what makes that a
// guarantee the browser enforces rather than a claim in a README.
func TestForbidsNetworkAccessInPolicy(t *testing.T) {
	got := get(t, New(testAssets()), "/")
	policy := got.Header().Get("Content-Security-Policy")
	for _, want := range []string{"connect-src 'none'", "default-src 'self'", "frame-ancestors 'none'"} {
		if !strings.Contains(policy, want) {
			t.Fatalf("policy %q is missing %q", policy, want)
		}
	}
	if got.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatal("missing nosniff")
	}
}

// A traversal attempt must not escape the asset set.
func TestDoesNotServeOutsideTheAssets(t *testing.T) {
	got := get(t, New(testAssets()), "/../../etc/passwd")
	if got.Code != http.StatusOK || !strings.Contains(got.Body.String(), "<title>app</title>") {
		t.Fatalf("traversal = %d %q, want the client", got.Code, got.Body.String())
	}
}

func TestSaysSoWhenTheClientIsMissing(t *testing.T) {
	got := get(t, New(fstest.MapFS{}), "/")
	if got.Code != http.StatusInternalServerError {
		t.Fatalf("empty assets = %d, want 500", got.Code)
	}
	if !strings.Contains(got.Body.String(), "build the web app first") {
		t.Fatalf("unhelpful error: %q", got.Body.String())
	}
}
