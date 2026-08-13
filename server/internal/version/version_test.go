package version

import (
	"regexp"
	"testing"
)

// The version string is compared against the client's, which builds it from
// the same source via scripts/version.mjs. Its shape is a contract.
func TestStringShape(t *testing.T) {
	got := String()
	if !regexp.MustCompile(`^v\d+\.\d+\.\d+$`).MatchString(got) {
		t.Fatalf("version %q is not vMAJOR.MINOR.PATCH", got)
	}
}

// An unstamped build must be visibly a non-release rather than claim to be
// patch 1 of something.
func TestUnstampedBuildReportsPatchZero(t *testing.T) {
	if Patch != "0" {
		t.Skipf("this binary was stamped (patch %s)", Patch)
	}
	if got := String(); got[len(got)-2:] != ".0" {
		t.Fatalf("unstamped build reports %q", got)
	}
}
