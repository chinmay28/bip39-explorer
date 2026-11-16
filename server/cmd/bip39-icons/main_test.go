package main

import (
	"bytes"
	"image/png"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// The committed icons are what the generator makes from the committed
// source. A hand-edited icon, or a source changed without regenerating,
// fails here.
func TestCommittedIconsMatchTheirSource(t *testing.T) {
	root := repoRoot()
	files, err := Generate(root)
	if err != nil {
		t.Fatal(err)
	}
	if stale := Drift(root, files); len(stale) > 0 {
		t.Fatalf("out of date (run `cd server && go run ./cmd/bip39-icons`): %v", stale)
	}
}

// Every icon is the size its density asks for, and the legacy icon's corners
// are transparent while its middle is the opaque plate.
func TestSizesAndShapes(t *testing.T) {
	files, err := Generate(repoRoot())
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]int{"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
	for d, px := range want {
		img, err := png.Decode(bytes.NewReader(files[res+"/mipmap-"+d+"/ic_launcher.png"]))
		if err != nil {
			t.Fatal(d, err)
		}
		if img.Bounds().Dx() != px || img.Bounds().Dy() != px {
			t.Errorf("%s ic_launcher is %v, want %dpx", d, img.Bounds(), px)
		}
		if _, _, _, a := img.At(0, 0).RGBA(); a != 0 {
			t.Errorf("%s ic_launcher corner is not transparent", d)
		}
		if _, _, _, a := img.At(px/2, 2).RGBA(); a != 0xffff {
			t.Errorf("%s ic_launcher top edge is not opaque", d)
		}
		fg, err := png.Decode(bytes.NewReader(files[res+"/mipmap-"+d+"/ic_launcher_foreground.png"]))
		if err != nil {
			t.Fatal(d, err)
		}
		if fg.Bounds().Dx() != px*108/48 {
			t.Errorf("%s foreground is %v, want %dpx", d, fg.Bounds(), px*108/48)
		}
	}
	if !strings.Contains(string(files[res+"/values/ic_launcher_background.xml"]), "#4ECDC4") {
		t.Errorf("background colour is not the plate's teal:\n%s", files[res+"/values/ic_launcher_background.xml"])
	}
}

// Every @drawable/, @mipmap/, R.drawable. and R.mipmap. reference in the app
// names a resource that exists, so retiring an icon cannot leave a reference
// only a Gradle build would notice. A library's own (androidx.appcompat.R.…)
// is the library's business and is skipped.
func TestEveryIconReferenceResolves(t *testing.T) {
	root := repoRoot()
	appDir := filepath.Join(root, "apps/android/app/src/main")
	ref := regexp.MustCompile(`(?:^|[^.\w])(?:@|R\.)(drawable|mipmap)[/.]([a-z0-9_]+)`)
	err := filepath.Walk(appDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() || !(strings.HasSuffix(path, ".xml") || strings.HasSuffix(path, ".kt")) {
			return err
		}
		src, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		for _, m := range ref.FindAllStringSubmatch(string(src), -1) {
			matches, _ := filepath.Glob(filepath.Join(appDir, "res", m[1]+"*", m[2]+".*"))
			if len(matches) == 0 {
				t.Errorf("%s refers to %s/%s, which does not exist", path, m[1], m[2])
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
