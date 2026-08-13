// Command bip39-explorer serves the BIP-39 explorer PWA.
//
// One static binary with the client embedded, no database, no API and no
// runtime dependencies — `npm run build` produces it and the quick-start
// script installs it under systemd.
//
// Configuration is flag > env > default, and the flags are the documented
// interface; the env vars remain only as fallbacks for the systemd unit.
package main

import (
	"context"
	"embed"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/chinmay28/bip39-explorer/server/internal/httpserve"
	"github.com/chinmay28/bip39-explorer/server/internal/version"
)

// The built PWA, copied into webdist/ before `go build` at release time. The
// directory ships with only a README so a plain `go build` still compiles;
// without real assets the server falls back to --web-dist.
//
//go:embed all:webdist
var embedded embed.FS

const (
	defaultPort = "8788"
	defaultHost = "0.0.0.0"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) > 0 {
		switch args[0] {
		case "version", "--version", "-v":
			fmt.Println(version.String())
			return nil
		case "serve":
			args = args[1:]
		case "-h", "--help", "help":
			usage()
			return nil
		}
	}
	return serve(args)
}

func usage() {
	fmt.Printf(`bip39-explorer %s — an offline explorer for the BIP-39 English wordlist

usage:
  bip39-explorer serve [flags]     serve the client (also the default)
  bip39-explorer version           print the version

flags (each overrides its env fallback, which overrides the default):
  --host string   bind address            (HOST, default %s)
  --port string   listen port             (PORT, default %s)
  --web-dist dir  built client directory  (WEB_DIST, default: use embedded assets)
`, version.String(), defaultHost, defaultPort)
}

func serve(args []string) error {
	flags := flag.NewFlagSet("serve", flag.ContinueOnError)
	host := flags.String("host", envOr("HOST", defaultHost), "bind address")
	port := flags.String("port", envOr("PORT", defaultPort), "listen port")
	webDist := flags.String("web-dist", os.Getenv("WEB_DIST"), "built client directory; overrides embedded assets")
	if err := flags.Parse(args); err != nil {
		return err
	}

	assets, source, err := clientAssets(*webDist)
	if err != nil {
		return err
	}

	address := net.JoinHostPort(*host, *port)
	server := &http.Server{
		Addr:              address,
		Handler:           httpserve.New(assets),
		ReadHeaderTimeout: 10 * time.Second,
	}

	listener, err := net.Listen("tcp", address)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", address, err)
	}

	fmt.Printf("bip39-explorer %s serving %s on http://%s\n", version.String(), source, address)

	errc := make(chan error, 1)
	go func() {
		if err := server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errc <- err
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	select {
	case err := <-errc:
		return err
	case <-stop:
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return server.Shutdown(ctx)
}

// clientAssets resolves where the built client is coming from: an explicit
// directory, or the copy embedded at build time.
func clientAssets(webDist string) (fs.FS, string, error) {
	if webDist != "" {
		if _, err := os.Stat(webDist + "/index.html"); err != nil {
			return nil, "", fmt.Errorf("--web-dist %q has no index.html", webDist)
		}
		return os.DirFS(webDist), "client from " + webDist, nil
	}

	sub, err := fs.Sub(embedded, "webdist")
	if err != nil {
		return nil, "", err
	}
	if _, err := fs.Stat(sub, "index.html"); err != nil {
		return nil, "", errors.New(
			"no client assets: this binary was built without the PWA embedded — " +
				"run `npm run build`, or point --web-dist at apps/web/dist")
	}
	return sub, "embedded client", nil
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
