// Command bip39-icons derives every icon the Android app ships from the one
// picture the web app already uses, apps/web/public/icon-512.png, and copies
// the developer badge from the web client into the app's drawables.
//
//	cd server && go run ./cmd/bip39-icons          # write them
//	cd server && go run ./cmd/bip39-icons -check   # fail if any has drifted
//
// `go test ./cmd/bip39-icons` runs the check too, so a hand-edited or stale
// copy fails the ordinary test suite. Never edit a derived file: edit the
// source and run this. What it makes, and what it assumes about the artwork,
// is in apps/android/README.md ("The icon").
package main

import (
	"bytes"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
)

func main() {
	check := flag.Bool("check", false, "report drift instead of writing")
	root := flag.String("root", repoRoot(), "repository root")
	flag.Parse()

	files, err := Generate(*root)
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
	if *check {
		stale := Drift(*root, files)
		for _, p := range stale {
			fmt.Fprintln(os.Stderr, "out of date:", p)
		}
		if len(stale) > 0 {
			fmt.Fprintln(os.Stderr, "run: cd server && go run ./cmd/bip39-icons")
			os.Exit(1)
		}
		return
	}
	for _, p := range sortedKeys(files) {
		full := filepath.Join(*root, p)
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			fmt.Fprintln(os.Stderr, "error:", err)
			os.Exit(1)
		}
		if err := os.WriteFile(full, files[p], 0o644); err != nil {
			fmt.Fprintln(os.Stderr, "error:", err)
			os.Exit(1)
		}
		fmt.Println("wrote", p)
	}
}

// Drift lists the generated paths whose committed copy differs from what
// Generate makes now, or is missing.
func Drift(root string, files map[string][]byte) []string {
	var stale []string
	for _, p := range sortedKeys(files) {
		have, err := os.ReadFile(filepath.Join(root, p))
		if err != nil || !bytes.Equal(have, files[p]) {
			stale = append(stale, p)
		}
	}
	return stale
}

func sortedKeys(m map[string][]byte) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// repoRoot is three directories above this file: server/cmd/bip39-icons.
func repoRoot() string {
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		return "."
	}
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", "..", ".."))
}
