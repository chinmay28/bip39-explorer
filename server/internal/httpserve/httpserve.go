// Package httpserve serves the built PWA and nothing else.
//
// There is no API. The client holds the whole dataset — the wordlist and the
// semantic index ride inside its bundle — so the server's entire job is to
// hand over static files with the right headers and get out of the way. That
// is why there is no database, no session, and no request this handler has to
// think about beyond "which file".
package httpserve

import (
	"io/fs"
	"mime"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/chinmay28/bip39-explorer/server/internal/version"
)

// New builds the handler for a set of built client assets.
//
// Deliberately not an http.ServeMux over an http.FileServer. Both of those
// answer awkward paths with a 301 — `/index.html` bounces to `/`, and a
// traversal attempt bounces to its cleaned form — which is safe but means the
// server's reply to a request depends on a redirect the caller has to follow.
// Resolving the path here instead makes every response direct and every rule
// visible in one function.
func New(assets fs.FS) http.Handler {
	return securityHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "only GET and HEAD are served", http.StatusMethodNotAllowed)
			return
		}

		clean := path.Clean("/" + r.URL.Path)
		if clean == "/healthz" {
			health(w)
			return
		}

		// path.Clean has already collapsed any ".." — a request cannot name a
		// file outside the asset set, and the FS is embedded anyway.
		name := strings.TrimPrefix(clean, "/")
		if name == "" || name == "." {
			name = "index.html"
		}
		if info, err := fs.Stat(assets, name); err != nil || info.IsDir() {
			// Unknown paths are the client's routes, not missing files.
			name = "index.html"
		}
		serveFile(w, r, assets, name)
	}))
}

func health(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write([]byte(`{"status":"ok","version":"` + version.String() + `"}` + "\n"))
}

func serveFile(w http.ResponseWriter, r *http.Request, assets fs.FS, name string) {
	body, err := fs.ReadFile(assets, name)
	if err != nil {
		http.Error(w, "client assets are missing — build the web app first", http.StatusInternalServerError)
		return
	}

	if extension := path.Ext(name); extension != "" {
		if kind := mime.TypeByExtension(extension); kind != "" {
			w.Header().Set("Content-Type", kind)
		}
	}
	// The build emits stable filenames rather than content hashes, so nothing
	// may be cached hard: revalidate instead. One conditional GET is a fair
	// price for never serving a stale app.
	if name == "index.html" {
		w.Header().Set("Cache-Control", "no-cache")
	} else {
		w.Header().Set("Cache-Control", "public, max-age=0, must-revalidate")
	}
	http.ServeContent(w, r, name, time.Time{}, strings.NewReader(string(body)))
}

// securityHeaders states in headers what the app already is: self-contained.
//
// The Content-Security-Policy is the load-bearing one. This app makes no
// network requests of any kind, so `connect-src 'none'` and `default-src
// 'self'` turn that promise into something a browser enforces rather than
// something a README asserts — if a future change ever tried to phone home,
// it would fail loudly here.
func securityHeaders(next http.Handler) http.Handler {
	const policy = "default-src 'self'; " +
		"script-src 'self'; " +
		"style-src 'self' 'unsafe-inline'; " +
		"img-src 'self' data:; " +
		"font-src 'self'; " +
		"connect-src 'none'; " +
		"form-action 'none'; " +
		"frame-ancestors 'none'; " +
		"base-uri 'none'"

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Security-Policy", policy)
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
	})
}
