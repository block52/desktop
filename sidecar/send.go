package main

import (
	"errors"
	"fmt"
	"regexp"

	"github.com/btcsuite/btcd/btcutil/bech32"
)

// cosmosDenom is the cosmos-sdk denom syntax: a letter, then letters, digits and / : . _ -, 3 to 128 characters.
var cosmosDenom = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9/:._-]{2,127}$`)

// validateSend checks a bank send before anything is signed. The sidecar only ever signs as the wallet it was
// given, so a request that names a different sender is refused instead of quietly ignored, and the recipient
// must be a real Block52 address (right prefix, valid checksum), not a mistyped one.
func validateSend(own, from, to, denom string, amount uint64) error {
	if from != "" && from != own {
		return errors.New("send: the sender must be this wallet")
	}
	if amount == 0 {
		return errors.New("send: the amount must be greater than zero")
	}
	if !cosmosDenom.MatchString(denom) {
		return fmt.Errorf("send: %q is not a valid denom", denom)
	}
	hrp, data, err := bech32.Decode(to)
	if err != nil {
		return errors.New("send: the recipient is not a valid address")
	}
	if hrp != addressPrefix || len(data) == 0 {
		return fmt.Errorf("send: the recipient must be a %s address", addressPrefix)
	}
	return nil
}
