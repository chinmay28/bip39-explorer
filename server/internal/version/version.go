// Package version carries the application version.
//
// The scheme is calendar-based: vYEAR.MONTH.PATCH, where the patch number is
// the repository's commit count — every commit is a patch release, so
// `v2026.11.42` is the 42nd commit, made in November 2026. The month is
// written as a plain number, not zero-padded: that keeps the string valid
// semver, which forbids a leading zero, and nothing here orders versions by
// sorting text.
//
// All three parts come from git, and none of them from a person. The year and
// month are the month of the commit being built — its committer date, in the
// committer's own timezone — so the line moves the moment a commit lands in a
// new month, with nobody remembering to bump anything, and a rebuild of an old
// tree still calls itself what it originally shipped as, because a commit's
// date does not change. The patch number is the commit count. A compiled
// binary has no access to git, so both are stamped at link time:
//
//	go build -ldflags "$(node scripts/version.mjs --ldflags)"
//
// which expands to
//
//	-X github.com/chinmay28/bip39-explorer/server/internal/version.Patch=$(git rev-list --count HEAD)
//	-X github.com/chinmay28/bip39-explorer/server/internal/version.Date=$(git log -1 --format=%cI | cut -c1-7)
//
// `npm run build` (and `build:server`) does this for you via scripts/version.mjs,
// which is also what the web client's build and the Android app's read, so the
// binary, the page it serves and the APK can never disagree.
//
// A bare `go build` stamps nothing. Such a build is a development build and
// says so: patch 0, which is never a release, under the month of the build
// clock — the one place the clock is consulted, and only because an unstamped
// build has no commit to ask.
//
// There is no semantic major/minor: the leading numbers say *when* a release
// was made, not what it promises about compatibility. The wordlist this app
// explores is frozen by BIP-39 itself, so there is no compatibility axis for a
// major number to move along.
package version

import (
	"strconv"
	"time"
)

// Patch is the repository's commit count, stamped at link time (see the
// package comment). A bare `go build` leaves it at "0": patch 0 means an
// unstamped development build, never a release.
var Patch = "0"

// Date is the month of the commit being built, as "YYYY-MM", stamped at link
// time beside Patch. Empty on an unstamped build, which then reports the
// month it was compiled in.
var Date = ""

// now is the clock an unstamped build falls back to; a variable so a test can
// hold it still.
var now = time.Now

// Year and Month are the release line: the commit's month when stamped, the
// build's when not. Month is a calendar month, 1–12.
func Year() int  { y, _ := yearMonth(); return y }
func Month() int { _, m := yearMonth(); return m }

func yearMonth() (int, int) {
	if t, err := time.Parse("2006-01", Date); err == nil {
		return t.Year(), int(t.Month())
	}
	t := now().UTC()
	return t.Year(), int(t.Month())
}

// String renders the full version, `v`-prefixed to match how the project tags
// releases (v2026.11.42). This is the one rendering — it's what the CLI
// prints, what /healthz reports, and what the PWA shows in its header.
func String() string {
	y, m := yearMonth()
	return "v" + strconv.Itoa(y) + "." + strconv.Itoa(m) + "." + Patch
}
