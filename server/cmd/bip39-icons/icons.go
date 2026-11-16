package main

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"math"
	"os"
	"path/filepath"
)

// Source is the artwork: a full-bleed square, the teal plate with the three
// bars, as the web app's manifest uses it (also as its maskable icon).
const Source = "apps/web/public/icon-512.png"

// cornerRadius is the plate's rounding as a fraction of the width, taken from
// the same drawing's vector form (apps/web/public/favicon.svg: rx 7 of 32).
const cornerRadius = 7.0 / 32.0

const res = "apps/android/app/src/main/res"

// densities are Android's buckets and their scale over mdpi.
var densities = []struct {
	name  string
	scale int // in quarters: mdpi 4, hdpi 6, …
}{
	{"mdpi", 4}, {"hdpi", 6}, {"xhdpi", 8}, {"xxhdpi", 12}, {"xxxhdpi", 16},
}

// copies are files the app carries verbatim from the web client, so the badge
// on the About screen is the badge in the page's header.
var copies = map[string]string{
	res + "/drawable-nodpi/dev_badge.png":      "apps/web/src/assets/dev-badge.png",
	res + "/drawable-nodpi/dev_badge_full.png": "apps/web/src/assets/dev-badge-full.png",
}

// Generate returns every derived file, keyed by its path from the repository
// root. It is a pure function of the source files: the same inputs always
// give the same bytes.
func Generate(root string) (map[string][]byte, error) {
	src, err := load(filepath.Join(root, Source))
	if err != nil {
		return nil, err
	}
	plate := src.At(src.Bounds().Min.X, src.Bounds().Min.Y)
	out := map[string][]byte{}
	put := func(path string, img image.Image) error {
		b, err := encode(img)
		if err != nil {
			return fmt.Errorf("%s: %w", path, err)
		}
		out[path] = b
		return nil
	}

	for _, d := range densities {
		// The legacy launcher icon: 48dp, rounded, on transparency.
		px := 48 * d.scale / 4
		if err := put(res+"/mipmap-"+d.name+"/ic_launcher.png", rounded(resize(src, px))); err != nil {
			return nil, err
		}
		// The adaptive foreground: a 108dp canvas, of which a launcher shows
		// the middle 72dp through its mask. The artwork fills exactly that
		// 72dp, over a background of its own plate colour, so whatever shape
		// the launcher cuts, it cuts teal.
		canvas := 108 * d.scale / 4
		inner := 72 * d.scale / 4
		if err := put(res+"/mipmap-"+d.name+"/ic_launcher_foreground.png", centred(resize(src, inner), canvas)); err != nil {
			return nil, err
		}
		// The themed-icon layer (Android 13+): the bars alone, as a mask the
		// launcher tints. Opacity is how far a pixel is from the plate.
		if err := put(res+"/mipmap-"+d.name+"/ic_launcher_monochrome.png", centred(silhouette(resize(src, inner), plate), canvas)); err != nil {
			return nil, err
		}
	}
	// The mark on the About screen, drawn at 56dp: rounded, xxxhdpi-sized.
	if err := put(res+"/drawable-nodpi/bip_logo.png", rounded(resize(src, 224))); err != nil {
		return nil, err
	}

	r, g, b, _ := plate.RGBA()
	out[res+"/values/ic_launcher_background.xml"] = []byte(fmt.Sprintf(`<?xml version="1.0" encoding="utf-8"?>
<!-- The icon's plate colour. Generated from %s by server/cmd/bip39-icons. -->
<resources>
    <color name="ic_launcher_background">#%02X%02X%02X</color>
</resources>
`, Source, r>>8, g>>8, b>>8))
	out[res+"/mipmap-anydpi/ic_launcher.xml"] = []byte(fmt.Sprintf(`<?xml version="1.0" encoding="utf-8"?>
<!-- Generated from %s by server/cmd/bip39-icons; edit that, not this. -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />
</adaptive-icon>
`, Source))

	for dst, from := range copies {
		b, err := os.ReadFile(filepath.Join(root, from))
		if err != nil {
			return nil, err
		}
		out[dst] = b
	}
	return out, nil
}

func load(path string) (image.Image, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	img, err := png.Decode(f)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	b := img.Bounds()
	if b.Dx() != b.Dy() {
		return nil, fmt.Errorf("%s: %dx%d, want a square", path, b.Dx(), b.Dy())
	}
	return img, nil
}

