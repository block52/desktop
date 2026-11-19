package main

import (
	"fmt"

	"google.golang.org/grpc/encoding"
	"google.golang.org/grpc/mem"
)

// rawCodec passes already-encoded protobuf bytes through gRPC unchanged, as pokerchain-go-client does.
type rawCodec struct{}

func (rawCodec) Name() string { return "proto" }

func (rawCodec) Marshal(v any) (mem.BufferSlice, error) {
	b, ok := v.([]byte)
	if !ok {
		return nil, fmt.Errorf("rawCodec: want []byte, got %T", v)
	}
	return mem.BufferSlice{mem.SliceBuffer(b)}, nil
}

func (rawCodec) Unmarshal(data mem.BufferSlice, v any) error {
	p, ok := v.(*[]byte)
	if !ok {
		return fmt.Errorf("rawCodec: want *[]byte, got %T", v)
	}
	*p = data.Materialize()
	return nil
}

var _ encoding.CodecV2 = rawCodec{}
