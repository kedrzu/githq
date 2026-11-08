#!/bin/bash
# Checks, before the macOS app is signed with it, that a provisioning profile authorises that signature: it names the
# signing certificate, and grants every entitlement the app is signed with plus Associated Domains (which Tauri's CLI
# adds from `plugins.deep-link.desktop.domains`). macOS kills at launch an app whose profile does not, so a mismatch
# would otherwise ship a signed, notarized app that cannot start, through the updater too.
#
# Usage: check-provisioning-profile.sh <profile.provisionprofile> <certificate.der> <Entitlements.plist>
# Needs macOS (`security`, `plutil`), `openssl` and `jq`.

set -euo pipefail

if [ $# -ne 3 ]; then
    echo "Usage: $0 <profile.provisionprofile> <certificate.der> <Entitlements.plist>" >&2
    exit 2
fi

profile=$1
certificate=$2
entitlements=$3

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

security cms -D -i "$profile" > "$work/profile.plist"

describe() {
    openssl x509 -inform DER -noout -subject -serial -fingerprint -sha1 -nameopt utf8 | tr '\n' ' '
}

fingerprint() {
    openssl x509 -inform DER -noout -fingerprint -sha1 | cut -d= -f2
}

failed=0

signing=$(fingerprint < "$certificate")
count=$(plutil -extract DeveloperCertificates raw -o - "$work/profile.plist")
listed=""
named=""
for ((i = 0; i < count; i++)); do
    plutil -extract "DeveloperCertificates.$i" raw -o - "$work/profile.plist" | base64 --decode > "$work/certificate.der"
    if [ "$(fingerprint < "$work/certificate.der")" = "$signing" ]; then
        listed=yes
    fi
    named+="  The profile names: $(describe < "$work/certificate.der")"$'\n'
done

if [ -z "$listed" ]; then
    failed=1
    echo "The profile does not name the certificate the app is signed with."
    echo "  Signed with: $(describe < "$certificate")"
    printf %s "$named"
    echo "  Edit the profile on developer.apple.com, pick the certificate with the serial the app is signed with, and replace the secret."
fi

plutil -extract Entitlements json -o "$work/granted.json" "$work/profile.plist"
plutil -convert json -o "$work/signed.json" "$entitlements"

# Each entitlement the app is signed with, which the profile grants with another value or not at all.
mismatches=$(jq -r --slurpfile granted "$work/granted.json" \
    'to_entries[] | select($granted[0][.key] != .value)
        | "  \(.key): signed with \(.value | tojson), the profile grants \($granted[0][.key] | tojson)"' \
    "$work/signed.json")
if [ -n "$mismatches" ]; then
    failed=1
    echo "The profile does not grant the entitlements the app is signed with:"
    echo "$mismatches"
fi

if ! jq -e 'has("com.apple.developer.associated-domains")' "$work/granted.json" > /dev/null; then
    failed=1
    echo "The profile does not grant Associated Domains: tick it on the App ID and create the profile again."
fi

if [ "$failed" -ne 0 ]; then
    exit 1
fi

echo "The profile authorises the app's signature."