func encode(img image.Image) ([]byte, error) {
	var buf bytes.Buffer
	enc := png.Encoder{CompressionLevel: png.BestCompression}
	if err := enc.Encode(&buf, img); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// resize scales src to size×size by area averaging: each output pixel is the
// mean of the source area it covers, which is exact for a downscale and
// stays sharp-edged for flat artwork like this.
func resize(src image.Image, size int) *image.NRGBA {
	b := src.Bounds()
	n := float64(b.Dx())
	scale := n / float64(size)
	dst := image.NewNRGBA(image.Rect(0, 0, size, size))
	for y := 0; y < size; y++ {
		y0, y1 := float64(y)*scale, float64(y+1)*scale
		for x := 0; x < size; x++ {
			x0, x1 := float64(x)*scale, float64(x+1)*scale
			var sr, sg, sb, sa, area float64
			for sy := int(y0); sy < int(math.Ceil(y1)) && sy < b.Dy(); sy++ {
				wy := math.Min(y1, float64(sy+1)) - math.Max(y0, float64(sy))
				for sx := int(x0); sx < int(math.Ceil(x1)) && sx < b.Dx(); sx++ {
					wx := math.Min(x1, float64(sx+1)) - math.Max(x0, float64(sx))
					w := wx * wy
					c := color.NRGBA64Model.Convert(src.At(b.Min.X+sx, b.Min.Y+sy)).(color.NRGBA64)
					a := float64(c.A) / 0xffff
					sr += float64(c.R) / 0xffff * a * w
					sg += float64(c.G) / 0xffff * a * w
					sb += float64(c.B) / 0xffff * a * w
					sa += a * w
					area += w
				}
			}
			px := color.NRGBA{}
			if sa > 0 {
				px = color.NRGBA{
					R: byte8(sr / sa), G: byte8(sg / sa), B: byte8(sb / sa), A: byte8(sa / area),
				}
			}
			dst.SetNRGBA(x, y, px)
		}
	}
	return dst
}

// rounded cuts the plate's corners away, antialiased by 4×4 supersampling.
func rounded(img *image.NRGBA) *image.NRGBA {
	size := img.Bounds().Dx()
	r := cornerRadius * float64(size)
	out := image.NewNRGBA(img.Bounds())
	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			inside := 0
			for sy := 0; sy < 4; sy++ {
				for sx := 0; sx < 4; sx++ {
					if inRoundedSquare(float64(x)+(float64(sx)+0.5)/4, float64(y)+(float64(sy)+0.5)/4, float64(size), r) {
						inside++
					}
				}
			}
			c := img.NRGBAAt(x, y)
			c.A = byte(math.Round(float64(c.A) * float64(inside) / 16))
			if c.A == 0 {
				c = color.NRGBA{}
			}
			out.SetNRGBA(x, y, c)
		}
	}
	return out
}

func inRoundedSquare(px, py, size, r float64) bool {
	cx := math.Max(r, math.Min(size-r, px))
	cy := math.Max(r, math.Min(size-r, py))
	dx, dy := px-cx, py-cy
	return dx*dx+dy*dy <= r*r
}

// silhouette turns the artwork into a white mask of everything that is not
// the plate: the plate becomes transparent, the bars opaque.
func silhouette(img *image.NRGBA, plate color.Color) *image.NRGBA {
	p := color.NRGBAModel.Convert(plate).(color.NRGBA)
	// The darkest the artwork gets is the bars' ink; distance from the plate
	// is measured against that, so the bars come out fully opaque.
	far := 0.0
	dist := func(c color.NRGBA) float64 {
		dr := float64(c.R) - float64(p.R)
		dg := float64(c.G) - float64(p.G)
		db := float64(c.B) - float64(p.B)
		return math.Sqrt(dr*dr + dg*dg + db*db)
	}
	b := img.Bounds()
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			far = math.Max(far, dist(img.NRGBAAt(x, y)))
		}
	}
	out := image.NewNRGBA(b)
	if far == 0 {
		return out
	}
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			c := img.NRGBAAt(x, y)
			a := byte8(dist(c) / far * float64(c.A) / 255)
			if a > 0 {
				out.SetNRGBA(x, y, color.NRGBA{R: 255, G: 255, B: 255, A: a})
			}
		}
	}
	return out
}

// centred places img in the middle of a transparent canvas×canvas square.
func centred(img *image.NRGBA, canvas int) *image.NRGBA {
	out := image.NewNRGBA(image.Rect(0, 0, canvas, canvas))
	off := (canvas - img.Bounds().Dx()) / 2
	for y := 0; y < img.Bounds().Dy(); y++ {
		for x := 0; x < img.Bounds().Dx(); x++ {
			out.SetNRGBA(off+x, off+y, img.NRGBAAt(x, y))
		}
	}
	return out
}

func byte8(v float64) uint8 {
	return uint8(math.Round(math.Max(0, math.Min(1, v)) * 255))
}
